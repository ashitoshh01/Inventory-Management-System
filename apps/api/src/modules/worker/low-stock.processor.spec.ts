import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { LowStockProcessor } from './low-stock.processor';
import { PrismaService } from '@repo/database';
import { JOB_CHECK_LOW_STOCK } from '../queue/queue.constants';
import type { LowStockCheckJobPayload } from '@repo/types';

describe('LowStockProcessor', () => {
  let processor: LowStockProcessor;
  let prisma: {
    stockBalance: {
      findUnique: jest.Mock;
    };
    notification: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };

  const baseJobData: LowStockCheckJobPayload = {
    productId: 'prod-1',
    warehouseId: 'wh-1',
    organizationId: 'org-1',
    quantityAfter: 5,
    threshold: 10,
    referenceId: 'ref-1',
  };

  const mockDecimal = (val: number) => ({
    toNumber: () => val,
    toString: () => val.toString(),
  });

  const mockJob = (data: LowStockCheckJobPayload) =>
    ({
      name: JOB_CHECK_LOW_STOCK,
      data,
    }) as unknown as Job<LowStockCheckJobPayload>;

  beforeEach(async () => {
    prisma = {
      stockBalance: {
        findUnique: jest.fn(),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LowStockProcessor,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    processor = module.get<LowStockProcessor>(LowStockProcessor);
  });

  it('should skip alert creation if verified balance exceeds threshold in PostgreSQL', async () => {
    prisma.stockBalance.findUnique.mockResolvedValue({
      quantity: mockDecimal(50),
      product: { status: 'ACTIVE', name: 'Widget A', sku: 'WGT-A' },
      warehouse: { name: 'Main Hub', code: 'HUB' },
    });

    const result = await processor.process(mockJob(baseJobData));

    expect(result).toEqual({ success: true, action: 'stock_normal' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should create LOW_STOCK notification when balance is positive but <= threshold', async () => {
    prisma.stockBalance.findUnique.mockResolvedValue({
      quantity: mockDecimal(4),
      product: { status: 'ACTIVE', name: 'Widget A', sku: 'WGT-A' },
      warehouse: { name: 'Main Hub', code: 'HUB' },
    });
    prisma.notification.findMany.mockResolvedValue([]); // No unread duplicate

    const result = await processor.process(mockJob(baseJobData));

    expect(result).toEqual({ success: true, action: 'created_low_stock' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        type: 'LOW_STOCK',
        title: expect.stringContaining('Low Stock Alert'),
        message: expect.stringContaining('4 units remaining'),
      }),
    });
  });

  it('should create OUT_OF_STOCK notification when verified balance is 0 or negative', async () => {
    prisma.stockBalance.findUnique.mockResolvedValue({
      quantity: mockDecimal(0),
      product: { status: 'ACTIVE', name: 'Widget A', sku: 'WGT-A' },
      warehouse: { name: 'Main Hub', code: 'HUB' },
    });
    prisma.notification.findMany.mockResolvedValue([]);

    const result = await processor.process(
      mockJob({ ...baseJobData, quantityAfter: 0 }),
    );

    expect(result).toEqual({ success: true, action: 'created_out_of_stock' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        type: 'OUT_OF_STOCK',
        title: expect.stringContaining('Out of Stock'),
      }),
    });
  });

  it('should deduplicate and skip creating a notification if an unread alert already exists', async () => {
    prisma.stockBalance.findUnique.mockResolvedValue({
      quantity: mockDecimal(3),
      product: { status: 'ACTIVE', name: 'Widget A', sku: 'WGT-A' },
      warehouse: { name: 'Main Hub', code: 'HUB' },
    });
    // Existing unread notification for the same product and warehouse
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'existing-notif',
        metadata: { productId: 'prod-1', warehouseId: 'wh-1' },
      },
    ]);

    const result = await processor.process(mockJob(baseJobData));

    expect(result).toEqual({ success: true, action: 'suppressed_duplicate' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
