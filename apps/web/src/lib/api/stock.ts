import { apiClient } from './client';
import type {
  StockBalanceDto,
  StockMutationResultDto,
  StockBalanceQueryParams,
  CreateStockMutationInput,
  PaginationParams,
  StockLedgerEntryDto,
  StockLedgerQueryParams,
} from '@repo/types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const stockApi = {
  listBalances: (params?: StockBalanceQueryParams) =>
    apiClient<StockBalanceDto[]>(
      `/stock/balances${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getBalanceById: (id: string) => apiClient<StockBalanceDto>(`/stock/balances/${id}`),

  getBalancesByProduct: (productId: string, params?: PaginationParams) =>
    apiClient<StockBalanceDto[]>(
      `/stock/balances/product/${productId}${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getBalancesByWarehouse: (warehouseId: string, params?: PaginationParams) =>
    apiClient<StockBalanceDto[]>(
      `/stock/balances/warehouse/${warehouseId}${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  listLedger: (params?: StockLedgerQueryParams) =>
    apiClient<StockLedgerEntryDto[]>(
      `/stock/ledger${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getLedgerById: (id: string) => apiClient<StockLedgerEntryDto>(`/stock/ledger/${id}`),

  mutate: (input: CreateStockMutationInput) => {
    const headers: Record<string, string> = {};
    if (input.idempotencyKey) {
      headers['Idempotency-Key'] = input.idempotencyKey;
    }

    return apiClient<StockMutationResultDto>('/stock/mutations', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },
};
