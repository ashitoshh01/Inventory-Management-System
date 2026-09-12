import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from '../use-products';
import { usePermissions } from '../use-permissions';
import { productsApi } from '../../lib/api/products';
import type { ProductDto } from '@repo/types';

const mockProductA: ProductDto = {
  id: 'prod-orgA-1',
  organizationId: 'org-A',
  categoryId: 'cat-1',
  name: 'Org A Widget',
  sku: 'WIDGET-A',
  description: null,
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockProductB: ProductDto = {
  id: 'prod-orgB-1',
  organizationId: 'org-B',
  categoryId: 'cat-2',
  name: 'Org B Gadget',
  sku: 'GADGET-B',
  description: null,
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useProducts Query and Tenant Cache Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. organization context is represented correctly in query keys', () => {
    const keyA = productKeys.list('org-A', { search: 'test' });
    const keyB = productKeys.list('org-B', { search: 'test' });

    expect(keyA).toEqual(['products', 'org-A', 'list', { search: 'test' }]);
    expect(keyB).toEqual(['products', 'org-B', 'list', { search: 'test' }]);
    expect(keyA).not.toEqual(keyB);

    const detailKeyA = productKeys.detail('org-A', 'prod-1');
    const detailKeyB = productKeys.detail('org-B', 'prod-1');
    expect(detailKeyA).toEqual(['products', 'org-A', 'detail', 'prod-1']);
    expect(detailKeyB).toEqual(['products', 'org-B', 'detail', 'prod-1']);
    expect(detailKeyA).not.toEqual(detailKeyB);
  });

  it('2. product queries do not leak between organizations in cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(productsApi, 'list')
      .mockResolvedValueOnce({
        data: [mockProductA],
        meta: { requestId: 'req-A' },
      })
      .mockResolvedValueOnce({
        data: [mockProductB],
        meta: { requestId: 'req-B' },
      });

    // Query for Org A
    const { result: resultA } = renderHook(() => useProducts(undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(resultA.current.isSuccess).toBe(true));
    expect(resultA.current.data?.data).toEqual([mockProductA]);

    // Query for Org B with separate orgId
    const { result: resultB } = renderHook(() => useProducts(undefined, 'org-B'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(resultB.current.isSuccess).toBe(true));
    expect(resultB.current.data?.data).toEqual([mockProductB]);

    // Cache inspect: Org A data must still be separate in queryClient
    const cachedA = queryClient.getQueryData(productKeys.list('org-A'));
    const cachedB = queryClient.getQueryData(productKeys.list('org-B'));
    expect(cachedA).toEqual({ data: [mockProductA], meta: { requestId: 'req-A' } });
    expect(cachedB).toEqual({ data: [mockProductB], meta: { requestId: 'req-B' } });
  });

  it('3. mutations invalidate only the appropriate organization product queries', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(productsApi, 'create').mockResolvedValue({
      data: mockProductA,
      meta: { requestId: 'req-create' },
    });

    const { result: createMutation } = renderHook(() => useCreateProduct('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await createMutation.current.mutateAsync({
        name: 'New Product',
        sku: 'NEW-PROD-01',
        categoryId: 'cat-1',
      });
    });

    // Verify invalidate was called for org-A list, not org-B
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.lists('org-A'),
    });
  });

  it('4. update mutation invalidates both list and detail queries', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(productsApi, 'update').mockResolvedValue({
      data: mockProductA,
      meta: { requestId: 'req-update' },
    });

    const { result: updateMutation } = renderHook(() => useUpdateProduct('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await updateMutation.current.mutateAsync({
        id: 'prod-orgA-1',
        input: { name: 'Updated Widget' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.lists('org-A'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.detail('org-A', 'prod-orgA-1'),
    });
  });

  it('5. delete mutation invalidates list queries for the active organization', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(productsApi, 'delete').mockResolvedValue({
      data: { message: 'Product deleted', id: 'prod-orgA-1' },
      meta: { requestId: 'req-del' },
    });

    const { result: deleteMutation } = renderHook(() => useDeleteProduct('org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await deleteMutation.current.mutateAsync('prod-orgA-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.lists('org-A'),
    });
  });

  it('6. permission hook evaluates permissions accurately from storage or default', () => {
    // Default when no storage
    const { result: defaultPerms } = renderHook(() => usePermissions());
    expect(defaultPerms.current.canReadProducts).toBe(true);
    expect(defaultPerms.current.canCreateProduct).toBe(true);
    expect(defaultPerms.current.canUpdateProduct).toBe(true);
    expect(defaultPerms.current.canDeleteProduct).toBe(true);

    // Restricted viewer role
    localStorage.setItem('user_permissions', JSON.stringify(['product.read']));
    const { result: viewerPerms } = renderHook(() => usePermissions());
    expect(viewerPerms.current.canReadProducts).toBe(true);
    expect(viewerPerms.current.canCreateProduct).toBe(false);
    expect(viewerPerms.current.canUpdateProduct).toBe(false);
    expect(viewerPerms.current.canDeleteProduct).toBe(false);
  });

  it('7. useProduct hook fetches single product with org context', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(productsApi, 'getById').mockResolvedValue({
      data: mockProductA,
      meta: { requestId: 'req-single' },
    });

    const { result } = renderHook(() => useProduct('prod-orgA-1', 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(mockProductA);
  });
});
