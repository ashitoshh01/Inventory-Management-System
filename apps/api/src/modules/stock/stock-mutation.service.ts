import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import { StockBalanceDto, StockLedgerEntryDto } from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { StockMutationInput, StockMutationResult } from './stock.types';
import { StockQuantityValidator } from './stock.quantity';
import { QuantityUtil } from '../core/utils/quantity.util';
import {
  StockActorNotFoundException,
  StockIdempotencyConflictException,
  StockOpeningBalanceInvalidStateException,
  StockProductNotFoundException,
  StockWarehouseNotFoundException,
} from './stock.errors';

interface LockedBalanceRow {
  id: string;
  quantity: Prisma.Decimal;
}

@Injectable()
export class StockMutationService {
  private static readonly MAX_TRANSACTION_RETRIES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Executes a transactional, concurrency-safe, tenant-isolated stock mutation.
   * Atomically updates StockBalance and appends an immutable StockLedgerEntry.
   */
  async mutateStock(input: StockMutationInput): Promise<StockMutationResult> {
    // 1. Validate delta according to mutation type semantics
    const normDelta = StockQuantityValidator.validateMutationDelta(input.type, input.quantityDelta);
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;

    // 2. Pre-transaction idempotency lookup
    if (idempotencyKey) {
      const existing = await this.prisma.stockLedgerEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: input.organizationId,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        return this.handleExistingIdempotency(existing, input, normDelta);
      }
    }

    // 3. Validate tenant boundaries and entity references
    await this.validateTenantReferences(input);

