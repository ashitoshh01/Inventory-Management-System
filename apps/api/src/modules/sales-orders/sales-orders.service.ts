import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, PrismaService } from '@repo/database';
import {
  SalesOrderDto,
  SalesOrderLineDto,
  SalesOrderMetricsDto,
  SalesOrderAuditEventDto,
  PaginatedResponse,
} from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { StockMutationService } from '../stock/stock-mutation.service';
import {
  CreateSalesOrderDto,
  UpdateSalesOrderDto,
  CancelSalesOrderDto,
  SalesOrderQueryDto,
} from './dto/sales-order.dto';
import {
  SalesOrderMutationResult,
  SalesOrderFulfillmentResult,
} from './sales-orders.types';
import {
  SalesOrderNotFoundException,
  SalesOrderDuplicateNumberException,
  SalesOrderIdempotencyConflictException,
  SalesOrderImmutableStatusException,
  SalesOrderFulfillmentException,
} from './sales-orders.errors';
import { SalesOrderStateMachine } from './sales-orders.state-machine';
import { SalesOrdersValidator } from './sales-orders.validator';

@Injectable()
export class SalesOrdersService {
  private readonly logger = new Logger(SalesOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockMutationService: StockMutationService,
  ) {}

  /**
   * Creates a new sales order inside a PostgreSQL transaction.
   * Supports database-level idempotency and enforces server-authoritative financial totals.
   */
  async create(
    organizationId: string,
    dto: CreateSalesOrderDto,
    actorUserId?: string,
    idempotencyKeyHeader?: string,
  ): Promise<SalesOrderMutationResult> {
    const rawKey = idempotencyKeyHeader || dto.idempotencyKey;
    const idempotencyKey = rawKey?.trim() || null;
    let payloadHash: string | null = null;

    if (idempotencyKey) {
      payloadHash = this.computePayloadHash(dto);

      const existing = await this.prisma.salesOrder.findFirst({
        where: { organizationId, idempotencyKey },
        include: { lines: true },
      });

      if (existing) {
        if (existing.idempotencyPayloadHash !== payloadHash) {
          throw new SalesOrderIdempotencyConflictException(idempotencyKey);
        }
        return {
          order: this.mapToDto(existing),
          isIdempotentReplay: true,
        };
      }
    }

    // Verify duplicate order number in tenant
    const duplicate = await this.prisma.salesOrder.findFirst({
      where: { organizationId, salesOrderNumber: dto.salesOrderNumber.trim() },
    });
    if (duplicate) {
      throw new SalesOrderDuplicateNumberException(dto.salesOrderNumber.trim());
    }

    // Validate inputs & compute authoritative totals
    const validatedData = await SalesOrdersValidator.validateCreate(
      this.prisma,
      organizationId,
      dto,
    );

    const createdOrder = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.salesOrder.create({
          data: {
            organizationId,
            salesOrderNumber: validatedData.salesOrderNumber,
            idempotencyKey,
            idempotencyPayloadHash: payloadHash,
            customerId: validatedData.customerId ?? null,
            customerName: validatedData.customerName,
            customerEmail: validatedData.customerEmail ?? null,
            warehouseId: validatedData.warehouseId,
            currency: validatedData.currency,
            subtotal: new Prisma.Decimal(validatedData.subtotal),
            taxTotal: new Prisma.Decimal(validatedData.taxTotal),
            grandTotal: new Prisma.Decimal(validatedData.grandTotal),
            notes: validatedData.notes ?? null,
            orderDate: validatedData.orderDate,
            expectedDate: validatedData.expectedDate ?? null,
            createdById: actorUserId || null,
          },
        });

        await tx.salesOrderLine.createMany({
          data: validatedData.lines.map((line) => ({
            organizationId,
            salesOrderId: order.id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            lineTotal: new Prisma.Decimal(line.lineTotal),
            notes: line.notes ?? null,
          })),
        });

        return tx.salesOrder.findUniqueOrThrow({
          where: { id: order.id },
          include: { lines: true },
        });
      },
      { timeout: 15000 },
    );

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.created',
      entityType: 'SalesOrder',
      entityId: createdOrder.id,
      metadata: {
        salesOrderNumber: createdOrder.salesOrderNumber,
        grandTotal: createdOrder.grandTotal.toFixed(4),
        warehouseId: createdOrder.warehouseId,
        lineCount: createdOrder.lines.length,
      },
    });

    return {
      order: this.mapToDto(createdOrder),
      isIdempotentReplay: false,
    };
  }

  /**
   * Retrieves paginated sales orders with filters and sorting.
   */
  async findAll(
    organizationId: string,
    query: SalesOrderQueryDto,
  ): Promise<PaginatedResponse<SalesOrderDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortOrder = query.sortOrder ? (query.sortOrder.toLowerCase() as 'asc' | 'desc') : 'desc';
    const sortBy = query.getSafeSortBy();

    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.startDate || query.endDate) {
      where.orderDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { salesOrderNumber: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { lines: true },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((o) => this.mapToDto(o)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Finds a single sales order by ID with tenant safety.
   */
  async findOne(organizationId: string, id: string): Promise<SalesOrderDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        lines: true,
        warehouse: { select: { id: true, name: true, code: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      throw new SalesOrderNotFoundException(id);
    }

    return this.mapToDto(order);
  }

  /**
   * Updates an existing draft sales order.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSalesOrderDto,
    actorUserId?: string,
  ): Promise<SalesOrderDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });

    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    if (existing.status !== 'DRAFT') {
      throw new SalesOrderImmutableStatusException(existing.status, 'update');
    }

    const validated = await SalesOrdersValidator.validateUpdate(
      this.prisma,
      organizationId,
      existing.warehouseId,
      dto,
    );

    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (validated.lines) {
          await tx.salesOrderLine.deleteMany({
            where: { organizationId, salesOrderId: id },
          });
          await tx.salesOrderLine.createMany({
            data: validated.lines.map((line) => ({
              organizationId,
              salesOrderId: id,
              productId: line.productId,
              quantity: new Prisma.Decimal(line.quantity),
              unitPrice: new Prisma.Decimal(line.unitPrice),
              lineTotal: new Prisma.Decimal(line.lineTotal),
              notes: line.notes ?? null,
            })),
          });
        }

        const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};
        if (validated.warehouseId) updateData.warehouseId = validated.warehouseId;
        if (validated.customerId !== undefined) updateData.customerId = validated.customerId;
        if (validated.customerName !== undefined) updateData.customerName = validated.customerName;
        if (validated.customerEmail !== undefined) updateData.customerEmail = validated.customerEmail;
        if (validated.currency !== undefined) updateData.currency = validated.currency;
        if (validated.notes !== undefined) updateData.notes = validated.notes;
        if (validated.orderDate !== undefined) updateData.orderDate = validated.orderDate;
        if (validated.expectedDate !== undefined) updateData.expectedDate = validated.expectedDate;
        if (validated.subtotal !== undefined) {
          updateData.subtotal = new Prisma.Decimal(validated.subtotal);
          updateData.taxTotal = new Prisma.Decimal(validated.taxTotal || '0');
          updateData.grandTotal = new Prisma.Decimal(validated.grandTotal || validated.subtotal);
        }

        await tx.salesOrder.update({
          where: { id },
          data: updateData,
        });

        return tx.salesOrder.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
      },
      { timeout: 15000 },
    );

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.updated',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: { changes: dto as unknown as Record<string, unknown> },
    });

    return this.mapToDto(updated);
  }

  /**
   * Deletes a draft sales order.
   */
  async remove(organizationId: string, id: string, actorUserId?: string): Promise<void> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    if (existing.status !== 'DRAFT') {
      throw new SalesOrderImmutableStatusException(existing.status, 'delete');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.salesOrderLine.deleteMany({
        where: { organizationId, salesOrderId: id },
      });
      await tx.salesOrder.delete({
        where: { id },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.deleted',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: { salesOrderNumber: existing.salesOrderNumber },
    });
  }

  /**
   * Transitions sales order from DRAFT to SUBMITTED.
   */
  async submit(organizationId: string, id: string, actorUserId?: string): Promise<SalesOrderDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    SalesOrderStateMachine.assertTransition(existing.status, 'SUBMITTED');

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { lines: true },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.submitted',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: { from: existing.status, to: 'SUBMITTED' },
    });

    return this.mapToDto(updated);
  }

  /**
   * Transitions sales order from SUBMITTED to APPROVED.
   */
  async approve(organizationId: string, id: string, actorUserId?: string): Promise<SalesOrderDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    SalesOrderStateMachine.assertTransition(existing.status, 'APPROVED');

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: actorUserId || null,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.approved',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: { from: existing.status, to: 'APPROVED' },
    });

    return this.mapToDto(updated);
  }

  /**
   * Fast-track confirmation: transitions DRAFT or SUBMITTED directly to APPROVED.
   */
  async confirm(organizationId: string, id: string, actorUserId?: string): Promise<SalesOrderDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    SalesOrderStateMachine.assertTransition(existing.status, 'APPROVED');

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: actorUserId || null,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.confirmed',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: { from: existing.status, to: 'APPROVED' },
    });

    return this.mapToDto(updated);
  }

  /**
   * Authoritative fulfillment: atomically verifies inventory availability, issues stock via
   * StockMutationService, transitions order status to FULFILLED, and emits audit event.
   */
  async fulfill(
    organizationId: string,
    id: string,
    actorUserId?: string,
    idempotencyKey?: string,
  ): Promise<SalesOrderFulfillmentResult> {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Acquire row-level lock on the SalesOrder
        const lockedOrders = await tx.$queryRaw<Array<{ id: string; status: string; warehouseId: string; salesOrderNumber: string }>>`
          SELECT "id", "status", "warehouseId", "salesOrderNumber"
          FROM "SalesOrder"
          WHERE "id" = ${id} AND "organizationId" = ${organizationId}
          FOR UPDATE;
        `;

        if (!lockedOrders || lockedOrders.length === 0 || !lockedOrders[0]) {
          throw new SalesOrderNotFoundException(id);
        }

        const lockedOrder = lockedOrders[0];

        // Check if already fulfilled (idempotent replay)
        if (lockedOrder.status === 'FULFILLED') {
          const current = await tx.salesOrder.findUniqueOrThrow({
            where: { id },
            include: { lines: true },
          });
          return { order: this.mapToDto(current), isIdempotentReplay: true };
        }

        // Validate state machine transition
        SalesOrderStateMachine.assertTransition(lockedOrder.status as any, 'FULFILLED');

        // 2. Fetch lines sorted by productId ASC for deterministic locking & deadlock avoidance
        const lines = await tx.salesOrderLine.findMany({
          where: { organizationId, salesOrderId: id },
          orderBy: { productId: 'asc' },
        });

        if (!lines || lines.length === 0) {
          throw new SalesOrderFulfillmentException('Cannot fulfill an order with no line items');
        }

        // 3. For each line, deduct stock via authoritative StockMutationService inside tx
        for (const line of lines) {
          const qtyStr = line.quantity.toFixed(4);
          await this.stockMutationService.mutateStockTx(tx, {
            organizationId,
            productId: line.productId,
            warehouseId: lockedOrder.warehouseId,
            type: 'ISSUE',
            quantityDelta: `-${qtyStr}`,
            referenceType: 'SALES_ORDER',
            referenceId: id,
            ...(actorUserId ? { actorUserId } : {}),
            metadata: {
              salesOrderNumber: lockedOrder.salesOrderNumber,
              salesOrderLineId: line.id,
              action: 'FULFILL',
            },
          });
        }

        // 4. Update SalesOrder status to FULFILLED
        const fulfilledOrder = await tx.salesOrder.update({
          where: { id },
          data: {
            status: 'FULFILLED',
            fulfilledById: actorUserId || null,
            fulfilledAt: new Date(),
          },
          include: { lines: true },
        });

        // 5. Emit transactional audit event
        await this.auditService.logEvent({
          organizationId,
          ...(actorUserId ? { actorUserId } : {}),
          action: 'sales-order.fulfilled',
          entityType: 'SalesOrder',
          entityId: id,
          metadata: {
            salesOrderNumber: fulfilledOrder.salesOrderNumber,
            warehouseId: fulfilledOrder.warehouseId,
            lineCount: lines.length,
          },
        });

        return {
          order: this.mapToDto(fulfilledOrder),
          isIdempotentReplay: false,
        };
      },
      { timeout: 20000 },
    );
  }

  /**
   * Cancels a sales order. Only allowed for pre-terminal states (DRAFT, SUBMITTED, APPROVED).
   * Fulfillment cannot be cancelled.
   */
  async cancel(
    organizationId: string,
    id: string,
    dto: CancelSalesOrderDto,
    actorUserId?: string,
  ): Promise<SalesOrderDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });

    if (!existing) {
      throw new SalesOrderNotFoundException(id);
    }

    SalesOrderStateMachine.assertTransition(existing.status, 'CANCELLED');

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledById: actorUserId || null,
        cancelledAt: new Date(),
        cancellationReason: dto.reason.trim(),
      },
      include: { lines: true },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'sales-order.cancelled',
      entityType: 'SalesOrder',
      entityId: id,
      metadata: {
        from: existing.status,
        reason: dto.reason.trim(),
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Retrieves aggregate KPI metrics for sales orders.
   */
  async getMetrics(organizationId: string): Promise<SalesOrderMetricsDto> {
    const [counts, revenueAgg, fulfilledQtyAgg, todaySalesAgg] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prisma.salesOrder.aggregate({
        where: { organizationId, status: 'FULFILLED' },
        _sum: { grandTotal: true },
      }),
      this.prisma.$queryRaw<Array<{ total_fulfilled_qty: string | null }>>`
        SELECT COALESCE(SUM(sol.quantity), 0)::text as total_fulfilled_qty
        FROM "SalesOrderLine" sol
        JOIN "SalesOrder" so ON so.id = sol."salesOrderId" AND so."organizationId" = sol."organizationId"
        WHERE so."organizationId" = ${organizationId} AND so.status = 'FULFILLED';
      `,
      this.prisma.$queryRaw<Array<{ today_sales: string | null }>>`
        SELECT COALESCE(SUM("grandTotal"), 0)::text as today_sales
        FROM "SalesOrder"
        WHERE "organizationId" = ${organizationId}
          AND status = 'FULFILLED'
          AND "orderDate" >= CURRENT_DATE;
      `,
    ]);

    const countMap: Record<string, number> = {};
    let totalOrders = 0;
    for (const c of counts) {
      countMap[c.status] = c._count.id;
      totalOrders += c._count.id;
    }

    return {
      totalOrders,
      draftCount: countMap['DRAFT'] || 0,
      submittedCount: countMap['SUBMITTED'] || 0,
      approvedCount: countMap['APPROVED'] || 0,
      fulfilledCount: countMap['FULFILLED'] || 0,
      cancelledCount: countMap['CANCELLED'] || 0,
      totalRevenue: revenueAgg._sum.grandTotal ? revenueAgg._sum.grandTotal.toFixed(4) : '0.0000',
      todaySalesRevenue: todaySalesAgg[0]?.today_sales || '0.0000',
      fulfilledQuantity: fulfilledQtyAgg[0]?.total_fulfilled_qty || '0.0000',
    };
  }

  /**
   * Returns chronological audit history for a specific sales order.
   */
  async getAuditTrail(organizationId: string, id: string): Promise<SalesOrderAuditEventDto[]> {
    await this.findOne(organizationId, id);

    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        entityType: 'SalesOrder',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return events.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      actorUserId: e.actorUserId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: (e.metadata as Record<string, unknown>) || null,
      requestId: e.requestId,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  private mapToDto(order: {
    id: string;
    organizationId: string;
    salesOrderNumber: string;
    customerId: string | null;
    customerName: string;
    customerEmail: string | null;
    status: any;
    orderDate: Date;
    expectedDate: Date | null;
    warehouseId: string;
    currency: string;
    subtotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    notes: string | null;
    createdById: string | null;
    approvedById: string | null;
    approvedAt: Date | null;
    fulfilledById: string | null;
    fulfilledAt: Date | null;
    cancelledById: string | null;
    cancelledAt: Date | null;
    cancellationReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<{
      id: string;
      organizationId: string;
      salesOrderId: string;
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): SalesOrderDto {
    return {
      id: order.id,
      organizationId: order.organizationId,
      salesOrderNumber: order.salesOrderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      expectedDate: order.expectedDate ? order.expectedDate.toISOString() : null,
      warehouseId: order.warehouseId,
      currency: order.currency,
      subtotal: order.subtotal.toFixed(4),
      taxTotal: order.taxTotal.toFixed(4),
      grandTotal: order.grandTotal.toFixed(4),
      notes: order.notes,
      createdById: order.createdById,
      approvedById: order.approvedById,
      approvedAt: order.approvedAt ? order.approvedAt.toISOString() : null,
      fulfilledById: order.fulfilledById,
      fulfilledAt: order.fulfilledAt ? order.fulfilledAt.toISOString() : null,
      cancelledById: order.cancelledById,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines?.map(this.mapLineToDto),
    };
  }

  private mapLineToDto(line: {
    id: string;
    organizationId: string;
    salesOrderId: string;
    productId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SalesOrderLineDto {
    return {
      id: line.id,
      organizationId: line.organizationId,
      salesOrderId: line.salesOrderId,
      productId: line.productId,
      quantity: line.quantity.toFixed(4),
      unitPrice: line.unitPrice.toFixed(4),
      lineTotal: line.lineTotal.toFixed(4),
      notes: line.notes,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    };
  }

  private computePayloadHash(dto: CreateSalesOrderDto): string {
    const normalized = {
      salesOrderNumber: dto.salesOrderNumber.trim(),
      customerId: dto.customerId || null,
      customerName: dto.customerName?.trim(),
      warehouseId: dto.warehouseId,
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity.trim(),
        unitPrice: l.unitPrice.trim(),
      })),
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }
}
