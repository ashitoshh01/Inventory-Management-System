import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importsApi } from '../imports';
import type { ImportJobDto, ImportPreviewDto } from '@repo/types';

const mockJob: ImportJobDto = {
  id: 'job-123',
  organizationId: 'org-test',
  userId: 'user-test',
  type: 'PRODUCT',
  status: 'PENDING',
  fileName: 'products.csv',
  fileSize: 1024,
  totalRows: 10,
  processedRows: 0,
  successfulRows: 0,
  failedRows: 0,
  errors: null,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockPreview: ImportPreviewDto = {
  type: 'PRODUCT',
  fileName: 'products.csv',
  fileSize: 1024,
  totalRows: 2,
  validRows: 2,
  invalidRows: 0,
  errors: [],
  previewRows: [
    {
      rowNumber: 2,
      data: { SKU: 'P1', Name: 'Product 1' },
      isValid: true,
      errors: [],
    },
  ],
  headers: ['SKU', 'Name'],
};

describe('importsApi Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('previewImport() should post FormData with file and parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockPreview, meta: { requestId: 'req-1' } }),
    });

    const file = new File(['SKU,Name\nP1,Item'], 'products.csv', { type: 'text/csv' });
    const res = await importsApi.previewImport(file, 'PRODUCT', 'CREATE');

    expect(res.data).toEqual(mockPreview);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/imports/preview');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('createImportJob() should post FormData to create an asynchronous import job', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: mockJob, meta: { requestId: 'req-2' } }),
    });

    const file = new File(['SKU,Warehouse Code,Quantity Delta,Type,Reason'], 'stock.csv', {
      type: 'text/csv',
    });
    const res = await importsApi.createImportJob(file, 'STOCK');

    expect(res.data.id).toBe('job-123');
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/imports');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('getImportJob() should fetch import job by ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { ...mockJob, status: 'COMPLETED', successfulRows: 10 },
        meta: { requestId: 'req-3' },
      }),
    });

    const res = await importsApi.getImportJob('job-123');
    expect(res.data.status).toBe('COMPLETED');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/imports/job-123'),
      expect.any(Object),
    );
  });

  it('listImportJobs() should query import jobs with pagination and filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [mockJob],
        meta: { requestId: 'req-4', page: 1, limit: 10, total: 1 },
      }),
    });

    const res = await importsApi.listImportJobs({ page: 1, limit: 10, type: 'PRODUCT' });
    expect(res.data).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/imports?page=1&limit=10&type=PRODUCT'),
      expect.any(Object),
    );
  });

  it('downloadTemplate() should generate and download CSV template for PRODUCT and STOCK', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    // Call for PRODUCT
    importsApi.downloadTemplate('PRODUCT');
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Call for STOCK
    importsApi.downloadTemplate('STOCK');
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
  });
});
