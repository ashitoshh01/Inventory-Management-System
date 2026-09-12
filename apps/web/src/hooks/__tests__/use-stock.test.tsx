import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useStockBalances,
  useStockBalance,
  useProductStock,
  useWarehouseStock,
  useStockMutation,
  stockKeys,
} from '../use-stock';
import { stockApi } from '../../lib/api/stock';
import type { StockBalanceDto, StockMutationResultDto } from '@repo/types';

const mockBalanceA: StockBalanceDto = {
  id: 'bal-orgA-1',
  organizationId: 'org-A',
  productId: 'prod-A1',
  warehouseId: 'wh-A1',
  quantity: '50.0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockMutationResultA: StockMutationResultDto = {
  balance: mockBalanceA,
  ledgerEntry: {
    id: 'led-1',
    organizationId: 'org-A',
    productId: 'prod-A1',
    warehouseId: 'wh-A1',
    quantityDelta: '10.0000',
    quantityBefore: '40.0000',
    quantityAfter: '50.0000',
    type: 'RECEIPT',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  isIdempotentReplay: false,
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useStock Query and Tenant Cache Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. organization context is represented correctly in query keys', () => {
    const keyA = stockKeys.list('org-A', { productId: 'prod-1' });
    const keyB = stockKeys.list('org-B', { productId: 'prod-1' });

    expect(keyA).toEqual(['stock', 'org-A', 'balances', 'list', { productId: 'prod-1' }]);
    expect(keyB).toEqual(['stock', 'org-B', 'balances', 'list', { productId: 'prod-1' }]);
    expect(keyA).not.toEqual(keyB);
  });

  it('2. useStockBalances fetches balances for active organization', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'listBalances').mockResolvedValue({
      data: [mockBalanceA],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'test-req' },
    });

    const { result } = renderHook(() => useStockBalances(undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.quantity).toBe('50.0000');
    expect(stockApi.listBalances).toHaveBeenCalledWith(undefined);
  });

  it('3. useStockBalance fetches single balance by id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'getBalanceById').mockResolvedValue({
      data: mockBalanceA,
      meta: { requestId: 'test-req-2' },
    });

    const { result } = renderHook(() => useStockBalance('bal-orgA-1', 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('bal-orgA-1');
    expect(stockApi.getBalanceById).toHaveBeenCalledWith('bal-orgA-1');
  });

  it('4. useProductStock fetches balances by product id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'getBalancesByProduct').mockResolvedValue({
      data: [mockBalanceA],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'test-req-3' },
    });

    const { result } = renderHook(() => useProductStock('prod-A1', undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.productId).toBe('prod-A1');
    expect(stockApi.getBalancesByProduct).toHaveBeenCalledWith('prod-A1', undefined);
  });

  it('5. useWarehouseStock fetches balances by warehouse id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'getBalancesByWarehouse').mockResolvedValue({
      data: [mockBalanceA],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'test-req-4' },
    });

    const { result } = renderHook(() => useWarehouseStock('wh-A1', undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.warehouseId).toBe('wh-A1');
    expect(stockApi.getBalancesByWarehouse).toHaveBeenCalledWith('wh-A1', undefined);
  });

  it('6. useStockMutation invalidates all stock queries on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(stockApi, 'mutate').mockResolvedValue({
      data: mockMutationResultA,
      meta: { requestId: 'test-req-5' },
    });

    const { result } = renderHook(() => useStockMutation('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        productId: 'prod-A1',
        warehouseId: 'wh-A1',
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: stockKeys.all('org-A'),
    });
  });
});
