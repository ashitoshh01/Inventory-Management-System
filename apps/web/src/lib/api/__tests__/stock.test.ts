import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stockApi } from '../stock';
import { ApiError } from '../client';
import type {
  StockBalanceDto,
  StockMutationResultDto,
  CreateStockMutationInput,
} from '@repo/types';

const mockBalance: StockBalanceDto = {
  id: 'bal-123',
  organizationId: 'org-test',
  productId: 'prod-1',
  warehouseId: 'wh-1',
  quantity: '100.0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockMutationResult: StockMutationResultDto = {
  balance: mockBalance,
  ledgerEntry: {
    id: 'led-1',
    organizationId: 'org-test',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantityDelta: '25.0000',
    quantityBefore: '75.0000',
    quantityAfter: '100.0000',
    type: 'RECEIPT',
    idempotencyKey: 'idem-key-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  isIdempotentReplay: false,
};

describe('stockApi Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('listBalances() should fetch balances with query parameters', async () => {
    const mockResponse = {
      data: [mockBalance],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'req-1' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await stockApi.listBalances({
      productId: 'prod-1',
      warehouseId: 'wh-1',
      sortBy: 'quantity',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/balances?');
    expect(url).toContain('productId=prod-1');
    expect(url).toContain('warehouseId=wh-1');
    expect(url).toContain('sortBy=quantity');
    expect(url).toContain('sortOrder=desc');
    expect(result.data).toEqual([mockBalance]);
  });

  it('getBalanceById() should fetch a single balance by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockBalance, meta: { requestId: 'req-2' } }),
    });

    const result = await stockApi.getBalanceById('bal-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/balances/bal-123');
    expect(result.data).toEqual(mockBalance);
  });

  it('getBalancesByProduct() should fetch balances by product id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [mockBalance],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'req-3' },
      }),
    });

    const result = await stockApi.getBalancesByProduct('prod-1', { page: 2, limit: 20 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/balances/product/prod-1?');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
    expect(result.data).toEqual([mockBalance]);
  });

  it('getBalancesByWarehouse() should fetch balances by warehouse id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [mockBalance],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'req-4' },
      }),
    });

    const result = await stockApi.getBalancesByWarehouse('wh-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/balances/warehouse/wh-1');
    expect(result.data).toEqual([mockBalance]);
  });

  it('mutate() should POST stock mutation payload and include Idempotency-Key header', async () => {
    const input: CreateStockMutationInput = {
      productId: 'prod-1',
      warehouseId: 'wh-1',
      type: 'RECEIPT',
      quantityDelta: '25.0000',
      idempotencyKey: 'idem-key-1',
      referenceType: 'PO',
      referenceId: 'PO-100',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        data: mockMutationResult,
        meta: { requestId: 'req-5' },
      }),
    });

    const result = await stockApi.mutate(input);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/stock/mutations');
    expect(options.method).toBe('POST');
    const headers = options.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('idem-key-1');
    expect(JSON.parse(options.body as string)).toEqual(input);

    expect(result.data.balance.quantity).toBe('100.0000');
    expect(result.data.isIdempotentReplay).toBe(false);
  });

  it('should throw ApiError when server returns an error response envelope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock balance for issue transaction',
          requestId: 'req-err-1',
        },
      }),
    });

    await expect(
      stockApi.mutate({
        productId: 'prod-1',
        warehouseId: 'wh-1',
        type: 'ISSUE',
        quantityDelta: '-500.0000',
      }),
    ).rejects.toThrow(ApiError);
  });

  it('should throw ApiError on network communication failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network offline'));

    await expect(stockApi.listBalances()).rejects.toThrow(ApiError);
  });

  describe('Frontend Security Boundary', () => {
    it('does not leak or reference database drivers, Prisma, or DATABASE_URL', () => {
      expect(process.env.DATABASE_URL).toBeUndefined();
      expect(typeof stockApi.listBalances).toBe('function');
      expect(typeof stockApi.getBalanceById).toBe('function');
      expect(typeof stockApi.getBalancesByProduct).toBe('function');
      expect(typeof stockApi.getBalancesByWarehouse).toBe('function');
      expect(typeof stockApi.mutate).toBe('function');
    });
  });
});
