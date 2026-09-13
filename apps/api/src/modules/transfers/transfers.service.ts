import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import {
  StockTransferDto,
  StockTransferLineDto,
  StockTransferMetricsDto,
  StockTransferStatus,
} from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { StockMutationService } from '../stock/stock-mutation.service';
import { IdempotencyService } from '../core/services/idempotency.service';
import {
  StockTransferCannotDeleteException,
  StockTransferCannotUpdateException,
  StockTransferDuplicateNumberException,
  StockTransferIdempotencyConflictException,
  StockTransferNotFoundException,
  StockTransferProductNotFoundException,
  StockTransferWarehouseNotFoundException,
} from './transfers.errors';
import { StockTransferStateMachine } from './transfers.state-machine';
import { StockTransferValidator } from './transfers.validator';
import {
  CreateStockTransferDto,
  QueryStockTransferDto,
  ReceiveStockTransferDto,
  ShipStockTransferDto,
  UpdateStockTransferDto,
} from './dto/transfer.dto';
import { TransferReceiveResult, TransferShipResult } from './transfers.types';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockMutationService: StockMutationService,
  ) {}

  /**
   * Computes deterministic SHA-256 hash of the creation payload.
   */
  private computePayloadHash(dto: CreateStockTransferDto): string {
    const { idempotencyKey: _, ...mutationPayload } = dto;
    return IdempotencyService.hashPayload(mutationPayload);
  }

  /**
   * Generates a collision-resistant, human-readable transfer number.
   */
  private generateTransferNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TR-${timestamp}-${randomSuffix}`;
  }

  /**
   * Creates a stock transfer with child lines, database-enforced tenant isolation,
   * and race-safe idempotency support.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateStockTransferDto,
    idempotencyKey?: string,
    requestId?: string,
  ): Promise<{ transfer: StockTransferDto; isIdempotentReplay: boolean }> {
    const trimmedKey = idempotencyKey?.trim() || undefined;

    // 1. If idempotency key provided, check for existing execution
    if (trimmedKey) {
      const payloadHash = this.computePayloadHash(dto);
      const existing = await this.prisma.stockTransfer.findFirst({
        where: {
          organizationId,
          idempotencyKey: trimmedKey,
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });

      if (existing) {
        if (existing.idempotencyPayloadHash === payloadHash) {
          return {
            transfer: this.mapTransferToDto(existing),
            isIdempotentReplay: true,
          };
        }
        throw new StockTransferIdempotencyConflictException();
      }
    }

    // 2. Validate input and invariants
    const transferNumber = dto.transferNumber?.trim() || this.generateTransferNumber();
    const validated = StockTransferValidator.validateCreate({
      transferNumber,
      sourceWarehouseId: dto.sourceWarehouseId,
      destinationWarehouseId: dto.destinationWarehouseId,
      notes: dto.notes ?? null,
      lines: dto.lines,
    });

    // 3. Verify tenant boundaries for warehouses and products
    await this.validateTenantReferences(
      organizationId,
      validated.sourceWarehouseId,
      validated.destinationWarehouseId,
      validated.lines.map((l) => l.productId),
    );

    const payloadHash = trimmedKey ? this.computePayloadHash(dto) : null;

    // 4. Create transfer and lines atomically in PostgreSQL
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const transfer = await tx.stockTransfer.create({
          data: {
            organizationId,
            transferNumber: validated.transferNumber,
            idempotencyKey: trimmedKey ?? null,
            idempotencyPayloadHash: payloadHash,
            status: 'DRAFT',
            sourceWarehouseId: validated.sourceWarehouseId,
            destinationWarehouseId: validated.destinationWarehouseId,
            notes: validated.notes ?? null,
            createdById: actorUserId,
          },
        });

        await tx.stockTransferLine.createMany({
          data: validated.lines.map((line) => ({
            organizationId,
            transferId: transfer.id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            notes: line.notes ?? null,
          })),
        });

        const fullTransfer = await tx.stockTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
          include: {
            lines: {
              include: { product: true },
              orderBy: { createdAt: 'asc' },
            },
            sourceWarehouse: true,
            destinationWarehouse: true,
          },
        });

        return fullTransfer;
      });

      // 5. Emit audit event on commit
      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'stock-transfer.created',
        entityType: 'StockTransfer',
        entityId: created.id,
        metadata: {
          transferNumber: created.transferNumber,
          sourceWarehouseId: created.sourceWarehouseId,
          destinationWarehouseId: created.destinationWarehouseId,
          lineCount: created.lines.length,
          idempotencyKey: trimmedKey,
        },
        ...(requestId ? { requestId } : {}),
      });

      return {
        transfer: this.mapTransferToDto(created),
        isIdempotentReplay: false,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('transferNumber')) {
          throw new StockTransferDuplicateNumberException(validated.transferNumber);
        }
        if (target.includes('idempotencyKey') && trimmedKey) {
          const raceWinner = await this.prisma.stockTransfer.findFirst({
            where: { organizationId, idempotencyKey: trimmedKey },
            include: {
              lines: { include: { product: true }, orderBy: { createdAt: 'asc' } },
              sourceWarehouse: true,
              destinationWarehouse: true,
            },
          });
          if (raceWinner) {
            if (raceWinner.idempotencyPayloadHash === payloadHash) {
              return {
                transfer: this.mapTransferToDto(raceWinner),
                isIdempotentReplay: true,
              };
            }
            throw new StockTransferIdempotencyConflictException();
          }
        }
      }
      throw error;
    }
  }

  /**
   * List paginated, filtered, and sorted stock transfers for tenant.
   */
  async findAll(
    organizationId: string,
    query: QueryStockTransferDto,
    _requestId?: string,
  ): Promise<{
    data: StockTransferDto[];
    meta: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.sourceWarehouseId) {
      where.sourceWarehouseId = query.sourceWarehouseId;
    }

    if (query.destinationWarehouseId) {
      where.destinationWarehouseId = query.destinationWarehouseId;
    }

    if (query.warehouseId) {
      where.OR = [
        { sourceWarehouseId: query.warehouseId },
        { destinationWarehouseId: query.warehouseId },
      ];
    }

    if (query.transferNumber && query.transferNumber.trim()) {
      where.transferNumber = {
        contains: query.transferNumber.trim(),
        mode: 'insensitive',
      };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { transferNumber: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: items.map((item) => this.mapTransferToDto(item)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single stock transfer by ID with complete child lines and relations.
   */
  async findOne(id: string, organizationId: string): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      include: {
        lines: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
    });

    if (!transfer) {
      throw new StockTransferNotFoundException();
    }

    return this.mapTransferToDto(transfer);
  }

  /**
   * Returns operational metrics and counts per status for the organization.
   */
  async getMetrics(organizationId: string): Promise<StockTransferMetricsDto> {
    const counts = await this.prisma.stockTransfer.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    });

    const statusCounts: Record<StockTransferStatus, number> = {
      DRAFT: 0,
      APPROVED: 0,
      IN_TRANSIT: 0,
      RECEIVED: 0,
      CANCELLED: 0,
    };

    let totalCount = 0;
    for (const item of counts) {
      statusCounts[item.status] = item._count._all;
      totalCount += item._count._all;
    }

    return {
      totalCount,
      draftCount: statusCounts.DRAFT,
      approvedCount: statusCounts.APPROVED,
      inTransitCount: statusCounts.IN_TRANSIT,
      receivedCount: statusCounts.RECEIVED,
      cancelledCount: statusCounts.CANCELLED,
      statusCounts,
    };
  }

  /**
   * Updates a DRAFT stock transfer's warehouses, notes, or lines.
   */
  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateStockTransferDto,
    requestId?: string,
  ): Promise<StockTransferDto> {
    const existing = await this.prisma.stockTransfer.findUnique({
      where: {
        organizationId_id: { organizationId, id },
      },
      include: { lines: true },
    });

    if (!existing) {
      throw new StockTransferNotFoundException();
    }

    if (existing.status !== 'DRAFT') {
      throw new StockTransferCannotUpdateException(existing.status);
    }

    const validated = StockTransferValidator.validateUpdate(
      existing.sourceWarehouseId,
      existing.destinationWarehouseId,
      dto,
    );

    if (validated.sourceWarehouseId || validated.destinationWarehouseId || validated.lines) {
      await this.validateTenantReferences(
        organizationId,
        validated.sourceWarehouseId ?? existing.sourceWarehouseId,
        validated.destinationWarehouseId ?? existing.destinationWarehouseId,
        validated.lines ? validated.lines.map((l) => l.productId) : [],
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (validated.lines) {
        await tx.stockTransferLine.deleteMany({
          where: { organizationId, transferId: id },
        });

        await tx.stockTransferLine.createMany({
          data: validated.lines.map((line) => ({
            organizationId,
            transferId: id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            notes: line.notes ?? null,
          })),
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          ...(validated.sourceWarehouseId
            ? { sourceWarehouseId: validated.sourceWarehouseId }
            : {}),
          ...(validated.destinationWarehouseId
            ? { destinationWarehouseId: validated.destinationWarehouseId }
            : {}),
          ...(validated.notes !== undefined ? { notes: validated.notes } : {}),
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'stock-transfer.updated',
      entityType: 'StockTransfer',
      entityId: id,
      metadata: {
        transferNumber: updated.transferNumber,
        sourceWarehouseId: updated.sourceWarehouseId,
        destinationWarehouseId: updated.destinationWarehouseId,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.mapTransferToDto(updated);
  }

  /**
   * Deletes a DRAFT stock transfer.
   */
  async deleteDraft(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.stockTransfer.findUnique({
      where: {
        organizationId_id: { organizationId, id },
      },
    });

    if (!existing) {
      throw new StockTransferNotFoundException();
    }

    if (existing.status !== 'DRAFT') {
      throw new StockTransferCannotDeleteException(existing.status);
    }

    await this.prisma.stockTransfer.delete({
      where: { id },
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'stock-transfer.deleted',
      entityType: 'StockTransfer',
      entityId: id,
      metadata: {
        transferNumber: existing.transferNumber,
      },
      ...(requestId ? { requestId } : {}),
    });

    return { success: true };
  }

  /**
   * Transitions a DRAFT stock transfer to APPROVED.
   */
  async approve(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<StockTransferDto> {
    const approved = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: StockTransferStatus;
          transferNumber: string;
          sourceWarehouseId: string;
          destinationWarehouseId: string;
        }>
      >`
        SELECT id, status, "transferNumber", "sourceWarehouseId", "destinationWarehouseId"
        FROM "StockTransfer"
        WHERE "organizationId" = ${organizationId} AND id = ${id}
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0 || !locked[0]) {
        throw new StockTransferNotFoundException();
      }

      const transfer = locked[0];
      StockTransferStateMachine.assertTransition(transfer.status, 'APPROVED');

      // Re-verify both warehouses are still active
      const warehouses = await tx.warehouse.findMany({
        where: {
          organizationId,
          id: { in: [transfer.sourceWarehouseId, transfer.destinationWarehouseId] },
          status: 'ACTIVE',
        },
      });

      if (warehouses.length < 2) {
        throw new StockTransferWarehouseNotFoundException(
          'One or both warehouses are no longer active',
        );
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: actorUserId,
          approvedAt: new Date(),
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'stock-transfer.approved',
      entityType: 'StockTransfer',
      entityId: id,
      metadata: {
        transferNumber: approved.transferNumber,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.mapTransferToDto(approved);
  }

  /**
   * Dispatches an APPROVED stock transfer to IN_TRANSIT.
   * Atomically mutates source stock via StockMutationService with type: 'ISSUE' (negative delta).
   * Prevents deadlocks by sorting lines deterministically by productId.
   * Supports idempotency replay.
   */
  async ship(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: ShipStockTransferDto,
    idempotencyKey?: string,
    requestId?: string,
  ): Promise<TransferShipResult> {
    const trimmedKey = idempotencyKey?.trim() || dto.idempotencyKey?.trim() || undefined;

    // Check pre-transaction idempotency
    if (trimmedKey) {
      const existing = await this.prisma.stockTransfer.findUnique({
        where: { organizationId_id: { organizationId, id } },
      });
      if (existing && existing.status === 'IN_TRANSIT') {
        return {
          transferId: existing.id,
          status: existing.status,
          shippedAt: existing.shippedAt?.toISOString() ?? new Date().toISOString(),
          isIdempotentReplay: true,
        };
      }
    }

    const shipped = await this.prisma.$transaction(async (tx) => {
      // 1. Lock transfer row
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: StockTransferStatus;
          transferNumber: string;
          sourceWarehouseId: string;
          destinationWarehouseId: string;
        }>
      >`
        SELECT id, status, "transferNumber", "sourceWarehouseId", "destinationWarehouseId"
        FROM "StockTransfer"
        WHERE "organizationId" = ${organizationId} AND id = ${id}
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0 || !locked[0]) {
        throw new StockTransferNotFoundException();
      }

      const transfer = locked[0];

      // Handle race condition idempotency replay
      if (transfer.status === 'IN_TRANSIT') {
        const current = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
        return { transfer: current, isIdempotentReplay: true };
      }

      StockTransferStateMachine.assertTransition(transfer.status, 'IN_TRANSIT');

      // 2. Fetch lines sorted deterministically by productId for deadlock avoidance
      const lines = await tx.stockTransferLine.findMany({
        where: { organizationId, transferId: id },
        orderBy: { productId: 'asc' },
      });

      // 3. For each line: mutate source stock via StockMutationService (ISSUE delta = -quantity)
      for (const line of lines) {
        const qtyStr = line.quantity.toFixed(4);
        await this.stockMutationService.mutateStockTx(tx, {
          organizationId,
          productId: line.productId,
          warehouseId: transfer.sourceWarehouseId,
          type: 'ISSUE',
          quantityDelta: `-${qtyStr}`,
          referenceType: 'STOCK_TRANSFER',
          referenceId: id,
          actorUserId,
          metadata: {
            transferNumber: transfer.transferNumber,
            transferLineId: line.id,
            action: 'DISPATCH',
            destinationWarehouseId: transfer.destinationWarehouseId,
          },
        });
      }

      // 4. Transition transfer status to IN_TRANSIT
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'IN_TRANSIT',
          shippedById: actorUserId,
          shippedAt: new Date(),
          ...(dto.notes ? { notes: dto.notes.trim() } : {}),
        },
      });

      return { transfer: updated, isIdempotentReplay: false };
    });

    if (!shipped.isIdempotentReplay) {
      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'stock-transfer.shipped',
        entityType: 'StockTransfer',
        entityId: id,
        metadata: {
          transferNumber: shipped.transfer.transferNumber,
          sourceWarehouseId: shipped.transfer.sourceWarehouseId,
          destinationWarehouseId: shipped.transfer.destinationWarehouseId,
          idempotencyKey: trimmedKey,
        },
        ...(requestId ? { requestId } : {}),
      });
    }

    return {
      transferId: shipped.transfer.id,
      status: shipped.transfer.status,
      shippedAt: shipped.transfer.shippedAt?.toISOString() ?? new Date().toISOString(),
      isIdempotentReplay: shipped.isIdempotentReplay,
    };
  }

  /**
   * Receives an IN_TRANSIT stock transfer at destination warehouse.
   * Atomically mutates destination stock via StockMutationService with type: 'RECEIPT' (positive delta).
   * Prevents deadlocks by sorting lines deterministically by productId.
   * Supports idempotency replay.
   */
  async receive(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: ReceiveStockTransferDto,
    idempotencyKey?: string,
    requestId?: string,
  ): Promise<TransferReceiveResult> {
    const trimmedKey = idempotencyKey?.trim() || dto.idempotencyKey?.trim() || undefined;

    // Check pre-transaction idempotency
    if (trimmedKey) {
      const existing = await this.prisma.stockTransfer.findUnique({
        where: { organizationId_id: { organizationId, id } },
      });
      if (existing && existing.status === 'RECEIVED') {
        return {
          transferId: existing.id,
          status: existing.status,
          receivedAt: existing.receivedAt?.toISOString() ?? new Date().toISOString(),
          isIdempotentReplay: true,
        };
      }
    }

    const received = await this.prisma.$transaction(async (tx) => {
      // 1. Lock transfer row
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: StockTransferStatus;
          transferNumber: string;
          sourceWarehouseId: string;
          destinationWarehouseId: string;
        }>
      >`
        SELECT id, status, "transferNumber", "sourceWarehouseId", "destinationWarehouseId"
        FROM "StockTransfer"
        WHERE "organizationId" = ${organizationId} AND id = ${id}
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0 || !locked[0]) {
        throw new StockTransferNotFoundException();
      }

      const transfer = locked[0];

      // Handle race condition idempotency replay
      if (transfer.status === 'RECEIVED') {
        const current = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
        return { transfer: current, isIdempotentReplay: true };
      }

      StockTransferStateMachine.assertTransition(transfer.status, 'RECEIVED');

      // 2. Fetch lines sorted deterministically by productId for deadlock avoidance
      const lines = await tx.stockTransferLine.findMany({
        where: { organizationId, transferId: id },
        orderBy: { productId: 'asc' },
      });

      // 3. For each line: mutate destination stock via StockMutationService (RECEIPT delta = +quantity)
      for (const line of lines) {
        const qtyStr = line.quantity.toFixed(4);
        await this.stockMutationService.mutateStockTx(tx, {
          organizationId,
          productId: line.productId,
          warehouseId: transfer.destinationWarehouseId,
          type: 'RECEIPT',
          quantityDelta: qtyStr,
          referenceType: 'STOCK_TRANSFER',
          referenceId: id,
          actorUserId,
          metadata: {
            transferNumber: transfer.transferNumber,
            transferLineId: line.id,
            action: 'RECEIVE',
            sourceWarehouseId: transfer.sourceWarehouseId,
          },
        });
      }

      // 4. Transition transfer status to RECEIVED
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedById: actorUserId,
          receivedAt: new Date(),
          ...(dto.notes ? { notes: dto.notes.trim() } : {}),
        },
      });

      return { transfer: updated, isIdempotentReplay: false };
    });

    if (!received.isIdempotentReplay) {
      await this.auditService.logEvent({
        organizationId,
        actorUserId,
        action: 'stock-transfer.received',
        entityType: 'StockTransfer',
        entityId: id,
        metadata: {
          transferNumber: received.transfer.transferNumber,
          sourceWarehouseId: received.transfer.sourceWarehouseId,
          destinationWarehouseId: received.transfer.destinationWarehouseId,
          idempotencyKey: trimmedKey,
        },
        ...(requestId ? { requestId } : {}),
      });
    }

    return {
      transferId: received.transfer.id,
      status: received.transfer.status,
      receivedAt: received.transfer.receivedAt?.toISOString() ?? new Date().toISOString(),
      isIdempotentReplay: received.isIdempotentReplay,
    };
  }

  /**
   * Transitions a DRAFT or APPROVED stock transfer to CANCELLED.
   */
  async cancel(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<StockTransferDto> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: StockTransferStatus; transferNumber: string }>
      >`
        SELECT id, status, "transferNumber"
        FROM "StockTransfer"
        WHERE "organizationId" = ${organizationId} AND id = ${id}
        FOR UPDATE;
      `;

      if (!locked || locked.length === 0 || !locked[0]) {
        throw new StockTransferNotFoundException();
      }

      const transfer = locked[0];
      StockTransferStateMachine.assertTransition(transfer.status, 'CANCELLED');

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledById: actorUserId,
          cancelledAt: new Date(),
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'stock-transfer.cancelled',
      entityType: 'StockTransfer',
      entityId: id,
      metadata: {
        transferNumber: cancelled.transferNumber,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.mapTransferToDto(cancelled);
  }

  /**
   * Retrieves audit trail for a stock transfer.
   */
  async getAuditTrail(organizationId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { organizationId_id: { organizationId, id } },
      select: { id: true },
    });

    if (!transfer) {
      throw new StockTransferNotFoundException();
    }

    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        entityType: 'StockTransfer',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorUserId: event.actorUserId,
      metadata: event.metadata as Record<string, unknown> | null,
      requestId: event.requestId,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  /**
   * Validates that warehouses and products exist, are active, and belong to organization.
   */
  private async validateTenantReferences(
    organizationId: string,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    productIds: string[],
  ): Promise<void> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        organizationId,
        id: { in: [sourceWarehouseId, destinationWarehouseId] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (warehouses.length < 2) {
      throw new StockTransferWarehouseNotFoundException(
        'One or both warehouses do not exist in this organization or are inactive',
      );
    }

    if (productIds.length > 0) {
      const distinctIds = Array.from(new Set(productIds));
      const products = await this.prisma.product.findMany({
        where: {
          organizationId,
          id: { in: distinctIds },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (products.length !== distinctIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missingId = distinctIds.find((pid) => !foundIds.has(pid));
        throw new StockTransferProductNotFoundException(missingId || 'unknown');
      }
    }
  }

  /**
   * Maps database entity to API-safe DTO.
   */
  public mapTransferToDto(transfer: {
    id: string;
    organizationId: string;
    transferNumber: string;
    status: StockTransferStatus;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    notes: string | null;
    createdById: string | null;
    approvedById: string | null;
    approvedAt: Date | null;
    shippedById: string | null;
    shippedAt: Date | null;
    receivedById: string | null;
    receivedAt: Date | null;
    cancelledById: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<{
      id: string;
      organizationId: string;
      transferId: string;
      productId: string;
      quantity: Prisma.Decimal;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      product?: {
        id: string;
        organizationId: string;
        categoryId: string;
        name: string;
        sku: string;
        description: string | null;
        unitOfMeasure: import('@repo/types').UnitOfMeasure;
        status: import('@repo/types').ProductStatus;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    sourceWarehouse?: {
      id: string;
      organizationId: string;
      name: string;
      code: string;
      description: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
      status: import('@repo/types').WarehouseStatus;
      isDefault: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    destinationWarehouse?: {
      id: string;
      organizationId: string;
      name: string;
      code: string;
      description: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
      status: import('@repo/types').WarehouseStatus;
      isDefault: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }): StockTransferDto {
    return {
      id: transfer.id,
      organizationId: transfer.organizationId,
      transferNumber: transfer.transferNumber,
      status: transfer.status,
      sourceWarehouseId: transfer.sourceWarehouseId,
      destinationWarehouseId: transfer.destinationWarehouseId,
      notes: transfer.notes,
      createdById: transfer.createdById,
      approvedById: transfer.approvedById,
      approvedAt: transfer.approvedAt?.toISOString() ?? null,
      shippedById: transfer.shippedById,
      shippedAt: transfer.shippedAt?.toISOString() ?? null,
      receivedById: transfer.receivedById,
      receivedAt: transfer.receivedAt?.toISOString() ?? null,
      cancelledById: transfer.cancelledById,
      cancelledAt: transfer.cancelledAt?.toISOString() ?? null,
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
      lines: transfer.lines?.map((line): StockTransferLineDto => ({
        id: line.id,
        organizationId: line.organizationId,
        transferId: line.transferId,
        productId: line.productId,
        quantity: line.quantity.toFixed(4),
        notes: line.notes,
        product: line.product
          ? {
              id: line.product.id,
              organizationId: line.product.organizationId,
              categoryId: line.product.categoryId,
              name: line.product.name,
              sku: line.product.sku,
              description: line.product.description,
              unitOfMeasure: line.product.unitOfMeasure,
              status: line.product.status,
              createdAt: line.product.createdAt.toISOString(),
              updatedAt: line.product.updatedAt.toISOString(),
            }
          : undefined,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
      sourceWarehouse: transfer.sourceWarehouse
        ? {
            id: transfer.sourceWarehouse.id,
            organizationId: transfer.sourceWarehouse.organizationId,
            name: transfer.sourceWarehouse.name,
            code: transfer.sourceWarehouse.code,
            description: transfer.sourceWarehouse.description,
            addressLine1: transfer.sourceWarehouse.addressLine1,
            addressLine2: transfer.sourceWarehouse.addressLine2,
            city: transfer.sourceWarehouse.city,
            state: transfer.sourceWarehouse.state,
            postalCode: transfer.sourceWarehouse.postalCode,
            country: transfer.sourceWarehouse.country,
            status: transfer.sourceWarehouse.status,
            isDefault: transfer.sourceWarehouse.isDefault,
            createdAt: transfer.sourceWarehouse.createdAt.toISOString(),
            updatedAt: transfer.sourceWarehouse.updatedAt.toISOString(),
          }
        : undefined,
      destinationWarehouse: transfer.destinationWarehouse
        ? {
            id: transfer.destinationWarehouse.id,
            organizationId: transfer.destinationWarehouse.organizationId,
            name: transfer.destinationWarehouse.name,
            code: transfer.destinationWarehouse.code,
            description: transfer.destinationWarehouse.description,
            addressLine1: transfer.destinationWarehouse.addressLine1,
            addressLine2: transfer.destinationWarehouse.addressLine2,
            city: transfer.destinationWarehouse.city,
            state: transfer.destinationWarehouse.state,
            postalCode: transfer.destinationWarehouse.postalCode,
            country: transfer.destinationWarehouse.country,
            status: transfer.destinationWarehouse.status,
            isDefault: transfer.destinationWarehouse.isDefault,
            createdAt: transfer.destinationWarehouse.createdAt.toISOString(),
            updatedAt: transfer.destinationWarehouse.updatedAt.toISOString(),
          }
        : undefined,
    };
  }
}
