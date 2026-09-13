import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import { StockMutationService } from '../stock/stock-mutation.service';
import { SalesOrdersService } from './sales-orders.service';
import {
  SalesOrderNotFoundException,
  SalesOrderImmutableStatusException,
  SalesOrderDuplicateNumberException,
} from './sales-orders.errors';
import { CreateSalesOrderDto } from './dto/sales-order.dto';

describe('SalesOrdersService', () => {
  let service: SalesOrdersService;

  const mockPrisma: any = {
    salesOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    salesOrderLine: {
      findMany: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
    },
    warehouse: {
      findFirst: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(mockPrisma)),
    $queryRaw: jest.fn(),
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockStockMutationService = {
    mutateStockTx: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: StockMutationService, useValue: mockStockMutationService },
      ],
    }).compile();

    service = module.get<SalesOrdersService>(SalesOrdersService);
  });

  describe('create', () => {
    const dto: CreateSalesOrderDto = {
      salesOrderNumber: 'SO-100',
      customerName: 'Customer X',
      warehouseId: 'wh-1',
      lines: [{ productId: 'prod-1', quantity: '5.0000', unitPrice: '20.0000' }],
    };

    it('creates sales order with authoritative totals and audit', async () => {
      mockPrisma.salesOrder.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        name: 'Main WH',
        status: 'ACTIVE',
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Hammer', status: 'ACTIVE' },
      ]);

      const mockCreated = {
        id: 'so-1',
        organizationId: 'org-1',
        salesOrderNumber: 'SO-100',
        customerId: null,
        customerName: 'Customer X',
        customerEmail: null,
        status: 'DRAFT',
        orderDate: new Date(),
        expectedDate: null,
        warehouseId: 'wh-1',
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: 'user-1',
        approvedById: null,
        approvedAt: null,
        fulfilledById: null,
        fulfilledAt: null,
        cancelledById: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'sol-1',
            organizationId: 'org-1',
            salesOrderId: 'so-1',
            productId: 'prod-1',
            quantity: new Prisma.Decimal('5.0000'),
            unitPrice: new Prisma.Decimal('20.0000'),
            lineTotal: new Prisma.Decimal('100.0000'),
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      mockPrisma.salesOrder.create.mockResolvedValue(mockCreated);
      mockPrisma.salesOrder.findUniqueOrThrow.mockResolvedValue(mockCreated);

      const result = await service.create('org-1', dto, 'user-1');

      expect(result.order.id).toBe('so-1');
      expect(result.order.grandTotal).toBe('100.0000');
      expect(result.isIdempotentReplay).toBe(false);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sales-order.created',
          entityType: 'SalesOrder',
          entityId: 'so-1',
        }),
      );
    });

    it('rejects duplicate sales order number in organization', async () => {
      mockPrisma.salesOrder.findFirst.mockResolvedValue({ id: 'existing-so' });

      await expect(service.create('org-1', dto, 'user-1')).rejects.toThrow(
        SalesOrderDuplicateNumberException,
      );
    });
  });

  describe('fulfill', () => {
    it('locks order, deducts stock via StockMutationService, updates status to FULFILLED', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'so-1', status: 'APPROVED', warehouseId: 'wh-1', salesOrderNumber: 'SO-100' },
      ]);
      mockPrisma.salesOrderLine.findMany.mockResolvedValue([
        {
          id: 'sol-1',
          productId: 'prod-1',
          quantity: new Prisma.Decimal('5.0000'),
        },
      ]);
      mockPrisma.salesOrder.update.mockResolvedValue({
        id: 'so-1',
        organizationId: 'org-1',
        salesOrderNumber: 'SO-100',
        customerId: null,
        customerName: 'Customer X',
        customerEmail: null,
        status: 'FULFILLED',
        orderDate: new Date(),
        expectedDate: null,
        warehouseId: 'wh-1',
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: null,
        approvedById: null,
        approvedAt: null,
        fulfilledById: 'user-1',
        fulfilledAt: new Date(),
        cancelledById: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      });

      const result = await service.fulfill('org-1', 'so-1', 'user-1');

      expect(mockStockMutationService.mutateStockTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'org-1',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          type: 'ISSUE',
          quantityDelta: '-5.0000',
          referenceType: 'SALES_ORDER',
          referenceId: 'so-1',
        }),
      );
      expect(result.order.status).toBe('FULFILLED');
      expect(result.isIdempotentReplay).toBe(false);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sales-order.fulfilled',
          entityId: 'so-1',
        }),
      );
    });

    it('returns idempotent replay if already FULFILLED', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'so-1', status: 'FULFILLED', warehouseId: 'wh-1', salesOrderNumber: 'SO-100' },
      ]);
      mockPrisma.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'so-1',
        organizationId: 'org-1',
        salesOrderNumber: 'SO-100',
        customerId: null,
        customerName: 'Customer X',
        customerEmail: null,
        status: 'FULFILLED',
        orderDate: new Date(),
        expectedDate: null,
        warehouseId: 'wh-1',
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: null,
        approvedById: null,
        approvedAt: null,
        fulfilledById: 'user-1',
        fulfilledAt: new Date(),
        cancelledById: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      });

      const result = await service.fulfill('org-1', 'so-1', 'user-1');

      expect(result.isIdempotentReplay).toBe(true);
      expect(mockStockMutationService.mutateStockTx).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels an approved sales order with reason', async () => {
      mockPrisma.salesOrder.findFirst.mockResolvedValue({
        id: 'so-1',
        organizationId: 'org-1',
        status: 'APPROVED',
      });
      mockPrisma.salesOrder.update.mockResolvedValue({
        id: 'so-1',
        organizationId: 'org-1',
        salesOrderNumber: 'SO-100',
        customerId: null,
        customerName: 'Customer X',
        customerEmail: null,
        status: 'CANCELLED',
        orderDate: new Date(),
        expectedDate: null,
        warehouseId: 'wh-1',
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: null,
        approvedById: null,
        approvedAt: null,
        fulfilledById: null,
        fulfilledAt: null,
        cancelledById: 'user-1',
        cancelledAt: new Date(),
        cancellationReason: 'Customer requested cancellation',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      });

      const res = await service.cancel('org-1', 'so-1', { reason: 'Customer requested cancellation' }, 'user-1');
      expect(res.status).toBe('CANCELLED');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sales-order.cancelled' }),
      );
    });

    it('rejects cancellation of a FULFILLED sales order', async () => {
      mockPrisma.salesOrder.findFirst.mockResolvedValue({
        id: 'so-1',
        organizationId: 'org-1',
        status: 'FULFILLED',
      });

      await expect(
        service.cancel('org-1', 'so-1', { reason: 'Too late' }, 'user-1'),
      ).rejects.toThrow();
    });
  });
});
