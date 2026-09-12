import { StockLedgerEntryType } from '@repo/types';
import { Prisma } from '@repo/database';

export interface StockBalanceFilter {
  productId?: string | undefined;
  warehouseId?: string | undefined;
}

export interface StockLedgerEntryFilter {
  productId?: string | undefined;
  warehouseId?: string | undefined;
  type?: StockLedgerEntryType | undefined;
  idempotencyKey?: string | undefined;
  limit?: number | undefined;
}

export interface CreateLedgerEntryInput {
  productId: string;
  warehouseId: string;
  quantityDelta: string | number | Prisma.Decimal;
  quantityBefore: string | number | Prisma.Decimal;
  quantityAfter: string | number | Prisma.Decimal;
  type: StockLedgerEntryType;
  referenceType?: string | null | undefined;
  referenceId?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
  createdById?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface StockMutationInput {
  organizationId: string;
  productId: string;
  warehouseId: string;
  type: StockLedgerEntryType;
  quantityDelta: string | number | Prisma.Decimal;
  idempotencyKey?: string | undefined;
  referenceType?: string | undefined;
  referenceId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  actorUserId?: string | undefined;
  requestId?: string | undefined;
}

export interface StockMutationResult {
  balance: import('@repo/types').StockBalanceDto;
  ledgerEntry: import('@repo/types').StockLedgerEntryDto;
  isIdempotentReplay: boolean;
}
