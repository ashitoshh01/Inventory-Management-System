import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaService } from '@repo/database';
import { StockMutationService } from './stock-mutation.service';
import { AuditService } from '../audit/audit.service';
import {
  StockIdempotencyConflictException,
  StockInsufficientQuantityException,
  StockOpeningBalanceInvalidStateException,
  StockProductNotFoundException,
  StockWarehouseNotFoundException,
} from './stock.errors';

describe('StockMutationService (Unit)', () => {
  let service: StockMutationService;
  let prisma: {
    stockLedgerEntry: {
      findUnique: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    stockBalance: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    organization: {
      findUnique: jest.Mock;
    };
    product: {
      findFirst: jest.Mock;
    };
    warehouse: {
      findFirst: jest.Mock;
    };
    organizationMembership: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const orgId = 'org-uuid-1';
  const prodId = 'prod-uuid-1';
  const whId = 'wh-uuid-1';
  const actorId = 'user-uuid-1';

  beforeEach(async () => {
    prisma = {
      stockLedgerEntry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      stockBalance: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: orgId, isActive: true }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: prodId, status: 'ACTIVE' }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId, status: 'ACTIVE' }),
      },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mem-1', isActive: true }),
      },
      $transaction: jest.fn(),
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMutationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<StockMutationService>(StockMutationService);
  });

  describe('Tenant and Entity Validation', () => {
    it('throws StockProductNotFoundException if organization is inactive or not found', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockProductNotFoundException);
    });

    it('throws StockProductNotFoundException if product is not found in organization', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockProductNotFoundException);
    });

    it('throws StockWarehouseNotFoundException if warehouse is not found in organization', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockWarehouseNotFoundException);
    });
  });

  describe('Idempotency handling', () => {
    it('returns existing result on identical replay without initiating new transaction', async () => {
      const existingLedger = {
        id: 'ledger-uuid-1',
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        quantityBefore: new Prisma.Decimal('100.0000'),
        quantityDelta: new Prisma.Decimal('25.0000'),
        quantityAfter: new Prisma.Decimal('125.0000'),
        type: 'RECEIPT',
        referenceType: 'PO',
        referenceId: 'PO-100',
        idempotencyKey: 'IDEMP-KEY-1',
        createdById: actorId,
        metadata: null,
        createdAt: new Date(),
      };

      const existingBalance = {
        id: 'balance-uuid-1',
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        quantity: new Prisma.Decimal('125.0000'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.stockLedgerEntry.findUnique.mockResolvedValue(existingLedger);
      prisma.stockBalance.findUnique.mockResolvedValue(existingBalance);

      const result = await service.mutateStock({
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        type: 'RECEIPT',
        quantityDelta: '25.0000',
        idempotencyKey: 'IDEMP-KEY-1',
        referenceType: 'PO',
        referenceId: 'PO-100',
      });

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.balance.quantity).toBe('125.0000');
      expect(result.ledgerEntry.id).toBe('ledger-uuid-1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('throws StockIdempotencyConflictException if idempotencyKey was used with different payload', async () => {
      const existingLedger = {
        id: 'ledger-uuid-1',
        organizationId: orgId,
        productId: prodId,
        warehouseId: whId,
        quantityBefore: new Prisma.Decimal('100.0000'),
        quantityDelta: new Prisma.Decimal('25.0000'),
        type: 'RECEIPT',
        referenceType: null,
        referenceId: null,
        idempotencyKey: 'IDEMP-KEY-CONFLICT',
        createdById: actorId,
        metadata: null,
        createdAt: new Date(),
      };

      prisma.stockLedgerEntry.findUnique.mockResolvedValue(existingLedger);

      // Attempting with ISSUE -10.0000 instead of RECEIPT +25.0000
      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'ISSUE',
          quantityDelta: '-10.0000',
          idempotencyKey: 'IDEMP-KEY-CONFLICT',
        }),
      ).rejects.toThrow(StockIdempotencyConflictException);
    });
  });

  describe('Transaction execution & business invariants', () => {
    it('rejects OPENING mutation if locked stock balance is not zero', async () => {
      prisma.stockLedgerEntry.findUnique.mockResolvedValue(null);

      // Simulate Prisma transaction execution
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRaw: jest.fn().mockResolvedValue(1),
          $queryRaw: jest
            .fn()
            .mockResolvedValue([{ id: 'bal-1', quantity: new Prisma.Decimal('10.0000') }]),
          stockLedgerEntry: { count: jest.fn().mockResolvedValue(0) },
        };
        return callback(mockTx);
      });

      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'OPENING',
          quantityDelta: '50.0000',
        }),
      ).rejects.toThrow(StockOpeningBalanceInvalidStateException);
    });

    it('rejects mutation if resulting quantity becomes negative', async () => {
      prisma.stockLedgerEntry.findUnique.mockResolvedValue(null);

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRaw: jest.fn().mockResolvedValue(1),
          $queryRaw: jest
            .fn()
            .mockResolvedValue([{ id: 'bal-1', quantity: new Prisma.Decimal('10.0000') }]),
        };
        return callback(mockTx);
      });

      // Issue -25 when current balance is 10
      await expect(
        service.mutateStock({
          organizationId: orgId,
          productId: prodId,
          warehouseId: whId,
          type: 'ISSUE',
          quantityDelta: '-25.0000',
        }),
      ).rejects.toThrow(StockInsufficientQuantityException);
    });
  });
});
