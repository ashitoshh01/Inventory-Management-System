import { apiClient } from './client';
import type {
  StockTransferDto,
  StockTransferQueryParams,
  CreateStockTransferInput,
  UpdateStockTransferInput,
  StockTransferMetricsDto,
  StockTransferAuditEventDto,
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

export const transfersApi = {
  list: (params?: StockTransferQueryParams) =>
    apiClient<StockTransferDto[]>(
      `/transfers${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getMetrics: () => apiClient<StockTransferMetricsDto>('/transfers/metrics'),

  getById: (id: string) => apiClient<StockTransferDto>(`/transfers/${id}`),

  create: (input: CreateStockTransferInput, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient<StockTransferDto>('/transfers', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: UpdateStockTransferInput) =>
    apiClient<StockTransferDto>(`/transfers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    apiClient<{ success: boolean }>(`/transfers/${id}`, {
      method: 'DELETE',
    }),

  approve: (id: string) =>
    apiClient<StockTransferDto>(`/transfers/${id}/approve`, {
      method: 'POST',
    }),

  ship: (id: string, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient<StockTransferDto>(`/transfers/${id}/ship`, {
      method: 'POST',
      headers,
    });
  },

  receive: (id: string, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient<StockTransferDto>(`/transfers/${id}/receive`, {
      method: 'POST',
      headers,
    });
  },

  cancel: (id: string, reason?: string) =>
    apiClient<StockTransferDto>(`/transfers/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getAuditTrail: (id: string) =>
    apiClient<StockTransferAuditEventDto[]>(`/transfers/${id}/audit-trail`),
};
