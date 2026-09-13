import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaService } from '@repo/database';
import { TransfersService } from './transfers.service';
import { AuditService } from '../audit/audit.service';
import { StockMutationService } from '../stock/stock-mutation.service';
import {
  StockTransferIdempotencyConflictException,
  StockTransferNotFoundException,
} from './transfers.errors';
import { CreateStockTransferDto } from './dto/transfer.dto';

describe('TransfersService (Unit)', () => {
  let service: TransfersService;
  let prisma: {
    stockTransfer: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      groupBy: jest.Mock;
    };
    stockTransferLine: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    warehouse: {
      findMany: jest.Mock;
    };
    product: {
      findMany: jest.Mock;
    };
    auditEvent: {
      findMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };
  let stockMutationService: {
    mutateStock: jest.Mock;
    mutateStockTx: jest.Mock;
  };

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      stockTransfer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
      stockTransferLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      auditEvent: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    stockMutationService = {
      mutateStock: jest.fn(),
      mutateStockTx: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: StockMutationService, useValue: stockMutationService },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  describe('create', () => {
    it('creates a new transfer atomically with lines and audit event', async () => {
      const dto: CreateStockTransferDto = {
        transferNumber: 'TR-101',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        notes: 'Transfer urgent supplies',
        lines: [{ productId: 'prod-1', quantity: '10.0000' }],
      };

      prisma.warehouse.findMany.mockResolvedValue([{ id: 'wh-1' }, { id: 'wh-2' }]);
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);

      const mockCreated = {
        id: 'tr-1',
        organizationId: orgId,
        transferNumber: 'TR-101',
        status: 'DRAFT',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        notes: 'Transfer urgent supplies',
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        shippedById: null,
        shippedAt: null,
        receivedById: null,
        receivedAt: null,
        cancelledById: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'line-1',
            organizationId: orgId,
            transferId: 'tr-1',
            productId: 'prod-1',
            quantity: new Prisma.Decimal('10.0000'),
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      prisma.stockTransfer.create.mockResolvedValue({ id: 'tr-1' });
      prisma.stockTransfer.findUniqueOrThrow.mockResolvedValue(mockCreated);

      const result = await service.create(orgId, userId, dto);

      expect(result.isIdempotentReplay).toBe(false);
      expect(result.transfer.transferNumber).toBe('TR-101');
      expect(prisma.stockTransfer.create).toHaveBeenCalled();
      expect(prisma.stockTransferLine.createMany).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'stock-transfer.created',
          entityType: 'StockTransfer',
        }),
      );
    });

    it('replays existing transfer if idempotency key matches payload', async () => {
      const dto: CreateStockTransferDto = {
        transferNumber: 'TR-101',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        lines: [{ productId: 'prod-1', quantity: '10.0000' }],
      };

      const payloadHash = (
        service as unknown as { computePayloadHash: (d: unknown) => string }
      ).computePayloadHash(dto);

      const mockExisting = {
        id: 'tr-1',
        organizationId: orgId,
        transferNumber: 'TR-101',
        status: 'DRAFT',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        notes: null,
        idempotencyPayloadHash: payloadHash,
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        shippedById: null,
        shippedAt: null,
        receivedById: null,
        receivedAt: null,
        cancelledById: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      };

      prisma.stockTransfer.findFirst.mockResolvedValue(mockExisting);

      const result = await service.create(orgId, userId, dto, 'idem-1');

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.transfer.id).toBe('tr-1');
      expect(prisma.stockTransfer.create).not.toHaveBeenCalled();
    });

    it('throws 409 Conflict if idempotency key was used with different payload', async () => {
      const dto: CreateStockTransferDto = {
        transferNumber: 'TR-101',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        lines: [{ productId: 'prod-1', quantity: '10.0000' }],
      };

      const mockExisting = {
        id: 'tr-1',
        idempotencyPayloadHash: 'different-hash',
        lines: [],
      };

      prisma.stockTransfer.findFirst.mockResolvedValue(mockExisting);

      await expect(service.create(orgId, userId, dto, 'idem-1')).rejects.toThrow(
        StockTransferIdempotencyConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('throws StockTransferNotFoundException if transfer does not exist', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(null);
      await expect(service.findOne('tr-999', orgId)).rejects.toThrow(
        StockTransferNotFoundException,
      );
    });
  });

  describe('ship', () => {
    it('issues stock from source warehouse and marks transfer IN_TRANSIT', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'tr-1',
          status: 'APPROVED',
          transferNumber: 'TR-1',
          sourceWarehouseId: 'wh-source',
          destinationWarehouseId: 'wh-dest',
        },
      ]);

      prisma.stockTransferLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          productId: 'prod-1',
          quantity: new Prisma.Decimal('5.0000'),
        },
      ]);

      prisma.stockTransfer.update.mockResolvedValue({
        id: 'tr-1',
        status: 'IN_TRANSIT',
        transferNumber: 'TR-1',
        sourceWarehouseId: 'wh-source',
        destinationWarehouseId: 'wh-dest',
        shippedAt: new Date(),
      });

      const result = await service.ship('tr-1', orgId, userId, {});

      expect(result.status).toBe('IN_TRANSIT');
      expect(stockMutationService.mutateStockTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: orgId,
          productId: 'prod-1',
          warehouseId: 'wh-source',
          type: 'ISSUE',
          quantityDelta: '-5.0000',
          referenceType: 'STOCK_TRANSFER',
          referenceId: 'tr-1',
        }),
      );
    });
  });

  describe('receive', () => {
    it('credits stock at destination warehouse and marks transfer RECEIVED', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'tr-1',
          status: 'IN_TRANSIT',
          transferNumber: 'TR-1',
          sourceWarehouseId: 'wh-source',
          destinationWarehouseId: 'wh-dest',
        },
      ]);

      prisma.stockTransferLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          productId: 'prod-1',
          quantity: new Prisma.Decimal('5.0000'),
        },
      ]);

      prisma.stockTransfer.update.mockResolvedValue({
        id: 'tr-1',
        status: 'RECEIVED',
        transferNumber: 'TR-1',
        sourceWarehouseId: 'wh-source',
        destinationWarehouseId: 'wh-dest',
        receivedAt: new Date(),
      });

      const result = await service.receive('tr-1', orgId, userId, {});

      expect(result.status).toBe('RECEIVED');
      expect(stockMutationService.mutateStockTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: orgId,
          productId: 'prod-1',
          warehouseId: 'wh-dest',
          type: 'RECEIPT',
          quantityDelta: '5.0000',
          referenceType: 'STOCK_TRANSFER',
          referenceId: 'tr-1',
        }),
      );
    });
  });
});
