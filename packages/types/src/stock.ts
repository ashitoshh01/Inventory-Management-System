import { PaginationParams } from './domain.js';

export const STOCK_LEDGER_ENTRY_TYPE_VALUES = [
  'OPENING',
  'RECEIPT',
  'ISSUE',
  'ADJUSTMENT',
] as const;

export type StockLedgerEntryType = (typeof STOCK_LEDGER_ENTRY_TYPE_VALUES)[number];

export const ALLOWED_STOCK_BALANCE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'quantity',
  'productId',
  'warehouseId',
] as const;

export type AllowedStockBalanceSortField = (typeof ALLOWED_STOCK_BALANCE_SORT_FIELDS)[number];

export const ALLOWED_STOCK_LEDGER_SORT_FIELDS = [
  'createdAt',
  'quantityDelta',
  'quantityBefore',
  'quantityAfter',
  'type',
] as const;

export type AllowedStockLedgerSortField = (typeof ALLOWED_STOCK_LEDGER_SORT_FIELDS)[number];

export interface StockBalanceDto {
  id: string;
  organizationId: string;
  productId: string;
  warehouseId: string;
  quantity: string; // Exact decimal representation formatted to 4 decimal places
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntryDto {
  id: string;
  organizationId: string;
  productId: string;
  warehouseId: string;
  quantityDelta: string;
  quantityBefore: string;
  quantityAfter: string;
  type: StockLedgerEntryType;
  referenceType?: string | null | undefined;
  referenceId?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
  createdById?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
  createdAt: string;
}

export interface StockMutationResultDto {
  balance: StockBalanceDto;
  ledgerEntry: StockLedgerEntryDto;
  isIdempotentReplay: boolean;
}

export interface StockBalanceQueryParams extends PaginationParams {
  productId?: string | undefined;
  warehouseId?: string | undefined;
  sortBy?: AllowedStockBalanceSortField | undefined;
}

export interface StockLedgerQueryParams extends PaginationParams {
  productId?: string | undefined;
  warehouseId?: string | undefined;
  type?: StockLedgerEntryType | undefined;
  sortBy?: AllowedStockLedgerSortField | undefined;
}

export interface CreateStockMutationInput {
  productId: string;
  warehouseId: string;
  type: StockLedgerEntryType;
  quantityDelta: string;
  referenceType?: string | null | undefined;
  referenceId?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}
