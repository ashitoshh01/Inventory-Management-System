import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@repo/database';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersFoundationService } from './purchase-orders-foundation.service';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../core/services/idempotency.service';
import { StockMutationService } from '../stock/stock-mutation.service';
import {
  PurchaseOrderNotFoundException,
  PurchaseOrderCannotUpdateException,
  PurchaseOrderWarehouseNotFoundException,
} from './purchase-orders.errors';
import { PurchaseOrderDto } from '@repo/types';
import { CreatePurchaseOrderDto, QueryPurchaseOrderDto } from './dto/purchase-order.dto';

describe('PurchaseOrdersService (Unit)', () => {
  let service: PurchaseOrdersService;
  let prisma: {
    purchaseOrder: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    purchaseOrderLine: {
      deleteMany: jest.Mock;
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
  let foundationService: {
    create: jest.Mock;
    findById: jest.Mock;
    mapOrderToDto: jest.Mock;
    deleteDraft: jest.Mock;
    transitionStatus: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };
  let idempotencyService: IdempotencyService;

  const orgId = 'org-uuid-1';
  const userId = 'user-uuid-1';

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    foundationService = {
      create: jest.fn(),
      findById: jest.fn(),
      mapOrderToDto: jest.fn(),
      deleteDraft: jest.fn(),
      transitionStatus: jest.fn(),
    };

    auditService = {
      logEvent: jest.fn(),
    };

    idempotencyService = new IdempotencyService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PurchaseOrdersFoundationService, useValue: foundationService },
        { provide: AuditService, useValue: auditService },
        { provide: IdempotencyService, useValue: idempotencyService },
        {
          provide: StockMutationService,
          useValue: {
            mutateStock: jest.fn(),
            mutateStockTx: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    it('creates PO via foundation service with database-backed idempotency support', async () => {
      const dto: CreatePurchaseOrderDto = {
        purchaseOrderNumber: 'PO-001',
        supplierName: 'Acme Supplies',
        warehouseId: 'wh-uuid-1',
        lines: [
          {
            productId: 'p-1',
            quantity: '5.0000',
            unitPrice: '10.0000',
          },
        ],
      };

      const mockPo = { id: 'po-1', purchaseOrderNumber: 'PO-001' } as unknown as PurchaseOrderDto;
      // 1. First execution: no existing record
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      foundationService.create.mockResolvedValue(mockPo);

      const res = await service.create(orgId, userId, dto, 'key-1');
      expect(res.order).toBe(mockPo);
      expect(res.isIdempotentReplay).toBe(false);
      expect(foundationService.create).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          ...dto,
          idempotencyKey: 'key-1',
        }),
        userId,
      );

      // 2. Replay with same key and payload returns cached DB record
      const payloadHash = (
        service as unknown as { computePayloadHash: (d: unknown) => string }
      ).computePayloadHash(dto);
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        ...mockPo,
        idempotencyPayloadHash: payloadHash,
      });
      foundationService.mapOrderToDto.mockReturnValue(mockPo);

      const replayRes = await service.create(orgId, userId, dto, 'key-1');
      expect(replayRes.isIdempotentReplay).toBe(true);
      expect(replayRes.order).toEqual(mockPo);
      expect(foundationService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated purchase orders with applied filters', async () => {
      const query = new QueryPurchaseOrderDto();
      query.status = 'DRAFT';
      query.warehouseId = 'wh-uuid-1';
      query.supplierName = 'Acme';
      query.purchaseOrderNumber = 'PO-001';
      query.search = 'search term';

      prisma.purchaseOrder.count.mockResolvedValue(1);
      prisma.purchaseOrder.findMany.mockResolvedValue([{ id: 'po-1' }]);
      foundationService.mapOrderToDto.mockReturnValue({ id: 'po-1' });

      const result = await service.findAll(orgId, query, 'req-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.purchaseOrder.count).toHaveBeenCalled();
      expect(prisma.purchaseOrder.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns PO if found in organization', async () => {
      const mockPo = { id: 'po-1' } as unknown as PurchaseOrderDto;
      foundationService.findById.mockResolvedValue(mockPo);

      const result = await service.findOne('po-1', orgId);
      expect(result).toBe(mockPo);
    });

    it('throws PurchaseOrderNotFoundException if not found', async () => {
      foundationService.findById.mockResolvedValue(null);

      await expect(service.findOne('missing-po', orgId)).rejects.toThrow(
        PurchaseOrderNotFoundException,
      );
    });
  });

  describe('update', () => {
    const existingPo = {
      id: 'po-1',
      organizationId: orgId,
      purchaseOrderNumber: 'PO-001',
      status: 'DRAFT',
      orderDate: new Date('2026-09-12'),
      expectedDate: null,
      lines: [],
    };

    it('throws PurchaseOrderNotFoundException if PO does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.update('non-existent', orgId, userId, { supplierName: 'New' }),
      ).rejects.toThrow(PurchaseOrderNotFoundException);
    });

    it('throws PurchaseOrderCannotUpdateException if PO is not in DRAFT status', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...existingPo,
          status: 'SUBMITTED',
        },
      ]);

      await expect(service.update('po-1', orgId, userId, { supplierName: 'New' })).rejects.toThrow(
        PurchaseOrderCannotUpdateException,
      );
    });

    it('throws PurchaseOrderWarehouseNotFoundException if updated warehouse does not exist', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.update('po-1', orgId, userId, { warehouseId: 'wh-missing' }),
      ).rejects.toThrow(PurchaseOrderWarehouseNotFoundException);
    });

    it('updates header fields and logs audit event', async () => {
      prisma.$queryRaw.mockResolvedValue([existingPo]);
      prisma.purchaseOrder.update.mockResolvedValue({
        ...existingPo,
        supplierName: 'New Supplier',
        lines: [],
      });
      foundationService.mapOrderToDto.mockReturnValue({
        id: 'po-1',
        supplierName: 'New Supplier',
      });

      const res = await service.update('po-1', orgId, userId, {
        supplierName: 'New Supplier',
      });

      expect(res.supplierName).toBe('New Supplier');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PURCHASE_ORDER_UPDATED',
          entityId: 'po-1',
        }),
      );
    });
  });

  describe('lifecycle methods', () => {
    it('deleteDraft delegates to foundationService', async () => {
      foundationService.deleteDraft.mockResolvedValue(undefined);
      const res = await service.deleteDraft('po-1', orgId, userId);
      expect(foundationService.deleteDraft).toHaveBeenCalledWith(orgId, 'po-1', userId);
      expect(res.id).toBe('po-1');
    });

    it('submit transitions status to SUBMITTED', async () => {
      foundationService.transitionStatus.mockResolvedValue({ id: 'po-1', status: 'SUBMITTED' });
      const res = await service.submit('po-1', orgId, userId);
      expect(foundationService.transitionStatus).toHaveBeenCalledWith(
        orgId,
        'po-1',
        'SUBMITTED',
        userId,
        undefined,
      );
      expect(res.status).toBe('SUBMITTED');
    });

    it('approve transitions status to APPROVED', async () => {
      foundationService.transitionStatus.mockResolvedValue({ id: 'po-1', status: 'APPROVED' });
      const res = await service.approve('po-1', orgId, userId);
      expect(foundationService.transitionStatus).toHaveBeenCalledWith(
        orgId,
        'po-1',
        'APPROVED',
        userId,
        undefined,
      );
      expect(res.status).toBe('APPROVED');
    });

    it('cancel transitions status to CANCELLED', async () => {
      foundationService.transitionStatus.mockResolvedValue({ id: 'po-1', status: 'CANCELLED' });
      const res = await service.cancel('po-1', orgId, userId);
      expect(foundationService.transitionStatus).toHaveBeenCalledWith(
        orgId,
        'po-1',
        'CANCELLED',
        userId,
        undefined,
      );
      expect(res.status).toBe('CANCELLED');
    });
  });
});
