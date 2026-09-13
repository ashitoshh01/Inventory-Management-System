import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { PrismaService } from '@repo/database';
import { ImportProcessor } from './import.processor';
import { StockMutationService } from '../stock/stock-mutation.service';
import { AuditService } from '../audit/audit.service';
import { ImportJobPayload } from '@repo/types';
import { JOB_PROCESS_IMPORT } from '../queue/queue.constants';

jest.mock('fs');

describe('ImportProcessor', () => {
  let processor: ImportProcessor;
  let prisma: {
    importJob: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    category: {
      findMany: jest.Mock;
    };
    product: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    warehouse: {
      findMany: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
  };
  let stockMutationService: {
    mutateStock: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const mockJob = (data: ImportJobPayload) =>
    ({
      name: JOB_PROCESS_IMPORT,
      data,
    }) as unknown as Job<ImportJobPayload>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    prisma = {
      importJob: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'General' }]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        update: jest.fn().mockResolvedValue({ id: 'prod-1' }),
      },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: 'wh-1', code: 'WH-MAIN' }]),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    stockMutationService = {
      mutateStock: jest.fn().mockResolvedValue({
        balance: { id: 'bal-1' },
        ledgerEntry: { id: 'led-1' },
        isIdempotentReplay: false,
      }),
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: StockMutationService, useValue: stockMutationService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    processor = module.get<ImportProcessor>(ImportProcessor);
  });

  it('skips processing if job is already marked COMPLETED', async () => {
    prisma.importJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
    });

    const result = await processor.process(
      mockJob({
        importId: 'job-1',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'PRODUCT',
        filePath: '/storage/imports/test.csv',
        fileName: 'test.csv',
      }),
    );

    expect(result.success).toBe(true);
    expect(prisma.importJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PROCESSING' } }),
    );
  });

  it('successfully processes product import and creates records', async () => {
    prisma.importJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'PENDING',
    });

    (fs.readFileSync as jest.Mock).mockReturnValue('SKU,Name,Category\nPROD-100,Widget,General\n');

    const result = await processor.process(
      mockJob({
        importId: 'job-1',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'PRODUCT',
        filePath: '/storage/imports/test.csv',
        fileName: 'test.csv',
      }),
    );

    expect(result.success).toBe(true);
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          sku: 'PROD-100',
          name: 'Widget',
          categoryId: 'cat-1',
        }),
      }),
    );
    expect(auditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'product.created_via_import',
      }),
    );
    expect(prisma.importJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          successfulRows: 1,
          failedRows: 0,
        }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'IMPORT_COMPLETED',
        }),
      }),
    );
  });

  it('successfully processes stock import via StockMutationService with exact reference and idempotency', async () => {
    prisma.importJob.findFirst.mockResolvedValue({
      id: 'job-2',
      status: 'PENDING',
    });

    prisma.product.findMany.mockResolvedValue([{ id: 'p-1', sku: 'PROD-100' }]);
    prisma.warehouse.findMany.mockResolvedValue([{ id: 'wh-1', code: 'WH-MAIN' }]);

    (fs.readFileSync as jest.Mock).mockReturnValue(
      'SKU,Warehouse Code,Quantity Delta,Type,Reason\nPROD-100,WH-MAIN,25.5000,ADJUSTMENT,Stock take\n',
    );

    const result = await processor.process(
      mockJob({
        importId: 'job-2',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'STOCK',
        filePath: '/storage/imports/stock.csv',
        fileName: 'stock.csv',
      }),
    );

    expect(result.success).toBe(true);
    expect(stockMutationService.mutateStock).toHaveBeenCalledWith({
      organizationId: 'org-1',
      productId: 'p-1',
      warehouseId: 'wh-1',
      type: 'ADJUSTMENT',
      quantityDelta: '25.5000',
      idempotencyKey: 'import:job-2:row:2',
      referenceType: 'IMPORT',
      referenceId: 'job-2',
      metadata: {
        importId: 'job-2',
        fileName: 'stock.csv',
        rowNumber: 2,
        reason: 'Stock take',
      },
      actorUserId: 'user-1',
    });

    expect(prisma.importJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          successfulRows: 1,
          failedRows: 0,
        }),
      }),
    );
  });

  it('marks job PARTIALLY_COMPLETED when rows fail during stock mutation', async () => {
    prisma.importJob.findFirst.mockResolvedValue({
      id: 'job-3',
      status: 'PENDING',
    });

    prisma.product.findMany.mockResolvedValue([{ id: 'p-1', sku: 'PROD-100' }]);
    prisma.warehouse.findMany.mockResolvedValue([{ id: 'wh-1', code: 'WH-MAIN' }]);

    // Row 1 succeeds, Row 2 fails
    stockMutationService.mutateStock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Insufficient stock for mutation'));

    (fs.readFileSync as jest.Mock).mockReturnValue(
      'SKU,Warehouse Code,Quantity Delta,Type\nPROD-100,WH-MAIN,10,ADJUSTMENT\nPROD-100,WH-MAIN,-999,ISSUE\n',
    );

    const result = await processor.process(
      mockJob({
        importId: 'job-3',
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'STOCK',
        filePath: '/storage/imports/stock.csv',
        fileName: 'stock.csv',
      }),
    );

    expect(result.success).toBe(true);
    expect(prisma.importJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PARTIALLY_COMPLETED',
          successfulRows: 1,
          failedRows: 1,
        }),
      }),
    );
  });
});
