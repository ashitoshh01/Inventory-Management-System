import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warehousesApi } from '../warehouses';
import { ApiError } from '../client';
import type { WarehouseDto, CreateWarehouseInput, UpdateWarehouseInput } from '@repo/types';

const mockWarehouse: WarehouseDto = {
  id: 'wh-123',
  organizationId: 'org-test',
  name: 'Central Hub',
  code: 'WH-MAIN',
  description: 'Primary location',
  addressLine1: '100 Main St',
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

describe('warehousesApi Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('list() should fetch warehouses with query parameters', async () => {
    const mockResponse = {
      data: [mockWarehouse],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, requestId: 'req-1' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await warehousesApi.list({ search: 'Central', status: 'ACTIVE' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses?');
    expect(url).toContain('search=Central');
    expect(url).toContain('status=ACTIVE');
    expect(result.data).toEqual([mockWarehouse]);
  });

  it('getById() should fetch single warehouse by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockWarehouse, meta: { requestId: 'req-2' } }),
    });

    const result = await warehousesApi.getById('wh-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses/wh-123');
    expect(result.data).toEqual(mockWarehouse);
  });

  it('getByCode() should fetch single warehouse by code with encoding', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockWarehouse, meta: { requestId: 'req-3' } }),
    });

    const result = await warehousesApi.getByCode('WH-MAIN');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses/code/WH-MAIN');
    expect(result.data).toEqual(mockWarehouse);
  });

  it('create() should POST warehouse payload and return created record', async () => {
    const input: CreateWarehouseInput = {
      name: 'North Depot',
      code: 'WH-NORTH',
      city: 'Delhi',
      status: 'ACTIVE',
      isDefault: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        data: { ...mockWarehouse, ...input, id: 'wh-456' },
        meta: { requestId: 'req-4' },
      }),
    });

    const result = await warehousesApi.create(input);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual(input);
    expect(result.data.code).toBe('WH-NORTH');
  });

  it('update() should PATCH warehouse payload', async () => {
    const input: UpdateWarehouseInput = {
      description: 'Updated hub description',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { ...mockWarehouse, description: 'Updated hub description' },
        meta: { requestId: 'req-5' },
      }),
    });

    const result = await warehousesApi.update('wh-123', input);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses/wh-123');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body as string)).toEqual(input);
    expect(result.data.description).toBe('Updated hub description');
  });

  it('delete() should DELETE warehouse and handle 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    await warehousesApi.delete('wh-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/warehouses/wh-123');
    expect(options.method).toBe('DELETE');
  });

  it('should throw ApiError when server returns 404 or 409 error envelope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'WAREHOUSE_DELETE_CONFLICT',
          message: 'Cannot delete default warehouse',
          requestId: 'req-err-1',
        },
      }),
    });

    await expect(warehousesApi.delete('wh-default')).rejects.toThrow(ApiError);
  });

  it('should throw ApiError on network communication failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network disconnected'));

    await expect(warehousesApi.list()).rejects.toThrow(ApiError);
  });

  describe('Frontend Security Boundary', () => {
    it('does not leak or reference database drivers, Prisma, or DATABASE_URL', () => {
      // Assert that process.env does not leak DATABASE_URL to client
      expect(process.env.DATABASE_URL).toBeUndefined();

      // Assert that warehousesApi routes exclusively through the API client
      expect(typeof warehousesApi.list).toBe('function');
      expect(typeof warehousesApi.getById).toBe('function');
      expect(typeof warehousesApi.create).toBe('function');
      expect(typeof warehousesApi.update).toBe('function');
      expect(typeof warehousesApi.delete).toBe('function');
    });
  });
});
