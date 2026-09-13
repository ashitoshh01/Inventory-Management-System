import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import {
  PurchaseOrderDto,
  PurchaseOrderStatus,
  PaginatedResponse,
  GoodsReceiptDto,
  ProcurementMetricsDto,
  PurchaseOrderReconciliationDto,
  PurchaseOrderReconciliationLineDto,
  PurchaseOrderAuditEventDto,
} from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../core/services/idempotency.service';
import { createPaginatedResponse } from '../core/dto/pagination.dto';
import { QuantityUtil } from '../core/utils/quantity.util';
import { StockMutationService } from '../stock/stock-mutation.service';
import { PurchaseOrdersFoundationService } from './purchase-orders-foundation.service';
import {
  PurchaseOrderNotFoundException,
  PurchaseOrderCannotUpdateException,
  PurchaseOrderWarehouseNotFoundException,
  PurchaseOrderProductNotFoundException,
  PurchaseOrderDuplicateNumberException,
  PurchaseOrderNotApprovedForReceiptException,
  PurchaseOrderOverReceiptException,
  PurchaseOrderReceiptIdempotencyMismatchException,
  PurchaseOrderInvalidLineException,
} from './purchase-orders.errors';
import { PurchaseOrderValidator } from './purchase-orders.validator';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foundationService: PurchaseOrdersFoundationService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
    private readonly stockMutationService: StockMutationService,
  ) {}

  /**
   * Computes a canonical SHA-256 hash of the purchase order creation payload,
   * excluding any transient client transport fields like idempotencyKey.
   */
  private computePayloadHash(dto: CreatePurchaseOrderDto): string {
    const { idempotencyKey: _, ...mutationPayload } = dto;
    return IdempotencyService.hashPayload(mutationPayload);
  }

  /**
   * Creates a purchase order with tenant isolation and authoritative calculations.
   * Supports database-enforced tenant-scoped idempotency with race-safe concurrency.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePurchaseOrderDto,
    idempotencyKey?: string,
    _requestId?: string,
  ): Promise<{ order: PurchaseOrderDto; isIdempotentReplay: boolean }> {
    const trimmedIdempotencyKey = idempotencyKey?.trim() || undefined;

    if (!trimmedIdempotencyKey) {
      const order = await this.foundationService.create(organizationId, dto, actorUserId);
      return { order, isIdempotentReplay: false };
    }

    const payloadHash = this.computePayloadHash(dto);

    // 1. Pre-transaction check against PostgreSQL
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: {
        organizationId,
        idempotencyKey: trimmedIdempotencyKey,
      },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (existing) {
      if (existing.idempotencyPayloadHash === payloadHash) {
        return {
          order: this.foundationService.mapOrderToDto(existing),
          isIdempotentReplay: true,
        };
      }
      throw new ConflictException(
        'Idempotency key was previously used with different request parameters',
      );
    }

    // 2. Try creating in database with idempotencyKey and idempotencyPayloadHash
    try {
      const order = await this.foundationService.create(
        organizationId,
        {
          ...dto,
          idempotencyKey: trimmedIdempotencyKey,
          idempotencyPayloadHash: payloadHash,
        },
        actorUserId,
      );
      return { order, isIdempotentReplay: false };
    } catch (err: unknown) {
      // 3. Handle concurrent duplicate race (P2002 on unique constraint)
      if (
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
        err instanceof PurchaseOrderDuplicateNumberException
      ) {
        const raceWinner = await this.prisma.purchaseOrder.findFirst({
          where: {
            organizationId,
            idempotencyKey: trimmedIdempotencyKey,
          },
          include: {
            lines: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (raceWinner) {
          if (raceWinner.idempotencyPayloadHash === payloadHash) {
            return {
              order: this.foundationService.mapOrderToDto(raceWinner),
              isIdempotentReplay: true,
            };
          }
          throw new ConflictException(
            'Idempotency key was previously used with different request parameters',
          );
        }
      }

      throw err;
    }
  }

  /**
   * Retrieves high-level operational procurement metrics.
   * Calculations are strictly server-authoritative and organization-scoped.
   */
  async getMetrics(organizationId: string): Promise<ProcurementMetricsDto> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        expectedDate: true,
        updatedAt: true,
      },
    });

    const statusCounts: Record<PurchaseOrderStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      PARTIALLY_RECEIVED: 0,
      RECEIVED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let overdueCount = 0;
    let pendingReceivingCount = 0;
    let recentlyReceivedCount = 0;

    for (const order of orders) {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
      const isActive = order.status === 'APPROVED' || order.status === 'PARTIALLY_RECEIVED';

      if (isActive) {
        pendingReceivingCount++;
        if (order.expectedDate && order.expectedDate < now) {
          overdueCount++;
        }
      }

      if (order.status === 'RECEIVED' && order.updatedAt >= thirtyDaysAgo) {
        recentlyReceivedCount++;
      }
    }

    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: { organizationId },
      select: {
        quantity: true,
        receivedQuantity: true,
        purchaseOrder: { select: { status: true } },
      },
    });

    let totalOrdered = '0.0000';
    let totalReceived = '0.0000';
    let totalOutstanding = '0.0000';

    for (const line of lines) {
      totalOrdered = QuantityUtil.add(totalOrdered, line.quantity.toString());
      totalReceived = QuantityUtil.add(totalReceived, line.receivedQuantity.toString());

      const isPoActive =
        line.purchaseOrder.status === 'APPROVED' ||
        line.purchaseOrder.status === 'PARTIALLY_RECEIVED';

      if (isPoActive) {
        const remaining = QuantityUtil.subtract(
          line.quantity.toString(),
          line.receivedQuantity.toString(),
        );
        if (QuantityUtil.compare(remaining, '0.0000') > 0) {
          totalOutstanding = QuantityUtil.add(totalOutstanding, remaining);
        }
      }
    }

    return {
      totalOrders: orders.length,
      statusCounts,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      totalOutstandingQuantity: totalOutstanding,
      pendingReceivingCount,
      overdueCount,
      recentlyReceivedCount,
    };
  }

  /**
   * Returns a paginated, filtered, and sorted list of purchase orders.
   */
  async findAll(
    organizationId: string,
    query: QueryPurchaseOrderDto,
    requestId?: string,
  ): Promise<PaginatedResponse<PurchaseOrderDto>> {
    const where: Prisma.PurchaseOrderWhereInput = { organizationId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.isOverdue === true) {
      where.status = { in: ['APPROVED', 'PARTIALLY_RECEIVED'] };
      where.expectedDate = { lt: new Date() };
    } else if (query.isOverdue === false) {
      where.NOT = {
        AND: [
          { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
          { expectedDate: { lt: new Date() } },
        ],
      };
    }

    if (query.receivingState === 'OUTSTANDING') {
      where.status = { in: ['APPROVED', 'PARTIALLY_RECEIVED'] };
    } else if (query.receivingState === 'RECEIVED') {
      where.status = 'RECEIVED';
    }

    if (query.startDate || query.endDate) {
      where.orderDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query.supplierName && query.supplierName.trim()) {
      where.supplierName = {
        contains: query.supplierName.trim(),
        mode: 'insensitive',
      };
    }

    if (query.purchaseOrderNumber && query.purchaseOrderNumber.trim()) {
      where.purchaseOrderNumber = {
        contains: query.purchaseOrderNumber.trim(),
        mode: 'insensitive',
      };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { purchaseOrderNumber: { contains: term, mode: 'insensitive' } },
        { supplierName: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.getSafeSortBy();
    const sortOrder = query.sortOrder || 'desc';

    const [total, orders] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip: query.getSkip(),
        take: query.getTake(),
        orderBy: { [sortBy]: sortOrder },
        include: {
          lines: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    const items = orders.map((po) => this.foundationService.mapOrderToDto(po));

    return createPaginatedResponse(items, total, query.page, query.limit, requestId);
  }

  /**
   * Retrieves a single purchase order by ID strictly scoped to the tenant.
   */
  async findOne(id: string, organizationId: string): Promise<PurchaseOrderDto> {
    const order = await this.foundationService.findById(organizationId, id);
    if (!order) {
      throw new PurchaseOrderNotFoundException();
    }
    return order;
  }

  /**
   * Updates a DRAFT purchase order.
   * If lines are provided, they are authoritatively recalculated and replaced atomically.
   */
  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdatePurchaseOrderDto,
    requestId?: string,
  ): Promise<PurchaseOrderDto> {
    // 1. Verify warehouse if provided
    if (dto.warehouseId !== undefined) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId },
        select: { id: true },
      });
      if (!warehouse) {
        throw new PurchaseOrderWarehouseNotFoundException(
          `Warehouse "${dto.warehouseId}" not found in this organization`,
        );
      }
    }

    // 2. If lines provided, validate products and recalculate totals
    let calculatedTotals: ReturnType<
      typeof PurchaseOrderValidator.validateAndCalculateTotals
    > | null = null;

    if (dto.lines !== undefined) {
      calculatedTotals = PurchaseOrderValidator.validateAndCalculateTotals(dto.lines);

      // Verify all products belong to the organization
      const productIds = calculatedTotals.lines.map((l) => l.productId);
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
    }

    // 3. Atomically acquire row lock, verify DRAFT status, update lines & PO
    const updated = await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        {
          id: string;
          status: PurchaseOrderStatus;
          purchaseOrderNumber: string;
          orderDate: Date;
          expectedDate: Date | null;
        }[]
      >`
        SELECT id, status, "purchaseOrderNumber", "orderDate", "expectedDate"
        FROM "PurchaseOrder"
        WHERE "id" = ${id} AND "organizationId" = ${organizationId}
        FOR UPDATE;
      `;

      if (!lockedRows || lockedRows.length === 0 || !lockedRows[0]) {
        throw new PurchaseOrderNotFoundException();
      }

      const existing = lockedRows[0];

      if (existing.status !== 'DRAFT') {
        throw new PurchaseOrderCannotUpdateException(existing.status);
      }

      // Validate dates against locked row
      const finalOrderDate =
        dto.orderDate !== undefined ? new Date(dto.orderDate) : existing.orderDate;
      const finalExpectedDate =
        dto.expectedDate !== undefined
          ? dto.expectedDate
            ? new Date(dto.expectedDate)
            : null
          : existing.expectedDate;
      PurchaseOrderValidator.validateDates(finalOrderDate, finalExpectedDate);

      if (calculatedTotals) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id, organizationId },
        });

        await tx.purchaseOrderLine.createMany({
          data: calculatedTotals.lines.map((line) => ({
            organizationId,
            purchaseOrderId: id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            lineTotal: new Prisma.Decimal(line.lineTotal),
            receivedQuantity: new Prisma.Decimal('0.0000'),
            notes: line.notes ?? null,
          })),
        });
      }

      const updateData: Prisma.PurchaseOrderUpdateInput = {
        ...(dto.supplierName !== undefined ? { supplierName: dto.supplierName.trim() } : {}),
        ...(dto.supplierEmail !== undefined
          ? { supplierEmail: dto.supplierEmail ? dto.supplierEmail.trim().toLowerCase() : null }
          : {}),
        ...(dto.warehouseId !== undefined
          ? {
              warehouse: {
                connect: {
                  organizationId_id: {
                    organizationId,
                    id: dto.warehouseId,
                  },
                },
              },
            }
          : {}),
        ...(dto.orderDate !== undefined ? { orderDate: new Date(dto.orderDate) } : {}),
        ...(dto.expectedDate !== undefined
          ? { expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes ? dto.notes.trim() : null } : {}),
      };

      if (calculatedTotals) {
        updateData.subtotal = new Prisma.Decimal(calculatedTotals.subtotal);
        updateData.taxTotal = new Prisma.Decimal(calculatedTotals.taxTotal);
        updateData.grandTotal = new Prisma.Decimal(calculatedTotals.grandTotal);
      }

      const poUpdated = await tx.purchaseOrder.update({
        where: { id },
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
        action: 'PURCHASE_ORDER_UPDATED',
        entityType: 'PurchaseOrder',
        entityId: id,
        metadata: {
          purchaseOrderNumber: existing.purchaseOrderNumber,
          changedFields: Object.keys(dto),
        },
        ...(requestId ? { requestId } : {}),
        tx,
      });

      return poUpdated;
    });

    return this.foundationService.mapOrderToDto(updated);
  }

  /**
   * Deletes a purchase order only if it is in DRAFT status.
   */
  async deleteDraft(
    id: string,
    organizationId: string,
    actorUserId: string,
    _requestId?: string,
  ): Promise<{ message: string; id: string }> {
    await this.foundationService.deleteDraft(organizationId, id, actorUserId);
    return { message: 'Purchase order deleted successfully', id };
  }

  /**
   * Submits a DRAFT purchase order.
   */
  async submit(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<PurchaseOrderDto> {
    return this.foundationService.transitionStatus(
      organizationId,
      id,
      'SUBMITTED',
      actorUserId,
      requestId ? { requestId } : undefined,
    );
  }

  /**
   * Approves a SUBMITTED purchase order.
   */
  async approve(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<PurchaseOrderDto> {
    return this.foundationService.transitionStatus(
      organizationId,
      id,
      'APPROVED',
      actorUserId,
      requestId ? { requestId } : undefined,
    );
  }

  /**
   * Cancels a purchase order from any valid pre-terminal status.
   */
  async cancel(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<PurchaseOrderDto> {
    return this.foundationService.transitionStatus(
      organizationId,
      id,
      'CANCELLED',
      actorUserId,
      requestId ? { requestId } : undefined,
    );
  }

  /**
   * Receives goods against an approved or partially received purchase order.
   * Coordinates atomic PO update, line receivedQuantity incrementation, stock balance increment,
   * stock ledger entry creation, GoodsReceipt persistence, and audit logging in a single PostgreSQL transaction.
   */
  async receive(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: ReceivePurchaseOrderDto,
    idempotencyKey?: string,
    requestId?: string,
  ): Promise<{ order: PurchaseOrderDto; receipt: GoodsReceiptDto; isIdempotentReplay: boolean }> {
    const cleanKey = idempotencyKey?.trim() || undefined;
    const payloadHash = IdempotencyService.hashPayload(dto);

    // 1. Pre-transaction idempotency lookup
    if (cleanKey) {
      const existingReceipt = await this.prisma.goodsReceipt.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey: cleanKey,
          },
        },
        include: {
          lines: true,
        },
      });

      if (existingReceipt) {
        if (existingReceipt.purchaseOrderId !== id) {
          throw new PurchaseOrderReceiptIdempotencyMismatchException(
            'Idempotency key has already been used for a different purchase order',
          );
        }
        if (
          existingReceipt.idempotencyPayloadHash &&
          existingReceipt.idempotencyPayloadHash !== payloadHash
        ) {
          throw new PurchaseOrderReceiptIdempotencyMismatchException(
            'Idempotency key has already been used with a different receiving payload',
          );
        }

        const order = await this.findOne(id, organizationId);
        return {
          order,
          receipt: this.mapGoodsReceiptToDto(existingReceipt),
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Execute interactive transaction
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // A. Acquire exclusive row-level lock on the PurchaseOrder
          const lockedOrders = await tx.$queryRaw<
            Array<{
              id: string;
              status: PurchaseOrderStatus;
              warehouseId: string;
              purchaseOrderNumber: string;
            }>
          >`
            SELECT id, status, "warehouseId", "purchaseOrderNumber"
            FROM "PurchaseOrder"
            WHERE "id" = ${id} AND "organizationId" = ${organizationId}
            FOR UPDATE;
          `;

          if (!lockedOrders || lockedOrders.length === 0 || !lockedOrders[0]) {
            throw new PurchaseOrderNotFoundException();
          }

          const lockedOrder = lockedOrders[0];

          // Check if idempotency key was already completed by another concurrent transaction that committed
          if (cleanKey) {
            const existingInside = await tx.goodsReceipt.findUnique({
              where: {
                organizationId_idempotencyKey: {
                  organizationId,
                  idempotencyKey: cleanKey,
                },
              },
              include: {
                lines: true,
              },
            });

            if (existingInside) {
              if (existingInside.purchaseOrderId !== id) {
                throw new PurchaseOrderReceiptIdempotencyMismatchException(
                  'Idempotency key has already been used for a different purchase order',
                );
              }
              if (
                existingInside.idempotencyPayloadHash &&
                existingInside.idempotencyPayloadHash !== payloadHash
              ) {
                throw new PurchaseOrderReceiptIdempotencyMismatchException(
                  'Idempotency key has already been used with a different receiving payload',
                );
              }

              return {
                receipt: this.mapGoodsReceiptToDto(existingInside),
                isIdempotentReplay: true,
              };
            }
          }

          // B. Verify status eligibility
          if (lockedOrder.status !== 'APPROVED' && lockedOrder.status !== 'PARTIALLY_RECEIVED') {
            throw new PurchaseOrderNotApprovedForReceiptException(lockedOrder.status);
          }

          // C. Acquire exclusive row-level locks on all PurchaseOrderLine rows for this PO
          const lockedLines = await tx.$queryRaw<
            Array<{
              id: string;
              productId: string;
              quantity: Prisma.Decimal;
              receivedQuantity: Prisma.Decimal;
            }>
          >`
            SELECT id, "productId", quantity, "receivedQuantity"
            FROM "PurchaseOrderLine"
            WHERE "purchaseOrderId" = ${id} AND "organizationId" = ${organizationId}
            FOR UPDATE;
          `;

          const linesMap = new Map<
            string,
            {
              id: string;
              productId: string;
              quantity: Prisma.Decimal;
              receivedQuantity: Prisma.Decimal;
            }
          >();
          for (const line of lockedLines) {
            linesMap.set(line.id, line);
          }

          // D. Validate line items in DTO
          const seenLineIds = new Set<string>();
          for (const item of dto.lines) {
            if (seenLineIds.has(item.purchaseOrderLineId)) {
              throw new PurchaseOrderInvalidLineException(
                `Duplicate purchase order line ID "${item.purchaseOrderLineId}" in receipt payload`,
              );
            }
            seenLineIds.add(item.purchaseOrderLineId);

            const poLine = linesMap.get(item.purchaseOrderLineId);
            if (!poLine) {
              throw new PurchaseOrderInvalidLineException(
                `Line "${item.purchaseOrderLineId}" does not exist on purchase order "${lockedOrder.purchaseOrderNumber}"`,
              );
            }

            // Check over-receiving
            const currentReceived = poLine.receivedQuantity;
            const orderedQty = poLine.quantity;
            const receiveQty = new Prisma.Decimal(item.quantity);

            const newReceived = currentReceived.add(receiveQty);
            if (newReceived.greaterThan(orderedQty)) {
              throw new PurchaseOrderOverReceiptException(
                item.purchaseOrderLineId,
                orderedQty.toFixed(4),
                currentReceived.toFixed(4),
                receiveQty.toFixed(4),
              );
            }
          }

          // Generate sequential receipt number for PO: GR-<PO_NUMBER>-<SEQUENCE>
          const receiptCount = await tx.goodsReceipt.count({
            where: {
              organizationId,
              purchaseOrderId: id,
            },
          });
          const receiptNumber = `GR-${lockedOrder.purchaseOrderNumber}-${receiptCount + 1}`;

          // E. Create GoodsReceipt header
          const createdReceipt = await tx.goodsReceipt.create({
            data: {
              organizationId,
              purchaseOrderId: id,
              warehouseId: lockedOrder.warehouseId,
              receiptNumber,
              idempotencyKey: cleanKey ?? null,
              idempotencyPayloadHash: cleanKey ? payloadHash : null,
              notes: dto.notes ? dto.notes.trim() : null,
              receivedById: actorUserId,
            },
          });

          // F. For each line: update PurchaseOrderLine, create GoodsReceiptLine, call stockMutationService.mutateStockTx
          const receiptLinesData: Array<{
            id: string;
            goodsReceiptId: string;
            purchaseOrderLineId: string;
            productId: string;
            quantityReceived: string;
            createdAt: string;
            organizationId: string;
          }> = [];

          for (const item of dto.lines) {
            const poLine = linesMap.get(item.purchaseOrderLineId)!;
            const receiveQty = new Prisma.Decimal(item.quantity);
            const newReceived = poLine.receivedQuantity.add(receiveQty);

            // Update PurchaseOrderLine
            await tx.purchaseOrderLine.update({
              where: { id: poLine.id },
              data: {
                receivedQuantity: newReceived,
              },
            });

            // Create GoodsReceiptLine
            const createdReceiptLine = await tx.goodsReceiptLine.create({
              data: {
                organizationId,
                goodsReceiptId: createdReceipt.id,
                purchaseOrderLineId: poLine.id,
                productId: poLine.productId,
                quantityReceived: receiveQty,
              },
            });

            receiptLinesData.push({
              id: createdReceiptLine.id,
              goodsReceiptId: createdReceipt.id,
              purchaseOrderLineId: poLine.id,
              productId: poLine.productId,
              quantityReceived: createdReceiptLine.quantityReceived.toFixed(4),
              createdAt: createdReceiptLine.createdAt.toISOString(),
              organizationId,
            });

            // Mutate stock via authoritative StockMutationService inside tx
            await this.stockMutationService.mutateStockTx(tx, {
              organizationId,
              productId: poLine.productId,
              warehouseId: lockedOrder.warehouseId,
              type: 'RECEIPT',
              quantityDelta: item.quantity,
              referenceType: 'PURCHASE_ORDER',
              referenceId: id,
              actorUserId,
              metadata: {
                purchaseOrderNumber: lockedOrder.purchaseOrderNumber,
                purchaseOrderLineId: poLine.id,
                goodsReceiptId: createdReceipt.id,
                goodsReceiptNumber: receiptNumber,
              },
            });

            // Update in-memory map for overall status calculation
            poLine.receivedQuantity = newReceived;
          }

          // G. Calculate new PurchaseOrder status
          let allCompleted = true;
          let anyReceived = false;

          for (const [, line] of linesMap) {
            if (line.receivedQuantity.greaterThan(0)) {
              anyReceived = true;
            }
            if (!line.receivedQuantity.equals(line.quantity)) {
              allCompleted = false;
            }
          }

          let newStatus: PurchaseOrderStatus = lockedOrder.status;
          if (allCompleted) {
            newStatus = 'RECEIVED';
          } else if (anyReceived) {
            newStatus = 'PARTIALLY_RECEIVED';
          }

          if (newStatus !== lockedOrder.status) {
            await tx.purchaseOrder.update({
              where: { id },
              data: {
                status: newStatus,
              },
            });
          }

          // H. Transactional AuditEvent
          await this.auditService.logEvent({
            organizationId,
            actorUserId,
            action: 'purchase-order.received',
            entityType: 'PurchaseOrder',
            entityId: id,
            metadata: {
              purchaseOrderNumber: lockedOrder.purchaseOrderNumber,
              goodsReceiptId: createdReceipt.id,
              receiptNumber,
              previousStatus: lockedOrder.status,
              newStatus,
              linesReceived: receiptLinesData.map((l) => ({
                purchaseOrderLineId: l.purchaseOrderLineId,
                productId: l.productId,
                quantity: l.quantityReceived,
              })),
            },
            ...(requestId ? { requestId } : {}),
            tx,
          });

          return {
            receipt: {
              id: createdReceipt.id,
              organizationId: createdReceipt.organizationId,
              purchaseOrderId: createdReceipt.purchaseOrderId,
              warehouseId: createdReceipt.warehouseId,
              receiptNumber: createdReceipt.receiptNumber,
              idempotencyKey: createdReceipt.idempotencyKey,
              notes: createdReceipt.notes,
              receivedById: createdReceipt.receivedById,
              receivedAt: createdReceipt.receivedAt.toISOString(),
              createdAt: createdReceipt.createdAt.toISOString(),
              updatedAt: createdReceipt.updatedAt.toISOString(),
              lines: receiptLinesData,
            },
            isIdempotentReplay: false,
          };
        },
        { timeout: 20000 },
      );

      const updatedOrder = await this.findOne(id, organizationId);
      return {
        order: updatedOrder,
        receipt: result.receipt,
        isIdempotentReplay: result.isIdempotentReplay,
      };
    } catch (error: unknown) {
      // Handle concurrent duplicate idempotency race (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        cleanKey
      ) {
        const winner = await this.prisma.goodsReceipt.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId,
              idempotencyKey: cleanKey,
            },
          },
          include: { lines: true },
        });
        if (winner) {
          if (winner.idempotencyPayloadHash && winner.idempotencyPayloadHash !== payloadHash) {
            throw new PurchaseOrderReceiptIdempotencyMismatchException(
              'Idempotency key has already been used with a different receiving payload',
            );
          }
          const order = await this.findOne(id, organizationId);
          return {
            order,
            receipt: this.mapGoodsReceiptToDto(winner),
            isIdempotentReplay: true,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Retrieves the goods receipt history for a given purchase order.
   */
  async getReceipts(id: string, organizationId: string): Promise<GoodsReceiptDto[]> {
    await this.findOne(id, organizationId);

    const receipts = await this.prisma.goodsReceipt.findMany({
      where: {
        purchaseOrderId: id,
        organizationId,
      },
      include: {
        lines: true,
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    return receipts.map((r) => this.mapGoodsReceiptToDto(r));
  }

  /**
   * Maps a Prisma GoodsReceipt entity to GoodsReceiptDto.
   */
  private mapGoodsReceiptToDto(receipt: {
    id: string;
    organizationId: string;
    purchaseOrderId: string;
    warehouseId: string;
    receiptNumber: string;
    idempotencyKey: string | null;
    notes: string | null;
    receivedById: string | null;
    receivedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<{
      id: string;
      organizationId: string;
      goodsReceiptId: string;
      purchaseOrderLineId: string;
      productId: string;
      quantityReceived: Prisma.Decimal;
      createdAt: Date;
    }>;
  }): GoodsReceiptDto {
    return {
      id: receipt.id,
      organizationId: receipt.organizationId,
      purchaseOrderId: receipt.purchaseOrderId,
      warehouseId: receipt.warehouseId,
      receiptNumber: receipt.receiptNumber,
      idempotencyKey: receipt.idempotencyKey,
      notes: receipt.notes,
      receivedById: receipt.receivedById,
      receivedAt: receipt.receivedAt.toISOString(),
      createdAt: receipt.createdAt.toISOString(),
      updatedAt: receipt.updatedAt.toISOString(),
      lines: receipt.lines?.map((l) => ({
        id: l.id,
        organizationId: l.organizationId,
        goodsReceiptId: l.goodsReceiptId,
        purchaseOrderLineId: l.purchaseOrderLineId,
        productId: l.productId,
        quantityReceived: l.quantityReceived.toFixed(4),
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  /**
   * READ-ONLY inventory reconciliation for a purchase order.
   * Cross-verifies:
   * 1. PurchaseOrderLine.receivedQuantity == sum(GoodsReceiptLine.quantityReceived)
   * 2. sum(GoodsReceiptLine.quantityReceived) == sum(StockLedgerEntry.quantityDelta [RECEIPT])
   * 3. Overall PO ordered vs received vs remaining.
   * Absolutely zero state or inventory is mutated by this method.
   */
  async reconcile(organizationId: string, id: string): Promise<PurchaseOrderReconciliationDto> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: {
        organizationId_id: { organizationId, id },
      },
      include: {
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            goodsReceiptLines: {
              where: { organizationId },
              select: { id: true, quantityReceived: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new PurchaseOrderNotFoundException();
    }

    // Fetch all stock ledger receipt entries for this purchase order
    const stockLedgers = await this.prisma.stockLedgerEntry.findMany({
      where: {
        organizationId,
        referenceType: 'PURCHASE_ORDER',
        referenceId: order.id,
        type: 'RECEIPT',
      },
      select: {
        id: true,
        quantityDelta: true,
        metadata: true,
      },
    });

    let totalOrdered = '0.0000';
    let totalReceived = '0.0000';
    let totalRemaining = '0.0000';
    let totalGoodsReceipt = '0.0000';
    let totalLedgerDelta = '0.0000';
    const discrepancies: string[] = [];

    const reconciliationLines: PurchaseOrderReconciliationLineDto[] = [];

    for (const line of order.lines) {
      const orderedQty = QuantityUtil.normalize(line.quantity.toString());
      const receivedQty = QuantityUtil.normalize(line.receivedQuantity.toString());
      const remainingQty = QuantityUtil.subtract(orderedQty, receivedQty);

      totalOrdered = QuantityUtil.add(totalOrdered, orderedQty);
      totalReceived = QuantityUtil.add(totalReceived, receivedQty);
      totalRemaining = QuantityUtil.add(totalRemaining, remainingQty);

      // Sum GoodsReceiptLine quantities for this line
      let grLineTotal = '0.0000';
      for (const grl of line.goodsReceiptLines) {
        grLineTotal = QuantityUtil.add(grLineTotal, grl.quantityReceived.toString());
      }
      totalGoodsReceipt = QuantityUtil.add(totalGoodsReceipt, grLineTotal);

      // Sum StockLedgerEntry deltas for this line
      let ledgerLineTotal = '0.0000';
      for (const entry of stockLedgers) {
        const meta = entry.metadata as Record<string, unknown> | null;
        if (meta?.purchaseOrderLineId === line.id) {
          ledgerLineTotal = QuantityUtil.add(ledgerLineTotal, entry.quantityDelta.toString());
        }
      }
      totalLedgerDelta = QuantityUtil.add(totalLedgerDelta, ledgerLineTotal);

      let isLineReconciled = true;
      if (QuantityUtil.compare(receivedQty, grLineTotal) !== 0) {
        isLineReconciled = false;
        discrepancies.push(
          `Line ${line.id} (${line.product.sku}): PurchaseOrderLine.receivedQuantity (${receivedQty}) != GoodsReceiptLines sum (${grLineTotal})`,
        );
      }
      if (QuantityUtil.compare(grLineTotal, ledgerLineTotal) !== 0) {
        isLineReconciled = false;
        discrepancies.push(
          `Line ${line.id} (${line.product.sku}): GoodsReceiptLines sum (${grLineTotal}) != StockLedgerEntry deltas sum (${ledgerLineTotal})`,
        );
      }

      reconciliationLines.push({
        purchaseOrderLineId: line.id,
        productId: line.productId,
        productName: line.product.name,
        productSku: line.product.sku,
        orderedQuantity: orderedQty,
        receivedQuantity: receivedQty,
        remainingQuantity: remainingQty,
        goodsReceiptQuantity: grLineTotal,
        ledgerDeltaQuantity: ledgerLineTotal,
        isLineReconciled,
      });
    }

    if (QuantityUtil.compare(totalReceived, totalGoodsReceipt) !== 0) {
      discrepancies.push(
        `PO total received (${totalReceived}) does not match GoodsReceipt total (${totalGoodsReceipt})`,
      );
    }
    if (QuantityUtil.compare(totalGoodsReceipt, totalLedgerDelta) !== 0) {
      discrepancies.push(
        `GoodsReceipt total (${totalGoodsReceipt}) does not match StockLedger delta total (${totalLedgerDelta})`,
      );
    }

    return {
      purchaseOrderId: order.id,
      purchaseOrderNumber: order.purchaseOrderNumber,
      status: order.status,
      isReconciled: discrepancies.length === 0,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      totalRemainingQuantity: totalRemaining,
      totalGoodsReceiptQuantity: totalGoodsReceipt,
      totalReceiptLedgerDelta: totalLedgerDelta,
      lines: reconciliationLines,
      discrepancies,
    };
  }

  /**
   * Retrieves the complete audit history timeline for a purchase order.
   * Events are tenant-scoped, chronologically ordered, and sensitive metadata is redacted.
   */
  async getAuditTrail(organizationId: string, id: string): Promise<PurchaseOrderAuditEventDto[]> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { organizationId_id: { organizationId, id } },
      select: { id: true },
    });
    if (!order) {
      throw new PurchaseOrderNotFoundException();
    }
    return this.auditService.getEventsForEntity(organizationId, 'PurchaseOrder', id);
  }
}
