import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useWarehouses,
  useWarehouse,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  warehouseKeys,
} from '../use-warehouses';
import { warehousesApi } from '../../lib/api/warehouses';
import type { WarehouseDto } from '@repo/types';

const mockWarehouseA: WarehouseDto = {
  id: 'wh-orgA-1',
  organizationId: 'org-A',
  name: 'Org A Central Hub',
  code: 'WH-A1',
  description: null,
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
  status: 'ACTIVE',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useWarehouses Query and Tenant Cache Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. organization context is represented correctly in query keys', () => {
    const keyA = warehouseKeys.list('org-A', { search: 'hub' });
    const keyB = warehouseKeys.list('org-B', { search: 'hub' });

    expect(keyA).toEqual(['warehouses', 'org-A', 'list', { search: 'hub' }]);
    expect(keyB).toEqual(['warehouses', 'org-B', 'list', { search: 'hub' }]);
    expect(keyA).not.toEqual(keyB);
  });

  it('2. useWarehouses fetches warehouse list for active organization', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: [mockWarehouseA],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'test-req' },
    });

    const { result } = renderHook(() => useWarehouses(undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.code).toBe('WH-A1');
    expect(warehousesApi.list).toHaveBeenCalledWith(undefined);
  });

  it('3. useWarehouse fetches single warehouse by id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(warehousesApi, 'getById').mockResolvedValue({
      data: mockWarehouseA,
      meta: { requestId: 'test-req-2' },
    });

    const { result } = renderHook(() => useWarehouse('wh-orgA-1', 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.name).toBe('Org A Central Hub');
    expect(warehousesApi.getById).toHaveBeenCalledWith('wh-orgA-1');
  });

  it('4. useCreateWarehouse invalidates warehouse list queries on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(warehousesApi, 'create').mockResolvedValue({
      data: mockWarehouseA,
      meta: { requestId: 'test-req-3' },
    });

    const { result } = renderHook(() => useCreateWarehouse('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New Depot',
        code: 'WH-NEW',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: warehouseKeys.lists('org-A'),
    });
  });

  it('5. useUpdateWarehouse invalidates both list and detail queries on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(warehousesApi, 'update').mockResolvedValue({
      data: mockWarehouseA,
      meta: { requestId: 'test-req-4' },
    });

    const { result } = renderHook(() => useUpdateWarehouse('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'wh-orgA-1',
        input: { name: 'Renamed Hub' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: warehouseKeys.lists('org-A'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: warehouseKeys.detail('org-A', 'wh-orgA-1'),
    });
  });

  it('6. useDeleteWarehouse invalidates warehouse list queries on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(warehousesApi, 'delete').mockResolvedValue({
      data: undefined as never,
      meta: { requestId: 'test-req-5' },
    });

    const { result } = renderHook(() => useDeleteWarehouse('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('wh-orgA-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: warehouseKeys.lists('org-A'),
    });
  });
});
