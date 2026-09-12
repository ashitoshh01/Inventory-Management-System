import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaService } from '@repo/database';
import { StockFoundationService } from './stock-foundation.service';
import { QueryStockBalanceDto, QueryStockLedgerDto } from './dto/stock.dto';
import { StockProductNotFoundException, StockWarehouseNotFoundException } from './stock.errors';

describe('StockFoundationService Query Methods (Unit)', () => {
  let service: StockFoundationService;
  let prisma: {
    stockBalance: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    stockLedgerEntry: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    product: {
      findFirst: jest.Mock;
    };
    warehouse: {
      findFirst: jest.Mock;
    };
  };

  const orgId = 'org-uuid-1';
  const prodId = 'prod-uuid-1';
  const whId = 'wh-uuid-1';

  beforeEach(async () => {
    prisma = {
      stockBalance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      stockLedgerEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockFoundationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StockFoundationService>(StockFoundationService);
  });

  describe('findById', () => {
    it('returns formatted DTO when balance exists within tenant', async () => {
      prisma.stockBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        quantity: new Prisma.Decimal('100.2500'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.findById(orgId, 'bal-1');

      expect(prisma.stockBalance.findFirst).toHaveBeenCalledWith({
        where: { id: 'bal-1', organizationId: orgId },
      });
      expect(result).not.toBeNull();
      expect(result?.quantity).toBe('100.2500');
    });

    it('returns null when balance does not exist or belongs to another tenant', async () => {
      prisma.stockBalance.findFirst.mockResolvedValue(null);

      const result = await service.findById(orgId, 'cross-org-bal');

      expect(result).toBeNull();
    });
  });

  describe('findPaginatedBalances', () => {
    it('returns paginated stock balances with applied filters and sort', async () => {
      const query = new QueryStockBalanceDto();
      query.page = 1;
      query.limit = 10;
      query.productId = prodId;
      query.sortBy = 'quantity';
      query.sortOrder = 'asc';

      prisma.stockBalance.count.mockResolvedValue(1);
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'bal-1',
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          quantity: new Prisma.Decimal('50.0000'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.findPaginatedBalances(orgId, query, 'req-1');

      expect(prisma.stockBalance.count).toHaveBeenCalledWith({
        where: { organizationId: orgId, productId: prodId },
      });
      expect(prisma.stockBalance.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, productId: prodId },
        skip: 0,
        take: 10,
        orderBy: { quantity: 'asc' },
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.quantity).toBe('50.0000');
      expect(result.meta.total).toBe(1);
      expect(result.meta.requestId).toBe('req-1');
    });
  });

  describe('findByProduct', () => {
    it('returns balances for existing product in active tenant', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: prodId });
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'bal-1',
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          quantity: new Prisma.Decimal('75.0000'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findByProduct(orgId, prodId);

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: prodId, organizationId: orgId },
        select: { id: true },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.quantity).toBe('75.0000');
    });

    it('throws StockProductNotFoundException if product not found in tenant', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findByProduct(orgId, 'missing-prod')).rejects.toThrow(
        StockProductNotFoundException,
      );
    });
  });

  describe('findByWarehouse', () => {
    it('returns balances for existing warehouse in active tenant', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({ id: whId });
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'bal-1',
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          quantity: new Prisma.Decimal('120.0000'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findByWarehouse(orgId, whId);

      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: whId, organizationId: orgId },
        select: { id: true },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.quantity).toBe('120.0000');
    });

    it('throws StockWarehouseNotFoundException if warehouse not found in tenant', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.findByWarehouse(orgId, 'missing-wh')).rejects.toThrow(
        StockWarehouseNotFoundException,
      );
    });
  });

  describe('findPaginatedLedger', () => {
    it('returns paginated ledger history with applied filters and sort', async () => {
      const query = new QueryStockLedgerDto();
      query.page = 1;
      query.limit = 20;
      query.type = 'RECEIPT';
      query.sortBy = 'createdAt';
      query.sortOrder = 'desc';

      prisma.stockLedgerEntry.count.mockResolvedValue(1);
      prisma.stockLedgerEntry.findMany.mockResolvedValue([
        {
          id: 'led-1',
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          quantityDelta: new Prisma.Decimal('10.0000'),
          quantityBefore: new Prisma.Decimal('0.0000'),
          quantityAfter: new Prisma.Decimal('10.0000'),
          type: 'RECEIPT',
          referenceType: 'PO',
          referenceId: 'PO-1',
          idempotencyKey: 'ID-1',
          createdById: 'user-1',
          metadata: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.findPaginatedLedger(orgId, query, 'req-2');

      expect(prisma.stockLedgerEntry.count).toHaveBeenCalledWith({
        where: { organizationId: orgId, type: 'RECEIPT' },
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.type).toBe('RECEIPT');
      expect(result.meta.requestId).toBe('req-2');
    });
  });

  describe('findLedgerById', () => {
    it('returns formatted DTO when ledger entry exists within tenant', async () => {
      prisma.stockLedgerEntry.findFirst.mockResolvedValue({
        id: 'led-1',
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        quantityDelta: new Prisma.Decimal('15.0000'),
        quantityBefore: new Prisma.Decimal('10.0000'),
        quantityAfter: new Prisma.Decimal('25.0000'),
        type: 'RECEIPT',
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        createdById: null,
        metadata: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.findLedgerById(orgId, 'led-1');

      expect(prisma.stockLedgerEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'led-1', organizationId: orgId },
      });
      expect(result).not.toBeNull();
      expect(result?.quantityDelta).toBe('15.0000');
    });

    it('returns null when ledger entry does not exist or belongs to another tenant', async () => {
      prisma.stockLedgerEntry.findFirst.mockResolvedValue(null);

      const result = await service.findLedgerById(orgId, 'cross-org-ledger');

      expect(result).toBeNull();
    });
  });
});
