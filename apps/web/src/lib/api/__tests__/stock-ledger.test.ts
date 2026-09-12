import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stockApi } from '../stock';
import { ApiError } from '../client';
import type { StockLedgerEntryDto } from '@repo/types';

const mockLedgerEntry1: StockLedgerEntryDto = {
  id: 'led-11111111-1111-4111-8111-111111111111',
  organizationId: 'org-test',
  productId: 'prod-11111111-1111-4111-8111-111111111111',
  warehouseId: 'wh-11111111-1111-4111-8111-111111111111',
  quantityDelta: '25.5000',
  quantityBefore: '74.5000',
  quantityAfter: '100.0000',
  type: 'RECEIPT',
  referenceType: 'PO',
  referenceId: 'PO-98765',
  metadata: { notes: 'Restock shipment' },
  idempotencyKey: 'idem-ledger-1',
  createdById: 'usr-1',
  createdAt: '2026-02-01T10:00:00.000Z',
};

const mockLedgerEntry2: StockLedgerEntryDto = {
  id: 'led-22222222-2222-4222-8222-222222222222',
  organizationId: 'org-test',
  productId: 'prod-11111111-1111-4111-8111-111111111111',
  warehouseId: 'wh-11111111-1111-4111-8111-111111111111',
  quantityDelta: '-15.2500',
  quantityBefore: '100.0000',
  quantityAfter: '84.7500',
  type: 'ISSUE',
  referenceType: 'SO',
  referenceId: 'SO-12345',
  metadata: { notes: 'Customer dispatch' },
  idempotencyKey: 'idem-ledger-2',
  createdById: null,
  createdAt: '2026-02-02T14:30:00.000Z',
};

describe('stockApi Ledger Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('1. listLedger() serializes query parameters correctly', async () => {
    const mockResponse = {
      data: [mockLedgerEntry1, mockLedgerEntry2],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1, requestId: 'req-ledger-1' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await stockApi.listLedger({
      productId: 'prod-11111111-1111-4111-8111-111111111111',
      warehouseId: 'wh-11111111-1111-4111-8111-111111111111',
      type: 'RECEIPT',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/ledger?');
    expect(url).toContain('productId=prod-11111111-1111-4111-8111-111111111111');
    expect(url).toContain('warehouseId=wh-11111111-1111-4111-8111-111111111111');
    expect(url).toContain('type=RECEIPT');
    expect(url).toContain('sortBy=createdAt');
    expect(url).toContain('sortOrder=desc');
    expect(result.data).toEqual([mockLedgerEntry1, mockLedgerEntry2]);
  });

  it('2. listLedger() supports empty parameters and returns all entries', async () => {
    const mockResponse = {
      data: [mockLedgerEntry1],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'req-ledger-2' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await stockApi.listLedger();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/api/v1/stock/ledger');
    expect(result.data).toHaveLength(1);
  });

  it('3. getLedgerById() fetches a single ledger entry by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockLedgerEntry1, meta: { requestId: 'req-ledger-3' } }),
    });

    const result = await stockApi.getLedgerById('led-11111111-1111-4111-8111-111111111111');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/ledger/led-11111111-1111-4111-8111-111111111111');
    expect(result.data).toEqual(mockLedgerEntry1);
  });

  it('4. preserves exact decimal string representations without float precision loss', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockLedgerEntry2, meta: { requestId: 'req-ledger-4' } }),
    });

    const result = await stockApi.getLedgerById('led-22222222-2222-4222-8222-222222222222');

    expect(typeof result.data.quantityDelta).toBe('string');
    expect(result.data.quantityDelta).toBe('-15.2500');
    expect(typeof result.data.quantityBefore).toBe('string');
    expect(result.data.quantityBefore).toBe('100.0000');
    expect(typeof result.data.quantityAfter).toBe('string');
    expect(result.data.quantityAfter).toBe('84.7500');
  });

  it('5. handles 404 not found error correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 'LEDGER_ENTRY_NOT_FOUND',
          message: 'Stock ledger entry not found',
          requestId: 'err-req-1',
        },
      }),
    });

    await expect(stockApi.getLedgerById('non-existent-id')).rejects.toThrow(ApiError);
  });

  it('6. verifies database url is not present in frontend environment (architectural boundary)', () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
