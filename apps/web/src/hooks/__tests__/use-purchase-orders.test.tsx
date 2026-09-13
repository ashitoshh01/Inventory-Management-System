import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  purchaseOrderKeys,
} from '../use-purchase-orders';
import { purchaseOrdersApi } from '../../lib/api/purchase-orders';
import type { PurchaseOrderDto } from '@repo/types';

const mockOrder: PurchaseOrderDto = {
  id: 'po-1',
  organizationId: 'org-A',
  purchaseOrderNumber: 'PO-2026-001',
  supplierName: 'Acme Supplies',
  status: 'DRAFT',
  orderDate: '2026-10-01T00:00:00.000Z',
  warehouseId: 'wh-1',
  currency: 'USD',
  subtotal: '100.0000',
  taxTotal: '0.0000',
  grandTotal: '100.0000',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  lines: [],
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('usePurchaseOrders Hooks and Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. organization context is strictly represented in query keys', () => {
    const keyOrgA = purchaseOrderKeys.list('org-A', { status: 'DRAFT' });
    const keyOrgB = purchaseOrderKeys.list('org-B', { status: 'DRAFT' });

    expect(keyOrgA).toEqual(['purchase-orders', 'org-A', 'list', { status: 'DRAFT' }]);
    expect(keyOrgB).toEqual(['purchase-orders', 'org-B', 'list', { status: 'DRAFT' }]);
    expect(keyOrgA).not.toEqual(keyOrgB);

    const detailKeyA = purchaseOrderKeys.detail('org-A', 'po-1');
    const detailKeyB = purchaseOrderKeys.detail('org-B', 'po-1');
    expect(detailKeyA).toEqual(['purchase-orders', 'org-A', 'detail', 'po-1']);
    expect(detailKeyB).toEqual(['purchase-orders', 'org-B', 'detail', 'po-1']);
    expect(detailKeyA).not.toEqual(detailKeyB);
  });

  it('2. usePurchaseOrders fetches paginated purchase orders list', async () => {
    vi.spyOn(purchaseOrdersApi, 'list').mockResolvedValueOnce({
      data: [mockOrder],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'req-1',
      },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePurchaseOrders({ page: 1, limit: 10 }, 'org-A'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.purchaseOrderNumber).toBe('PO-2026-001');
  });

  it('3. usePurchaseOrder fetches order by id', async () => {
    vi.spyOn(purchaseOrdersApi, 'getById').mockResolvedValueOnce({
      data: mockOrder,
      meta: { requestId: 'req-2' },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePurchaseOrder('po-1', 'org-A'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('po-1');
    expect(result.current.data?.data.supplierName).toBe('Acme Supplies');
  });

  it('4. useCreatePurchaseOrder invalidates purchase order list queries on success', async () => {
    localStorage.setItem('activeOrganizationId', 'org-A');
    vi.spyOn(purchaseOrdersApi, 'create').mockResolvedValueOnce({
      data: mockOrder,
      meta: { requestId: 'req-3' },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePurchaseOrder(), {
      wrapper: createWrapper(client),
    });

    await result.current.mutateAsync({
      input: {
        purchaseOrderNumber: 'PO-2026-001',
        warehouseId: 'wh-1',
        supplierName: 'Acme Supplies',
        lines: [{ productId: 'prod-1', quantity: '1.0000', unitPrice: '10.0000' }],
      },
      idempotencyKey: 'key-1',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'list'],
    });
  });

  it('5. useSubmitPurchaseOrder invalidates detail and list queries', async () => {
    localStorage.setItem('activeOrganizationId', 'org-A');
    vi.spyOn(purchaseOrdersApi, 'submit').mockResolvedValueOnce({
      data: { ...mockOrder, status: 'SUBMITTED' },
      meta: { requestId: 'req-4' },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitPurchaseOrder(), {
      wrapper: createWrapper(client),
    });

    await result.current.mutateAsync('po-1');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'detail', 'po-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'list'],
    });
  });

  it('6. useDeletePurchaseOrder removes detail cache and invalidates list', async () => {
    localStorage.setItem('activeOrganizationId', 'org-A');
    vi.spyOn(purchaseOrdersApi, 'delete').mockResolvedValueOnce({
      data: { success: true },
      meta: { requestId: 'req-5' },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const removeSpy = vi.spyOn(client, 'removeQueries');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeletePurchaseOrder(), {
      wrapper: createWrapper(client),
    });

    await result.current.mutateAsync('po-1');

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'detail', 'po-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'list'],
    });
  });

  it('7. useUpdatePurchaseOrder, useApprovePurchaseOrder, useCancelPurchaseOrder invalidate cache correctly', async () => {
    localStorage.setItem('activeOrganizationId', 'org-A');
    vi.spyOn(purchaseOrdersApi, 'update').mockResolvedValueOnce({
      data: mockOrder,
      meta: { requestId: 'req-6' },
    });
    vi.spyOn(purchaseOrdersApi, 'approve').mockResolvedValueOnce({
      data: { ...mockOrder, status: 'APPROVED' },
      meta: { requestId: 'req-7' },
    });
    vi.spyOn(purchaseOrdersApi, 'cancel').mockResolvedValueOnce({
      data: { ...mockOrder, status: 'CANCELLED' },
      meta: { requestId: 'req-8' },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result: updateHook } = renderHook(() => useUpdatePurchaseOrder(), {
      wrapper: createWrapper(client),
    });
    await updateHook.current.mutateAsync({ id: 'po-1', input: { supplierName: 'Updated' } });

    const { result: approveHook } = renderHook(() => useApprovePurchaseOrder(), {
      wrapper: createWrapper(client),
    });
    await approveHook.current.mutateAsync('po-1');

    const { result: cancelHook } = renderHook(() => useCancelPurchaseOrder(), {
      wrapper: createWrapper(client),
    });
    await cancelHook.current.mutateAsync('po-1');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'detail', 'po-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['purchase-orders', 'org-A', 'list'],
    });
  });
});
