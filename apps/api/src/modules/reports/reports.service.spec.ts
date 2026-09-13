import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, Prisma } from '@repo/database';
import { ReportsService } from './reports.service';
import { QueryReportDto, ExportReportDto } from './dto/reports-query.dto';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrisma = {
    stockLedgerEntry: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    stockBalance: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    salesOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getStockMovementReport', () => {
    it('returns paginated movements and summary totals from immutable ledger', async () => {
      mockPrisma.stockLedgerEntry.count.mockResolvedValue(1);
      mockPrisma.stockLedgerEntry.findMany.mockResolvedValue([
        {
          id: 'sle-1',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          type: 'RECEIPT',
          quantityDelta: new Prisma.Decimal('10.0000'),
          quantityBefore: new Prisma.Decimal('0.0000'),
          quantityAfter: new Prisma.Decimal('10.0000'),
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'po-1',
          createdAt: new Date('2026-09-01T10:00:00Z'),
          product: { name: 'Widget', sku: 'WID-01' },
          warehouse: { name: 'Main Facility', code: 'WH-MAIN' },
          creator: { email: 'manager@company.com' },
        },
      ]);
      mockPrisma.stockLedgerEntry.aggregate.mockImplementation(({ where }) => {
        if (where?.quantityDelta?.gt) {
          return Promise.resolve({ _sum: { quantityDelta: new Prisma.Decimal('10.0000') } });
        }
        if (where?.quantityDelta?.lt) {
          return Promise.resolve({ _sum: { quantityDelta: null } });
        }
        return Promise.resolve({ _sum: { quantityDelta: new Prisma.Decimal('10.0000') } });
      });

      const query = new QueryReportDto();
      query.page = 1;
      query.limit = 20;

      const result = await service.getStockMovementReport('org-1', query);

      expect(result.total).toBe(1);
      expect(result.items[0]?.productSku).toBe('WID-01');
      expect(result.items[0]?.quantityDelta).toBe('10.0000');
      expect(result.summary.totalIn).toBe('10.0000');
      expect(result.summary.netChange).toBe('10.0000');
    });
  });

  describe('getInventoryValuationReport', () => {
    it('computes exact cost and retail valuation from authoritative balances', async () => {
      mockPrisma.stockBalance.count.mockResolvedValue(1);
      mockPrisma.stockBalance.findMany.mockResolvedValue([
        {
          productId: 'p-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal('20.0000'),
          product: {
            name: 'Gadget',
            sku: 'GAD-01',
            unitOfMeasure: 'UNIT',
            unitCost: new Prisma.Decimal('15.0000'),
            unitPrice: new Prisma.Decimal('25.0000'),
            category: { name: 'Electronics' },
          },
          warehouse: { name: 'Warehouse 1', code: 'WH1' },
        },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total_quantity: '20.0000',
          total_cost: '300.0000',
          total_retail: '500.0000',
        },
      ]);

      const query = new QueryReportDto();
      const result = await service.getInventoryValuationReport('org-1', query);

      expect(result.total).toBe(1);
      expect(result.items[0]?.totalCostValue).toBe('300.00');
      expect(result.items[0]?.totalRetailValue).toBe('500.00');
      expect(result.items[0]?.stockStatus).toBe('IN_STOCK');
      expect(result.summary.totalCostValue).toBe('300.00');
      expect(result.summary.totalRetailValue).toBe('500.00');
    });
  });

  describe('getReconciliationReport', () => {
    it('accurately reports MATCH when StockBalance equals sum of ledger deltas', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          product_id: 'p-1',
          product_name: 'Bolt',
          product_sku: 'BLT-01',
          warehouse_id: 'wh-1',
          warehouse_name: 'Storage A',
          warehouse_code: 'STG-A',
          current_balance: '50.0000',
          ledger_sum: '50.0000',
          discrepancy: '0.0000',
          status: 'MATCH',
          last_movement_at: new Date('2026-09-10T12:00:00Z'),
          ledger_count: '5',
        },
      ]);

      const query = new QueryReportDto();
      const result = await service.getReconciliationReport('org-1', query);

      expect(result.total).toBe(1);
      expect(result.items[0]?.status).toBe('MATCH');
      expect(result.items[0]?.discrepancy).toBe('0.0000');
      expect(result.summary.totalMatches).toBe(1);
      expect(result.summary.totalDiscrepancies).toBe(0);
    });

    it('accurately reports DISCREPANCY when StockBalance does not match ledger sum', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          product_id: 'p-2',
          product_name: 'Nut',
          product_sku: 'NUT-01',
          warehouse_id: 'wh-1',
          warehouse_name: 'Storage A',
          warehouse_code: 'STG-A',
          current_balance: '60.0000',
          ledger_sum: '50.0000',
          discrepancy: '10.0000',
          status: 'DISCREPANCY',
          last_movement_at: new Date('2026-09-10T12:00:00Z'),
          ledger_count: '5',
        },
      ]);

      const query = new QueryReportDto();
      const result = await service.getReconciliationReport('org-1', query);

      expect(result.total).toBe(1);
      expect(result.items[0]?.status).toBe('DISCREPANCY');
      expect(result.items[0]?.discrepancy).toBe('10.0000');
      expect(result.summary.totalMatches).toBe(0);
      expect(result.summary.totalDiscrepancies).toBe(1);
    });
  });

  describe('exportReportCsv', () => {
    it('streams RFC 4180 CSV with correct headers and escaping', async () => {
      mockPrisma.stockLedgerEntry.count.mockResolvedValue(1);
      mockPrisma.stockLedgerEntry.findMany.mockResolvedValue([
        {
          id: 'sle-1',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          type: 'RECEIPT',
          quantityDelta: new Prisma.Decimal('5.0000'),
          quantityBefore: new Prisma.Decimal('0.0000'),
          quantityAfter: new Prisma.Decimal('5.0000'),
          referenceType: 'PO',
          referenceId: 'PO-001',
          createdAt: new Date('2026-09-01T10:00:00Z'),
          product: { name: 'Item, with comma', sku: 'SKU"1' },
          warehouse: { name: 'Main', code: 'WH-M' },
          creator: { email: 'admin@corp.com' },
        },
      ]);
      mockPrisma.stockLedgerEntry.aggregate.mockResolvedValue({
        _sum: { quantityDelta: new Prisma.Decimal('5.0000') },
      });

      const writtenChunks: string[] = [];
      const mockRes: any = {
        setHeader: jest.fn(),
        write: jest.fn((chunk: string) => {
          writtenChunks.push(chunk);
          return true;
        }),
        end: jest.fn(),
      };

      const query: ExportReportDto = {
        reportType: 'stock-movement',
        getSkip: () => 0,
        getTake: () => 5000,
      };

      await service.exportReportCsv('org-1', query, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalled();

      const fullOutput = writtenChunks.join('');
      expect(fullOutput).toContain('# Report: STOCK-MOVEMENT');
      // Product name containing comma must be properly quoted
      expect(fullOutput).toContain('"Item, with comma"');
      // SKU containing quote must be double-quoted
      expect(fullOutput).toContain('"SKU""1"');
      expect(fullOutput).toContain('TOTAL MOVEMENTS');
    });
  });
});
