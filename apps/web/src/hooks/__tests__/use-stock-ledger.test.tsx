import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStockLedger, useStockLedgerEntry, stockKeys } from '../use-stock';
import { stockApi } from '../../lib/api/stock';
import type { StockLedgerEntryDto } from '@repo/types';

const mockLedgerEntry: StockLedgerEntryDto = {
  id: 'led-orgA-1',
  organizationId: 'org-A',
  productId: 'prod-A1',
  warehouseId: 'wh-A1',
  quantityDelta: '20.0000',
  quantityBefore: '30.0000',
  quantityAfter: '50.0000',
  type: 'RECEIPT',
  referenceType: 'REF',
  referenceId: 'REF-001',
  metadata: { notes: 'Audit shipment' },
  idempotencyKey: 'idem-1',
  createdById: 'user-1',
  createdAt: '2026-02-01T00:00:00.000Z',
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useStockLedger Query and Tenant Cache Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. tenant organization context is isolated in ledger query keys', () => {
    const keyA = stockKeys.ledgerList('org-A', { productId: 'prod-1' });
    const keyB = stockKeys.ledgerList('org-B', { productId: 'prod-1' });

    expect(keyA).toEqual(['stock', 'org-A', 'ledger', 'list', { productId: 'prod-1' }]);
    expect(keyB).toEqual(['stock', 'org-B', 'ledger', 'list', { productId: 'prod-1' }]);
    expect(keyA).not.toEqual(keyB);

    const detailKeyA = stockKeys.ledgerDetail('org-A', 'led-1');
    const detailKeyB = stockKeys.ledgerDetail('org-B', 'led-1');
    expect(detailKeyA).toEqual(['stock', 'org-A', 'ledger', 'detail', 'led-1']);
    expect(detailKeyB).toEqual(['stock', 'org-B', 'ledger', 'detail', 'led-1']);
    expect(detailKeyA).not.toEqual(detailKeyB);
  });

  it('2. useStockLedger fetches ledger entries for active organization', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'listLedger').mockResolvedValue({
      data: [mockLedgerEntry],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'test-req-ledger' },
    });

    const { result } = renderHook(
      () => useStockLedger({ productId: 'prod-A1', type: 'RECEIPT' }, 'org-A'),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.quantityDelta).toBe('20.0000');
    expect(stockApi.listLedger).toHaveBeenCalledWith({
      productId: 'prod-A1',
      type: 'RECEIPT',
    });
  });

  it('3. useStockLedgerEntry fetches single ledger record by id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(stockApi, 'getLedgerById').mockResolvedValue({
      data: mockLedgerEntry,
      meta: { requestId: 'test-req-ledger-detail' },
    });

    const { result } = renderHook(() => useStockLedgerEntry('led-orgA-1', 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('led-orgA-1');
    expect(result.current.data?.data.quantityAfter).toBe('50.0000');
    expect(stockApi.getLedgerById).toHaveBeenCalledWith('led-orgA-1');
  });

  it('4. useStockLedgerEntry does not query when id is undefined', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const spy = vi.spyOn(stockApi, 'getLedgerById');

    const { result } = renderHook(() => useStockLedgerEntry(undefined, 'org-A'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
  });
});
