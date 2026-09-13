import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import { PurchaseOrderDto, PurchaseOrderLineDto, PurchaseOrderStatus } from '@repo/types';
import { AuditService } from '../audit/audit.service';
import {
  PurchaseOrderNotFoundException,
  PurchaseOrderDuplicateNumberException,
  PurchaseOrderCannotDeleteException,
  PurchaseOrderWarehouseNotFoundException,
  PurchaseOrderProductNotFoundException,
  PurchaseOrderCrossTenantReferenceException,
} from './purchase-orders.errors';
import { PurchaseOrderStateMachine } from './purchase-orders.state-machine';
import { PurchaseOrderValidator } from './purchase-orders.validator';
import { InternalCreatePurchaseOrder } from './purchase-orders.types';

@Injectable()
export class PurchaseOrdersFoundationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authoritatively creates a Purchase Order with lines within an atomic database transaction.
   * Calculates all line totals, subtotal, and grand total server-side.
   */
  async create(
    organizationId: string,
    input: InternalCreatePurchaseOrder,
    actorUserId?: string,
  ): Promise<PurchaseOrderDto> {
    const validated = PurchaseOrderValidator.validateCreateInput(input);

    // 1. Verify warehouse belongs to this organization
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: validated.warehouseId, organizationId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new PurchaseOrderWarehouseNotFoundException(
        `Warehouse "${validated.warehouseId}" not found in this organization`,
      );
    }

    // 2. Verify all products belong to this organization
    const productIds = validated.calculated.lines.map((l) => l.productId);
    const existingProducts = await this.prisma.product.findMany({
      where: {
        organizationId,
        id: { in: productIds },
      },
      select: { id: true },
    });
    const foundProductIds = new Set(existingProducts.map((p) => p.id));
    for (const pid of productIds) {
      if (!foundProductIds.has(pid)) {
        throw new PurchaseOrderProductNotFoundException(pid);
      }
    }

    // 3. Atomically create PurchaseOrder + lines in interactive transaction
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Fast-fail if order number already exists in this tenant
        const existing = await tx.purchaseOrder.findFirst({
          where: {
            organizationId,
            purchaseOrderNumber: validated.purchaseOrderNumber,
          },
          select: { id: true },
        });
        if (existing) {
          throw new PurchaseOrderDuplicateNumberException(validated.purchaseOrderNumber);
        }

        const po = await tx.purchaseOrder.create({
          data: {
            organizationId,
            purchaseOrderNumber: validated.purchaseOrderNumber,
            idempotencyKey: input.idempotencyKey ?? null,
            idempotencyPayloadHash: input.idempotencyPayloadHash ?? null,
            supplierName: validated.supplierName,
            supplierEmail: validated.supplierEmail ?? null,
            status: 'DRAFT',
            orderDate: validated.orderDate,
            expectedDate: validated.expectedDate,
            warehouseId: validated.warehouseId,
            currency: validated.currency,
            subtotal: new Prisma.Decimal(validated.calculated.subtotal),
            taxTotal: new Prisma.Decimal(validated.calculated.taxTotal),
            grandTotal: new Prisma.Decimal(validated.calculated.grandTotal),
            notes: validated.notes ?? null,
            createdById: actorUserId ?? null,
          },
        });

        await tx.purchaseOrderLine.createMany({
          data: validated.calculated.lines.map((line) => ({
            organizationId,
            purchaseOrderId: po.id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            lineTotal: new Prisma.Decimal(line.lineTotal),
            receivedQuantity: new Prisma.Decimal('0.0000'),
            notes: line.notes ?? null,
          })),
        });

        const created = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: po.id },
          include: {
            lines: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        // Record audit event inside transaction so it commits atomically
        await this.auditService.logEvent({
          organizationId,
          ...(actorUserId ? { actorUserId } : {}),
          action: 'PURCHASE_ORDER_CREATED',
          entityType: 'PurchaseOrder',
          entityId: created.id,
          metadata: {
            purchaseOrderNumber: created.purchaseOrderNumber,
            warehouseId: created.warehouseId,
            supplierName: created.supplierName,
            lineCount: created.lines.length,
            grandTotal: validated.calculated.grandTotal,
            currency: created.currency,
          },
          tx,
        });

        return created;
      });

      return this.mapOrderToDto(created);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new PurchaseOrderDuplicateNumberException(validated.purchaseOrderNumber);
        }
        if (err.code === 'P2003') {
          throw new PurchaseOrderCrossTenantReferenceException(
            'Foreign key referential integrity violation; resource does not belong to tenant',
          );
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves a Purchase Order by ID scoped strictly to the organization.
   */
  async findById(
    organizationId: string,
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<PurchaseOrderDto | null> {
    const po = await client.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!po) {
      return null;
    }

    return this.mapOrderToDto(po);
  }

  /**
   * Retrieves a Purchase Order by its unique order number scoped strictly to the organization.
   */
  async findByOrderNumber(
    organizationId: string,
    purchaseOrderNumber: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<PurchaseOrderDto | null> {
    const po = await client.purchaseOrder.findFirst({
      where: { organizationId, purchaseOrderNumber },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!po) {
      return null;
    }

    return this.mapOrderToDto(po);
  }

  /**
   * Transitions a Purchase Order to a new status governed by the state machine.
   * Serializes transitions atomically using PostgreSQL row-level locks (SELECT ... FOR UPDATE).
   */
  async transitionStatus(
    organizationId: string,
    id: string,
    nextStatus: PurchaseOrderStatus,
    actorUserId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<PurchaseOrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        { id: string; status: PurchaseOrderStatus; purchaseOrderNumber: string }[]
      >`
        SELECT id, status, "purchaseOrderNumber" FROM "PurchaseOrder"
        WHERE "id" = ${id} AND "organizationId" = ${organizationId}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0 || !lockedRows[0]) {
        throw new PurchaseOrderNotFoundException();
      }

      const po = lockedRows[0];

      // Assert status transition against fresh locked row state
      PurchaseOrderStateMachine.assertTransition(po.status, nextStatus);

      const updateData: Prisma.PurchaseOrderUncheckedUpdateInput = {
        status: nextStatus,
      };

      if (nextStatus === 'APPROVED') {
        updateData.approvedById = actorUserId ?? null;
        updateData.approvedAt = new Date();
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: updateData,
        include: {
          lines: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      await this.auditService.logEvent({
        organizationId,
        ...(actorUserId ? { actorUserId } : {}),
        action: 'PURCHASE_ORDER_STATUS_CHANGED',
        entityType: 'PurchaseOrder',
        entityId: updated.id,
        metadata: {
          purchaseOrderNumber: updated.purchaseOrderNumber,
          fromStatus: po.status,
          toStatus: nextStatus,
          ...metadata,
        },
        tx,
      });

      return this.mapOrderToDto(updated);
    });
  }

  /**
   * Deletes a Purchase Order only if it is in DRAFT status.
   * Serializes deletion safely using PostgreSQL row-level locks (SELECT ... FOR UPDATE).
   */
  async deleteDraft(organizationId: string, id: string, actorUserId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        { id: string; status: PurchaseOrderStatus; purchaseOrderNumber: string }[]
      >`
        SELECT id, status, "purchaseOrderNumber" FROM "PurchaseOrder"
        WHERE "id" = ${id} AND "organizationId" = ${organizationId}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0 || !lockedRows[0]) {
        throw new PurchaseOrderNotFoundException();
      }

      const po = lockedRows[0];

      if (po.status !== 'DRAFT') {
        throw new PurchaseOrderCannotDeleteException(po.status);
      }

      await tx.purchaseOrder.delete({
        where: { id: po.id },
      });

      await this.auditService.logEvent({
        organizationId,
        ...(actorUserId ? { actorUserId } : {}),
        action: 'PURCHASE_ORDER_DELETED',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        metadata: {
          purchaseOrderNumber: po.purchaseOrderNumber,
          status: po.status,
        },
        tx,
      });
    });
  }

  /**
   * Maps Prisma PurchaseOrder entity to client-safe DTO.
   */
  public mapOrderToDto(
    po: Prisma.PurchaseOrderGetPayload<{
      include: { lines: true };
    }>,
  ): PurchaseOrderDto {
    return {
      id: po.id,
      organizationId: po.organizationId,
      purchaseOrderNumber: po.purchaseOrderNumber,
      supplierName: po.supplierName,
      supplierEmail: po.supplierEmail,
      status: po.status,
      orderDate: po.orderDate.toISOString(),
      expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
      warehouseId: po.warehouseId,
      currency: po.currency,
      subtotal: po.subtotal.toFixed(4),
      taxTotal: po.taxTotal.toFixed(4),
      grandTotal: po.grandTotal.toFixed(4),
      notes: po.notes,
      createdById: po.createdById,
      approvedById: po.approvedById,
      approvedAt: po.approvedAt ? po.approvedAt.toISOString() : null,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      lines: po.lines ? po.lines.map((l) => this.mapLineToDto(l)) : undefined,
    };
  }

  /**
   * Maps Prisma PurchaseOrderLine entity to client-safe DTO.
   */
  public mapLineToDto(
    line: Prisma.PurchaseOrderLineGetPayload<Record<string, never>>,
  ): PurchaseOrderLineDto {
    return {
      id: line.id,
      organizationId: line.organizationId,
      purchaseOrderId: line.purchaseOrderId,
      productId: line.productId,
      quantity: line.quantity.toFixed(4),
      unitPrice: line.unitPrice.toFixed(4),
      lineTotal: line.lineTotal.toFixed(4),
      receivedQuantity: line.receivedQuantity.toFixed(4),
      notes: line.notes,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    };
  }
}