    // 4. Execute atomic transaction with bounded retry on transient concurrency conflicts
    return this.executeWithRetry(async () => {
      let mutationResult: {
        balance: StockBalanceDto;
        ledgerEntry: StockLedgerEntryDto;
        isIdempotentReplay: boolean;
      };

      try {
        mutationResult = await this.prisma.$transaction(
          async (tx) => this.mutateStockTx(tx, input),
          {
            timeout: 15000,
          },
        );
      } catch (error: unknown) {
        // Handle concurrent duplicate idempotency insertion race (P2002)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          idempotencyKey
        ) {
          const raceWinner = await this.prisma.stockLedgerEntry.findUnique({
            where: {
              organizationId_idempotencyKey: {
                organizationId: input.organizationId,
                idempotencyKey,
              },
            },
          });
          if (raceWinner) {
            return this.handleExistingIdempotency(raceWinner, input, normDelta);
          }
        }
        throw error;
      }

      // 5. Emit audit event on successful transaction commit
      await this.auditService.logEvent({
        organizationId: input.organizationId,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        action: 'stock.mutated',
        entityType: 'StockBalance',
        entityId: mutationResult.balance.id,
        metadata: {
          mutationType: input.type,
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantityDelta: normDelta,
          quantityBefore: mutationResult.ledgerEntry.quantityBefore,
          quantityAfter: mutationResult.ledgerEntry.quantityAfter,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey,
        },
        ...(input.requestId ? { requestId: input.requestId } : {}),
      });

      return mutationResult;
    });
  }

  /**
   * Executes a stock mutation directly within an existing interactive transaction client.
   * Atomically locks StockBalance with FOR UPDATE, applies delta, updates balance, and appends StockLedgerEntry.
   */
  async mutateStockTx(
    tx: Prisma.TransactionClient,
    input: StockMutationInput,
  ): Promise<StockMutationResult> {
    const normDelta = StockQuantityValidator.validateMutationDelta(input.type, input.quantityDelta);
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;

    // A. Ensure StockBalance row exists safely without race condition
    await tx.$executeRaw`
      INSERT INTO "StockBalance" ("id", "organizationId", "productId", "warehouseId", "quantity", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${input.organizationId}, ${input.productId}, ${input.warehouseId}, 0, NOW(), NOW())
      ON CONFLICT ("organizationId", "productId", "warehouseId") DO NOTHING;
    `;

    // B. Acquire exclusive row lock on the StockBalance
    const lockedRows = await tx.$queryRaw<LockedBalanceRow[]>`
      SELECT id, quantity FROM "StockBalance"
      WHERE "organizationId" = ${input.organizationId}
        AND "productId" = ${input.productId}
        AND "warehouseId" = ${input.warehouseId}
      FOR UPDATE;
    `;

    if (!lockedRows || lockedRows.length === 0 || !lockedRows[0]) {
      throw new Error('Failed to acquire row lock on StockBalance');
    }

    const lockedBalance = lockedRows[0];
    const currentQuantityStr = lockedBalance.quantity.toFixed(StockQuantityValidator.MAX_SCALE);

    // C. Validate OPENING stock invariants
    if (input.type === 'OPENING') {
      if (!QuantityUtil.isZero(currentQuantityStr)) {
        throw new StockOpeningBalanceInvalidStateException(
          `Opening stock can only be established on a zero balance; current balance is ${currentQuantityStr}`,
        );
      }

      const priorHistoryCount = await tx.stockLedgerEntry.count({
        where: {
          organizationId: input.organizationId,
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      });

      if (priorHistoryCount > 0) {
        throw new StockOpeningBalanceInvalidStateException(
          'Opening stock cannot be applied because ledger history already exists for this balance',
        );
      }
    }

    // D. Calculate new quantity and assert non-negative invariant
    const newQuantityStr = StockQuantityValidator.calculateNewQuantity(
      currentQuantityStr,
      normDelta,
    );
    StockQuantityValidator.assertNonNegative(newQuantityStr);

    // E. Update StockBalance with new quantity
    const updatedBalance = await tx.stockBalance.update({
      where: { id: lockedBalance.id },
      data: {
        quantity: new Prisma.Decimal(newQuantityStr),
      },
    });

    // F. Insert immutable StockLedgerEntry
    const createdLedger = await tx.stockLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantityBefore: new Prisma.Decimal(currentQuantityStr),
        quantityDelta: new Prisma.Decimal(normDelta),
        quantityAfter: new Prisma.Decimal(newQuantityStr),
        type: input.type,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: idempotencyKey ?? null,
        createdById: input.actorUserId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    return {
      balance: this.mapBalanceToDto(updatedBalance),
      ledgerEntry: this.mapLedgerEntryToDto(createdLedger),
      isIdempotentReplay: false,
    };
  }

  /**
   * Evaluates an existing ledger entry matching the idempotency key.
   * Replays if payload matches; throws conflict exception if payload differs.
   */
  private async handleExistingIdempotency(
    existing: {
      id: string;
      organizationId: string;
      productId: string;
      warehouseId: string;
      quantityDelta: Prisma.Decimal;
      quantityBefore: Prisma.Decimal;
      quantityAfter: Prisma.Decimal;
      type: string;
      referenceType: string | null;
      referenceId: string | null;
      idempotencyKey: string | null;
      createdById: string | null;
      metadata: Prisma.JsonValue;
      createdAt: Date;
    },
    input: StockMutationInput,
    normDelta: string,
  ): Promise<StockMutationResult> {
    const isMatching =
      existing.productId === input.productId &&
      existing.warehouseId === input.warehouseId &&
      existing.type === input.type &&
      existing.quantityDelta.toFixed(StockQuantityValidator.MAX_SCALE) === normDelta &&
      (existing.referenceType || undefined) === (input.referenceType || undefined) &&
      (existing.referenceId || undefined) === (input.referenceId || undefined);

    if (!isMatching) {
      throw new StockIdempotencyConflictException(
        `Idempotency key "${input.idempotencyKey}" was previously used with different mutation parameters`,
      );
    }

    const currentBalance = await this.prisma.stockBalance.findUnique({
      where: {
        organizationId_productId_warehouseId: {
          organizationId: input.organizationId,
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });

    if (!currentBalance) {
      throw new Error('Corrupt state: ledger entry exists without StockBalance');
    }

    return {
      balance: this.mapBalanceToDto(currentBalance),
      ledgerEntry: this.mapLedgerEntryToDto(existing),
      isIdempotentReplay: true,
    };
  }

  /**
   * Validates that the organization, product, warehouse, and actor are valid,
   * active, and belong to the specified organization.
   */
  private async validateTenantReferences(input: StockMutationInput): Promise<void> {
    // 1. Verify organization exists and is active
    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, isActive: true },
    });
    if (!org || !org.isActive) {
      throw new StockProductNotFoundException('Organization not found or inactive');
    }

    // 2. Verify product exists in tenant and is active
    const product = await this.prisma.product.findFirst({
      where: {
        id: input.productId,
        organizationId: input.organizationId,
      },
      select: { id: true, status: true },
    });
    if (!product || product.status !== 'ACTIVE') {
      throw new StockProductNotFoundException(
        'Product does not exist in this organization or is inactive',
      );
    }

    // 3. Verify warehouse exists in tenant and is active
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: input.warehouseId,
        organizationId: input.organizationId,
      },
      select: { id: true, status: true },
    });
    if (!warehouse || warehouse.status !== 'ACTIVE') {
      throw new StockWarehouseNotFoundException(
        'Warehouse does not exist in this organization or is inactive',
      );
    }

    // 4. Verify actor belongs to organization if provided
    if (input.actorUserId) {
      const membership = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: input.actorUserId,
          organizationId: input.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!membership) {
        throw new StockActorNotFoundException('Actor user does not belong to this organization');
      }
    }
  }

  /**
   * Retries transient PostgreSQL transaction conflicts (serialization errors, deadlocks).
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= StockMutationService.MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        const isTransient = this.isTransientConcurrencyError(error);
        if (isTransient && attempt < StockMutationService.MAX_TRANSACTION_RETRIES) {
          const delayMs = attempt * 20 + Math.floor(Math.random() * 20);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private isTransientConcurrencyError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2034: Transaction failed due to a write conflict or deadlock
      if (error.code === 'P2034') return true;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String((error as { message: unknown }).message);
      if (msg.includes('40001') || msg.includes('40P01') || msg.includes('deadlock detected')) {
        return true;
      }
    }

    return false;
  }

  private mapBalanceToDto(balance: {
    id: string;
    organizationId: string;
    productId: string;
    warehouseId: string;
    quantity: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): StockBalanceDto {
    return {
      id: balance.id,
      organizationId: balance.organizationId,
      productId: balance.productId,
      warehouseId: balance.warehouseId,
      quantity: balance.quantity.toFixed(StockQuantityValidator.MAX_SCALE),
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  private mapLedgerEntryToDto(entry: {
    id: string;
    organizationId: string;
    productId: string;
    warehouseId: string;
    quantityDelta: Prisma.Decimal;
    quantityBefore: Prisma.Decimal;
    quantityAfter: Prisma.Decimal;
    type: string;
    referenceType: string | null;
    referenceId: string | null;
    idempotencyKey: string | null;
    createdById: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): StockLedgerEntryDto {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      productId: entry.productId,
      warehouseId: entry.warehouseId,
      quantityDelta: entry.quantityDelta.toFixed(StockQuantityValidator.MAX_SCALE),
      quantityBefore: entry.quantityBefore.toFixed(StockQuantityValidator.MAX_SCALE),
      quantityAfter: entry.quantityAfter.toFixed(StockQuantityValidator.MAX_SCALE),
      type: entry.type as StockLedgerEntryDto['type'],
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      idempotencyKey: entry.idempotencyKey,
      createdById: entry.createdById,
      metadata: entry.metadata as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
