import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, Prisma } from '@repo/database';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    product: {
      count: jest.fn(),
    },
    stockBalance: {
      groupBy: jest.fn(),
    },
    salesOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getStats', () => {
    it('calculates authoritative summary stats including real sales today', async () => {
      mockPrisma.product.count.mockResolvedValue(25);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total_stock: '150.0000',
          total_value: '3000.0000',
          products_with_stock: '10',
          low_stock_count: '3',
          outOf_stock_count: '2',
        },
      ]);
      mockPrisma.salesOrder.aggregate.mockResolvedValue({
        _sum: { grandTotal: new Prisma.Decimal('450.5000') },
        _count: { id: 4 },
      });

      const result = await service.getStats('org-1');

      expect(result.totalProducts).toBe(25);
      expect(result.totalStock).toBe('150.0000');
      expect(result.totalInventoryValue).toBe('3000.0000');
      expect(result.lowStockCount).toBe(3);
      expect(result.todaysSales).toBe('450.50');
      expect(result.todaysOrdersCount).toBe(4);
    });

    it('handles zero sales today gracefully without fake data', async () => {
      mockPrisma.product.count.mockResolvedValue(5);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total_stock: '0',
          total_value: '0',
          products_with_stock: '0',
          low_stock_count: '0',
          outOf_stock_count: '5',
        },
      ]);
      mockPrisma.salesOrder.aggregate.mockResolvedValue({
        _sum: { grandTotal: null },
        _count: { id: 0 },
      });

      const result = await service.getStats('org-1');

      expect(result.todaysSales).toBe('0.00');
      expect(result.todaysOrdersCount).toBe(0);
    });
  });

  describe('getSalesOverview', () => {
    it('returns 7 day points comparing this week vs last week', async () => {
      mockPrisma.salesOrder.findMany.mockImplementation(({ where }) => {
        if (where.orderDate.gte && !where.orderDate.lt) {
          // This week
          return Promise.resolve([
            { orderDate: new Date(), grandTotal: new Prisma.Decimal('100.0000') },
          ]);
        }
        // Last week
        return Promise.resolve([]);
      });

      const result = await service.getSalesOverview('org-1');

      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('day');
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('thisPeriod');
      expect(result[0]).toHaveProperty('lastPeriod');
    });
  });

  describe('getTopSellingProducts', () => {
    it('queries top selling products by actual sales order lines', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'p1',
          name: 'Hammer',
          sku: 'HAM-01',
          sold_qty: '42',
          revenue: '840.00',
        },
        {
          id: 'p2',
          name: 'Nails',
          sku: 'NAIL-01',
          sold_qty: '20',
          revenue: '100.00',
        },
      ]);

      const result = await service.getTopSellingProducts('org-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'p1',
        name: 'Hammer',
        sku: 'HAM-01',
        soldQty: 42,
        revenue: '840.00',
      });
    });

    it('returns empty list when no sales orders exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getTopSellingProducts('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('getInventoryByCategory', () => {
    it('groups inventory value by category with percentages', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          category_id: 'cat-1',
          category_name: 'Tools',
          total_value: '1000',
          product_count: '5',
        },
        {
          category_id: 'cat-2',
          category_name: 'Hardware',
          total_value: '3000',
          product_count: '10',
        },
      ]);

      const result = await service.getInventoryByCategory('org-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.categoryName).toBe('Tools');
      expect(result[0]?.percentage).toBe(25);
      expect(result[1]?.categoryName).toBe('Hardware');
      expect(result[1]?.percentage).toBe(75);
    });
  });

  describe('getRecentActivities', () => {
    it('maps audit events with human-readable descriptions and actor emails', async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          action: 'sales-order.created',
          entityType: 'SalesOrder',
          entityId: 'so-1',
          actorUserId: 'u-1',
          metadata: { salesOrderNumber: 'SO-1001' },
          createdAt: new Date(),
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u-1', email: 'admin@company.com' },
      ]);

      const result = await service.getRecentActivities('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.description).toBe('Sales Order #SO-1001 created');
      expect(result[0]?.actorEmail).toBe('admin@company.com');
    });
  });
});
