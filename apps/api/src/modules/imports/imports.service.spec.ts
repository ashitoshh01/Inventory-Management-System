import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import { PrismaService } from '@repo/database';
import { ImportsService } from './imports.service';
import { QueueService } from '../queue/queue.service';
import { ImportJobNotFoundException, ImportEmptyFileException } from './imports.errors';

jest.mock('fs');

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: {
    product: { findMany: jest.Mock };
    category: { findMany: jest.Mock };
    warehouse: { findMany: jest.Mock };
    importJob: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let queueService: {
    enqueueImport: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    prisma = {
      product: { findMany: jest.fn() },
      category: { findMany: jest.fn() },
      warehouse: { findMany: jest.fn() },
      importJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    queueService = {
      enqueueImport: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<ImportsService>(ImportsService);
  });

  describe('generatePreview', () => {
    it('throws ImportEmptyFileException for empty file', async () => {
      await expect(
        service.generatePreview('org-1', 'PRODUCT', {
          originalname: 'empty.csv',
          size: 10,
          mimetype: 'text/csv',
          buffer: Buffer.from(''),
        }),
      ).rejects.toThrow(ImportEmptyFileException);
    });

    it('correctly validates product preview and identifies duplicate SKU and unknown category', async () => {
      const csv =
        'SKU,Name,Category\nPROD-1,Item 1,Electronics\nPROD-1,Duplicate Item,Electronics\nPROD-2,Item 2,MissingCategory\nPROD-3,Item 3,Electronics';
      const file = {
        originalname: 'products.csv',
        size: csv.length,
        mimetype: 'text/csv',
        buffer: Buffer.from(csv),
      };

      prisma.product.findMany.mockResolvedValue([{ sku: 'PROD-3' }]); // PROD-3 already exists in DB
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Electronics' },
      ]);

      const result = await service.generatePreview('org-1', 'PRODUCT', file, 'CREATE');

      expect(result.totalRows).toBe(4);
      expect(result.validRows).toBe(1); // PROD-1 first row is valid
      expect(result.invalidRows).toBe(3); // PROD-1 duplicate in file, PROD-2 missing category, PROD-3 duplicate in DB
      expect(result.errors.some((e) => e.code === 'DUPLICATE_SKU_IN_FILE')).toBe(true);
      expect(result.errors.some((e) => e.code === 'CATEGORY_NOT_FOUND')).toBe(true);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_SKU_IN_DATABASE')).toBe(true);
    });

    it('correctly validates stock preview and detects unknown product or warehouse', async () => {
      const csv =
        'SKU,Warehouse Code,Quantity Delta,Type\nPROD-1,WH-MAIN,100,OPENING\nUNKNOWN-PROD,WH-MAIN,50,ADJUSTMENT\nPROD-1,UNKNOWN-WH,20,ADJUSTMENT';
      const file = {
        originalname: 'stock.csv',
        size: csv.length,
        mimetype: 'text/csv',
        buffer: Buffer.from(csv),
      };

      prisma.product.findMany.mockResolvedValue([{ id: 'p-1', sku: 'PROD-1' }]);
      prisma.warehouse.findMany.mockResolvedValue([{ id: 'w-1', code: 'WH-MAIN' }]);

      const result = await service.generatePreview('org-1', 'STOCK', file);

      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(2);
      expect(result.errors.some((e) => e.code === 'PRODUCT_NOT_FOUND')).toBe(true);
      expect(result.errors.some((e) => e.code === 'WAREHOUSE_NOT_FOUND')).toBe(true);
    });
  });

  describe('createImportJob', () => {
    it('creates DB record, saves file to storage, and enqueues BullMQ job', async () => {
      const csv = 'SKU,Name\nPROD-1,Widget';
      const file = {
        originalname: 'products.csv',
        size: csv.length,
        mimetype: 'text/csv',
        buffer: Buffer.from(csv),
      };

      prisma.importJob.create.mockResolvedValue({
        id: 'job-1',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'PRODUCT',
        status: 'PENDING',
        fileName: 'products.csv',
        fileSize: csv.length,
        totalRows: 1,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: null,
        metadata: { mode: 'CREATE', dryRun: false },
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createImportJob('org-1', 'user-1', file, { type: 'PRODUCT' });

      expect(res.id).toBe('job-1');
      expect(res.status).toBe('PENDING');
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(queueService.enqueueImport).toHaveBeenCalledWith(
        expect.objectContaining({
          importId: 'job-1',
          organizationId: 'org-1',
          userId: 'user-1',
          type: 'PRODUCT',
        }),
      );
    });
  });

  describe('getImportJob', () => {
    it('returns job if found and belongs to organization', async () => {
      prisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'PRODUCT',
        status: 'COMPLETED',
        fileName: 'file.csv',
        fileSize: 100,
        totalRows: 5,
        processedRows: 5,
        successfulRows: 5,
        failedRows: 0,
        errors: null,
        metadata: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getImportJob('org-1', 'job-1');
      expect(res.id).toBe('job-1');
      expect(res.status).toBe('COMPLETED');
    });

    it('throws ImportJobNotFoundException if job is not found in organization', async () => {
      prisma.importJob.findFirst.mockResolvedValue(null);
      await expect(service.getImportJob('org-1', 'nonexistent')).rejects.toThrow(
        ImportJobNotFoundException,
      );
    });
  });

  describe('generateErrorCsv', () => {
    it('generates formatted downloadable CSV with sanitized errors', async () => {
      prisma.importJob.findFirst.mockResolvedValue({
        id: 'job-1',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'PRODUCT',
        status: 'PARTIALLY_COMPLETED',
        fileName: 'file.csv',
        fileSize: 100,
        totalRows: 5,
        processedRows: 5,
        successfulRows: 4,
        failedRows: 1,
        errors: [
          {
            row: 3,
            column: 'sku',
            value: '=DDE_ATTACK',
            code: 'INVALID_SKU',
            message: 'Invalid characters in SKU',
          },
        ],
        metadata: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { csvString, filename } = await service.generateErrorCsv('org-1', 'job-1');

      expect(filename).toBe('import-errors-job-1.csv');
      expect(csvString).toContain('Row Number,Column,Submitted Value,Error Code,Error Message');
      // Formula injection is neutralized with leading apostrophe
      expect(csvString).toContain("'=DDE_ATTACK");
    });
  });
});
