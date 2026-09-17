import { AdminDashboardService } from './admin-dashboard.service';
import { PrismaService } from '@repo/database';

describe('AdminDashboardService (Unit)', () => {
  let service: AdminDashboardService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      organization: { count: jest.fn().mockResolvedValue(5) },
      user: {
        count: jest
          .fn()
          .mockImplementation((args) => (args?.where?.isActive ? 8 : 10)),
      },
      product: { count: jest.fn().mockResolvedValue(100) },
      warehouse: { count: jest.fn().mockResolvedValue(4) },
      stockBalance: { count: jest.fn().mockResolvedValue(250) },
      purchaseOrder: { count: jest.fn().mockResolvedValue(12) },
      salesOrder: { count: jest.fn().mockResolvedValue(30) },
      stockTransfer: { count: jest.fn().mockResolvedValue(7) },
      auditEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };

    service = new AdminDashboardService(mockPrisma as unknown as PrismaService);
  });

  it('should return aggregated cross-org statistics', async () => {
    const stats = await service.getStats();

    expect(stats.totalOrganizations).toBe(5);
    expect(stats.totalUsers).toBe(10);
    expect(stats.activeUsers).toBe(8);
    expect(stats.totalProducts).toBe(100);
    expect(stats.totalWarehouses).toBe(4);
    expect(stats.totalStockEntries).toBe(250);
    expect(stats.totalPurchaseOrders).toBe(12);
    expect(stats.totalSalesOrders).toBe(30);
    expect(stats.totalTransfers).toBe(7);
  });
});
