import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import { PurchaseOrdersFoundationService } from './purchase-orders-foundation.service';
import {
  PurchaseOrderCannotDeleteException,
  PurchaseOrderInvalidTransitionException,
  PurchaseOrderNotFoundException,
  PurchaseOrderProductNotFoundException,
  PurchaseOrderWarehouseNotFoundException,
} from './purchase-orders.errors';

describe('PurchaseOrdersFoundationService (Unit)', () => {
  let service: PurchaseOrdersFoundationService;
  let prisma: {
    purchaseOrder: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    purchaseOrderLine: {
      createMany: jest.Mock;
    };
    warehouse: {
      findFirst: jest.Mock;
    };
    product: {
      findMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const orgId = 'org-uuid-1';
  const warehouseId = 'wh-uuid-1';
  const productId = 'prod-uuid-1';
  const userId = 'user-uuid-1';

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      purchaseOrderLine: {
        createMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(prisma);
      }),
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersFoundationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PurchaseOrdersFoundationService>(PurchaseOrdersFoundationService);
  });

  describe('create', () => {
    const input = {
      purchaseOrderNumber: 'PO-2026-001',
      supplierName: 'Acme Supplies',
      warehouseId,
      lines: [
        {
          productId,
          quantity: '10.0000',
          unitPrice: '20.0000',
        },
      ],
    };

    it('throws PurchaseOrderWarehouseNotFoundException when warehouse is missing in tenant', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.create(orgId, input, userId)).rejects.toThrow(
        PurchaseOrderWarehouseNotFoundException,
      );
    });

    it('throws PurchaseOrderProductNotFoundException when product is missing in tenant', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({ id: warehouseId });
      prisma.product.findMany.mockResolvedValue([]); // No matching product

      await expect(service.create(orgId, input, userId)).rejects.toThrow(
        PurchaseOrderProductNotFoundException,
      );
    });

    it('successfully creates purchase order and lines within transaction and logs audit event', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({ id: warehouseId });
      prisma.product.findMany.mockResolvedValue([{ id: productId }]);

      const createdPO = {
        id: 'po-uuid-1',
        organizationId: orgId,
        purchaseOrderNumber: 'PO-2026-001',
        supplierName: 'Acme Supplies',
        supplierEmail: null,
        status: 'DRAFT' as const,
        orderDate: new Date('2026-09-15T00:00:00.000Z'),
        expectedDate: null,
        warehouseId,
        currency: 'INR',
        subtotal: new Prisma.Decimal('200.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('200.0000'),
        notes: null,
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-09-15T00:00:00.000Z'),
        updatedAt: new Date('2026-09-15T00:00:00.000Z'),
        lines: [
          {
            id: 'line-uuid-1',
            organizationId: orgId,
            purchaseOrderId: 'po-uuid-1',
            productId,
            quantity: new Prisma.Decimal('10.0000'),
            unitPrice: new Prisma.Decimal('20.0000'),
            lineTotal: new Prisma.Decimal('200.0000'),
            receivedQuantity: new Prisma.Decimal('0.0000'),
            notes: null,
            createdAt: new Date('2026-09-15T00:00:00.000Z'),
            updatedAt: new Date('2026-09-15T00:00:00.000Z'),
          },
        ],
      };

      prisma.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const txMock = {
            purchaseOrder: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'po-uuid-1' }),
              findUniqueOrThrow: jest.fn().mockResolvedValue(createdPO),
            },
            purchaseOrderLine: {
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          };
          return callback(txMock);
        },
      );

      const result = await service.create(orgId, input, userId);

      expect(result.id).toBe('po-uuid-1');
      expect(result.purchaseOrderNumber).toBe('PO-2026-001');
      expect(result.subtotal).toBe('200.0000');
      expect(result.grandTotal).toBe('200.0000');
      expect(result.lines).toHaveLength(1);
      expect(result.lines?.[0]?.lineTotal).toBe('200.0000');

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          action: 'PURCHASE_ORDER_CREATED',
          entityType: 'PurchaseOrder',
          entityId: 'po-uuid-1',
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns null when purchase order does not exist in tenant', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      const result = await service.findById(orgId, 'non-existent');
      expect(result).toBeNull();
    });

    it('returns mapped DTO when purchase order exists', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-uuid-1',
        organizationId: orgId,
        purchaseOrderNumber: 'PO-001',
        supplierName: 'Supplier 1',
        supplierEmail: 'sup@test.com',
        status: 'DRAFT',
        orderDate: new Date('2026-09-15T00:00:00.000Z'),
        expectedDate: null,
        warehouseId,
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-09-15T00:00:00.000Z'),
        updatedAt: new Date('2026-09-15T00:00:00.000Z'),
        lines: [],
      });

      const result = await service.findById(orgId, 'po-uuid-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('po-uuid-1');
      expect(result?.purchaseOrderNumber).toBe('PO-001');
    });
  });

  describe('transitionStatus', () => {
    it('throws PurchaseOrderNotFoundException when purchase order does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.transitionStatus(orgId, 'non-existent', 'SUBMITTED')).rejects.toThrow(
        PurchaseOrderNotFoundException,
      );
    });

    it('throws PurchaseOrderInvalidTransitionException on illegal status transition', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'po-uuid-1',
          organizationId: orgId,
          status: 'RECEIVED',
          purchaseOrderNumber: 'PO-001',
        },
      ]);

      await expect(service.transitionStatus(orgId, 'po-uuid-1', 'DRAFT')).rejects.toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('successfully transitions from DRAFT to SUBMITTED and logs audit event', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'po-uuid-1',
          organizationId: orgId,
          purchaseOrderNumber: 'PO-001',
          supplierName: 'Supplier',
          status: 'DRAFT',
        },
      ]);

      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-uuid-1',
        organizationId: orgId,
        purchaseOrderNumber: 'PO-001',
        supplierName: 'Supplier',
        status: 'SUBMITTED',
        orderDate: new Date('2026-09-15T00:00:00.000Z'),
        expectedDate: null,
        warehouseId,
        currency: 'INR',
        subtotal: new Prisma.Decimal('100.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('100.0000'),
        notes: null,
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-09-15T00:00:00.000Z'),
        updatedAt: new Date('2026-09-15T00:00:00.000Z'),
        lines: [],
      });

      const result = await service.transitionStatus(orgId, 'po-uuid-1', 'SUBMITTED', userId);
      expect(result.status).toBe('SUBMITTED');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PURCHASE_ORDER_STATUS_CHANGED',
          entityType: 'PurchaseOrder',
          metadata: expect.objectContaining({
            fromStatus: 'DRAFT',
            toStatus: 'SUBMITTED',
          }),
        }),
      );
    });
  });

  describe('deleteDraft', () => {
    it('throws PurchaseOrderCannotDeleteException when PO is not DRAFT', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'po-uuid-1',
          organizationId: orgId,
          status: 'SUBMITTED',
          purchaseOrderNumber: 'PO-001',
        },
      ]);

      await expect(service.deleteDraft(orgId, 'po-uuid-1', userId)).rejects.toThrow(
        PurchaseOrderCannotDeleteException,
      );
    });

    it('successfully deletes DRAFT PO and logs audit event', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'po-uuid-1',
          organizationId: orgId,
          status: 'DRAFT',
          purchaseOrderNumber: 'PO-001',
        },
      ]);
      prisma.purchaseOrder.delete.mockResolvedValue({ id: 'po-uuid-1' });

      await expect(service.deleteDraft(orgId, 'po-uuid-1', userId)).resolves.not.toThrow();

      expect(prisma.purchaseOrder.delete).toHaveBeenCalledWith({
        where: { id: 'po-uuid-1' },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PURCHASE_ORDER_DELETED',
          entityType: 'PurchaseOrder',
        }),
      );
    });
  });
});
