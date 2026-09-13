import { apiClient } from './client';
import type {
  PurchaseOrderDto,
  PurchaseOrderQueryParams,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  GoodsReceiptDto,
  ReceivePurchaseOrderInput,
  ProcurementMetricsDto,
  PurchaseOrderReconciliationDto,
  PurchaseOrderAuditEventDto,
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

export const purchaseOrdersApi = {
  list: (params?: PurchaseOrderQueryParams) =>
    apiClient<PurchaseOrderDto[]>(
      `/purchase-orders${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getMetrics: () => apiClient<ProcurementMetricsDto>('/purchase-orders/metrics'),

  getById: (id: string) => apiClient<PurchaseOrderDto>(`/purchase-orders/${id}`),

  create: (input: CreatePurchaseOrderInput, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient<PurchaseOrderDto>('/purchase-orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: UpdatePurchaseOrderInput) =>
    apiClient<PurchaseOrderDto>(`/purchase-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    apiClient<{ success: boolean }>(`/purchase-orders/${id}`, {
      method: 'DELETE',
    }),

  submit: (id: string) =>
    apiClient<PurchaseOrderDto>(`/purchase-orders/${id}/submit`, {
      method: 'POST',
    }),

  approve: (id: string) =>
    apiClient<PurchaseOrderDto>(`/purchase-orders/${id}/approve`, {
      method: 'POST',
    }),

  cancel: (id: string) =>
    apiClient<PurchaseOrderDto>(`/purchase-orders/${id}/cancel`, {
      method: 'POST',
    }),

  receive: (id: string, input: ReceivePurchaseOrderInput, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient<{
      order: PurchaseOrderDto;
      receipt: GoodsReceiptDto;
      isIdempotentReplay: boolean;
    }>(`/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },

  getReceipts: (id: string) => apiClient<GoodsReceiptDto[]>(`/purchase-orders/${id}/receipts`),

  getReconciliation: (id: string) =>
    apiClient<PurchaseOrderReconciliationDto>(`/purchase-orders/${id}/reconciliation`),

  getAuditTrail: (id: string) =>
    apiClient<PurchaseOrderAuditEventDto[]>(`/purchase-orders/${id}/audit-trail`),
};
