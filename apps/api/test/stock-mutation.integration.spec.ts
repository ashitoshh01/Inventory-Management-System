import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaService } from '@repo/database';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
import {
  StockIdempotencyConflictException,
  StockInsufficientQuantityException,
  StockOpeningBalanceInvalidStateException,
  StockProductNotFoundException,
  StockWarehouseNotFoundException,
} from '../src/modules/stock/stock.errors';

describe('Phase 5B Stock Mutation Engine Integration Suite (Real PostgreSQL)', () => {
  jest.setTimeout(45000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let mutationService: StockMutationService;

  const timestamp = Date.now();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let catAId: string;
  let catBId: string;
  let prodA1Id: string;
  let prodA2Id: string;
  let prodB1Id: string;
  let whA1Id: string;
  let whA2Id: string;
  let whB1Id: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    mutationService = appModule.get<StockMutationService>(StockMutationService);

    // 1. Create 2 isolated test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `mut-org-a-${timestamp}`,
        name: `Mutation Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `mut-org-b-${timestamp}`,
        name: `Mutation Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // 2. Create users with organization memberships
    const userA = await prisma.user.create({
      data: {
        email: `mut-user-a-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const roleA = await prisma.role.findFirstOrThrow();

    await prisma.organizationMembership.create({
      data: {
        userId: userAId,
        organizationId: orgAId,
        roleId: roleA.id,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `mut-user-b-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userBId = userB.id;

    await prisma.organizationMembership.create({
      data: {
        userId: userBId,
        organizationId: orgBId,
        roleId: roleA.id,
      },
    });

    // 3. Create categories
    const catA = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Cat A ${timestamp}`,
      },
    });
    catAId = catA.id;

    const catB = await prisma.category.create({
      data: {
        organizationId: orgBId,
        name: `Cat B ${timestamp}`,
      },
    });
    catBId = catB.id;

    // 4. Create products
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `SKU-MUT-A1-${timestamp}`,
        name: 'Product A1',
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `SKU-MUT-A2-${timestamp}`,
        name: 'Product A2',
      },
    });
    prodA2Id = prodA2.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catBId,
        sku: `SKU-MUT-B1-${timestamp}`,
        name: 'Product B1',
      },
    });
    prodB1Id = prodB1.id;

    // 5. Create warehouses
    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A1 ${timestamp}`,
        code: `WHMA1-${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const whA2 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A2 ${timestamp}`,
        code: `WHMA2-${timestamp}`,
      },
    });
    whA2Id = whA2.id;

    const whB1 = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `Warehouse B1 ${timestamp}`,
        code: `WHMB1-${timestamp}`,
      },
    });
    whB1Id = whB1.id;
  });

  afterAll(async () => {
    if (prisma) {
      const orgIds = [orgAId, orgBId].filter(Boolean);
      const userEmails = [`mut-user-a-${timestamp}@test.com`, `mut-user-b-${timestamp}@test.com`];

      if (orgIds.length > 0) {
        await prisma.stockLedgerEntry.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.stockBalance.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.product.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.category.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.warehouse.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.auditEvent.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.organizationMembership.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
      }

      await prisma.user.deleteMany({
        where: { email: { in: userEmails } },
      });

      if (orgIds.length > 0) {
        await prisma.organization.deleteMany({
          where: { id: { in: orgIds } },
        });
      }

      await prisma.$disconnect();
    }
  });

  describe('Section 35: Core Mutation Types & Real PostgreSQL Transactions', () => {
    it('initializes stock with OPENING mutation (0 -> 100.0000)', async () => {
      const res = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
        actorUserId: userAId,
      });

      expect(res.isIdempotentReplay).toBe(false);
      expect(res.balance.quantity).toBe('100.0000');
      expect(res.ledgerEntry.quantityBefore).toBe('0.0000');
      expect(res.ledgerEntry.quantityDelta).toBe('100.0000');
      expect(res.ledgerEntry.quantityAfter).toBe('100.0000');
      expect(res.ledgerEntry.type).toBe('OPENING');

      // Verify row in PostgreSQL
      const dbBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(dbBalance?.quantity.toFixed(4)).toBe('100.0000');
    });

    it('A. RECEIPT increases stock (100 -> 125.0000)', async () => {
      const res = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '25.0000',
        actorUserId: userAId,
      });

      expect(res.balance.quantity).toBe('125.0000');
      expect(res.ledgerEntry.quantityBefore).toBe('100.0000');
      expect(res.ledgerEntry.quantityDelta).toBe('25.0000');
      expect(res.ledgerEntry.quantityAfter).toBe('125.0000');
    });

    it('B. ISSUE decreases stock (125 -> 100.0000)', async () => {
      const res = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'ISSUE',
        quantityDelta: '-25.0000',
        actorUserId: userAId,
      });

      expect(res.balance.quantity).toBe('100.0000');
      expect(res.ledgerEntry.quantityBefore).toBe('125.0000');
      expect(res.ledgerEntry.quantityDelta).toBe('-25.0000');
      expect(res.ledgerEntry.quantityAfter).toBe('100.0000');
    });

    it('C. ADJUSTMENT positive (100 -> 110.0000)', async () => {
      const res = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'ADJUSTMENT',
        quantityDelta: '10.0000',
        actorUserId: userAId,
      });

      expect(res.balance.quantity).toBe('110.0000');
      expect(res.ledgerEntry.quantityBefore).toBe('100.0000');
      expect(res.ledgerEntry.quantityDelta).toBe('10.0000');
      expect(res.ledgerEntry.quantityAfter).toBe('110.0000');
    });

    it('D. ADJUSTMENT negative (110 -> 100.0000)', async () => {
      const res = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'ADJUSTMENT',
        quantityDelta: '-10.0000',
        actorUserId: userAId,
      });

      expect(res.balance.quantity).toBe('100.0000');
      expect(res.ledgerEntry.quantityBefore).toBe('110.0000');
      expect(res.ledgerEntry.quantityDelta).toBe('-10.0000');
      expect(res.ledgerEntry.quantityAfter).toBe('100.0000');
    });

    it('rejects OPENING on an already populated stock balance', async () => {
      // Balance is currently 100.0000
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'OPENING',
          quantityDelta: '50.0000',
        }),
      ).rejects.toThrow(StockOpeningBalanceInvalidStateException);
    });

    it('rejects mutation if resulting stock would become negative (prohibited)', async () => {
      // Current balance = 100.0000. Attempting issue of -101.0000
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-101.0000',
        }),
      ).rejects.toThrow(StockInsufficientQuantityException);

      // Verify balance remained untouched in PostgreSQL
      const dbBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(dbBalance?.quantity.toFixed(4)).toBe('100.0000');
    });

    it('F. Atomic rollback: transaction rollback on forced ledger failure leaves balance unchanged', async () => {
      const balanceBefore = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });

      // Force an error inside interactive transaction by attempting invalid foreign key or forced check violation
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.stockBalance.update({
            where: { id: balanceBefore.id },
            data: { quantity: new Prisma.Decimal('999.0000') },
          });

          // Force failure
          throw new Error('FORCED_SIMULATED_LEDGER_FAILURE');
        }),
      ).rejects.toThrow('FORCED_SIMULATED_LEDGER_FAILURE');

      // Assert balance was cleanly rolled back
      const balanceAfter = await prisma.stockBalance.findUniqueOrThrow({
        where: { id: balanceBefore.id },
      });
      expect(balanceAfter.quantity.toFixed(4)).toBe(balanceBefore.quantity.toFixed(4));
    });
  });

  describe('Section 36: Concurrency Tests (Mandatory PostgreSQL Races)', () => {
    it('A. Concurrent issues: 100 with concurrent -30 and -50 -> final 20.0000 without lost update', async () => {
      // Create dedicated product and warehouse for clean isolation
      const prodConcA = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-CONC-A-${timestamp}`,
          name: 'Concurrent Product A',
        },
      });

      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodConcA.id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
      });

      // Dispatch concurrent issues
      const [res1, res2] = await Promise.all([
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcA.id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-30.0000',
        }),
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcA.id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-50.0000',
        }),
      ]);

      expect(res1).toBeDefined();
      expect(res2).toBeDefined();

      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodConcA.id,
            warehouseId: whA1Id,
          },
        },
      });

      expect(finalBalance.quantity.toFixed(4)).toBe('20.0000');

      const entries = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          productId: prodConcA.id,
          warehouseId: whA1Id,
          type: 'ISSUE',
        },
      });
      expect(entries.length).toBe(2);
    });

    it('B. Concurrent receipts: 100 with concurrent +25 and +40 -> final 165.0000', async () => {
      const prodConcB = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-CONC-B-${timestamp}`,
          name: 'Concurrent Product B',
        },
      });

      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodConcB.id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
      });

      await Promise.all([
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcB.id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '25.0000',
        }),
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcB.id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '40.0000',
        }),
      ]);

      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodConcB.id,
            warehouseId: whA1Id,
          },
        },
      });

      expect(finalBalance.quantity.toFixed(4)).toBe('165.0000');
    });

    it('C. Concurrent mixed: 100 with concurrent +25 and -40 -> final 85.0000', async () => {
      const prodConcC = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-CONC-C-${timestamp}`,
          name: 'Concurrent Product C',
        },
      });

      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodConcC.id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
      });

      await Promise.all([
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcC.id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '25.0000',
        }),
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodConcC.id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-40.0000',
        }),
      ]);

      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodConcC.id,
            warehouseId: whA1Id,
          },
        },
      });

      expect(finalBalance.quantity.toFixed(4)).toBe('85.0000');
    });

    it('D. First-balance race: concurrent mutations against non-existent balance create exactly one StockBalance', async () => {
      const prodRace = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-RACE-${timestamp}`,
          name: 'Race Product',
        },
      });

      // Two simultaneous requests attempt first mutation (RECEIPT) against the fresh (prodRace, whA2) bucket
      await Promise.all([
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodRace.id,
          warehouseId: whA2Id,
          type: 'RECEIPT',
          quantityDelta: '15.0000',
        }),
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodRace.id,
          warehouseId: whA2Id,
          type: 'RECEIPT',
          quantityDelta: '35.0000',
        }),
      ]);

      // Assert exactly one StockBalance row exists
      const count = await prisma.stockBalance.count({
        where: {
          organizationId: orgAId,
          productId: prodRace.id,
          warehouseId: whA2Id,
        },
      });
      expect(count).toBe(1);

      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodRace.id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(balance.quantity.toFixed(4)).toBe('50.0000');
    });

    it('E. Concurrent duplicate idempotency key -> exactly one mutation committed', async () => {
      const prodIdemp = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-IDEMP-${timestamp}`,
          name: 'Idempotency Race Product',
        },
      });

      const raceKey = `RACE-KEY-${timestamp}`;

      const [res1, res2] = await Promise.all([
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodIdemp.id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
          idempotencyKey: raceKey,
        }),
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodIdemp.id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
          idempotencyKey: raceKey,
        }),
      ]);

      expect(res1.balance.quantity).toBe('10.0000');
      expect(res2.balance.quantity).toBe('10.0000');

      // Exactly one ledger entry exists with this idempotency key
      const ledgerEntries = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          idempotencyKey: raceKey,
        },
      });
      expect(ledgerEntries.length).toBe(1);
    });
  });

  describe('Section 37: Cross-Tenant Guardrails', () => {
    it('rejects cross-tenant Product reference (Org A trying to mutate Org B product)', async () => {
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodB1Id, // Org B!
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockProductNotFoundException);
    });

    it('rejects cross-tenant Warehouse reference (Org A trying to mutate Org B warehouse)', async () => {
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whB1Id, // Org B!
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockWarehouseNotFoundException);
    });

    it('isolates mutations across organizations with identical product SKU/codes', async () => {
      const resA = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA2Id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '50.0000',
      });

      const resB = await mutationService.mutateStock({
        organizationId: orgBId,
        productId: prodB1Id,
        warehouseId: whB1Id,
        type: 'RECEIPT',
        quantityDelta: '75.0000',
      });

      expect(resA.balance.organizationId).toBe(orgAId);
      expect(resA.balance.quantity).toBe('50.0000');
      expect(resB.balance.organizationId).toBe(orgBId);
      expect(resB.balance.quantity).toBe('75.0000');
    });
  });

  describe('Section 38 & 40: Ledger Consistency & Invariant Verification', () => {
    it('verifies sequence: OPENING -> RECEIPT -> ISSUE -> ADJUSTMENT and ensures balance equals sum(deltas)', async () => {
      const prodSeq = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-SEQ-${timestamp}`,
          name: 'Sequence Product',
        },
      });

      // 1. OPENING +100
      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodSeq.id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
      });

      // 2. RECEIPT +25
      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodSeq.id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '25.0000',
      });

      // 3. ISSUE -30
      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodSeq.id,
        warehouseId: whA1Id,
        type: 'ISSUE',
        quantityDelta: '-30.0000',
      });

      // 4. ADJUSTMENT +5
      const finalRes = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodSeq.id,
        warehouseId: whA1Id,
        type: 'ADJUSTMENT',
        quantityDelta: '5.0000',
      });

      expect(finalRes.balance.quantity).toBe('100.0000');
      expect(finalRes.ledgerEntry.quantityAfter).toBe('100.0000');

      // Fetch all ledger entries in chronological order
      const entries = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          productId: prodSeq.id,
          warehouseId: whA1Id,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(entries.length).toBe(4);
      expect(entries[0]?.quantityBefore.toFixed(4)).toBe('0.0000');
      expect(entries[0]?.quantityDelta.toFixed(4)).toBe('100.0000');
      expect(entries[0]?.quantityAfter.toFixed(4)).toBe('100.0000');

      expect(entries[1]?.quantityBefore.toFixed(4)).toBe('100.0000');
      expect(entries[1]?.quantityDelta.toFixed(4)).toBe('25.0000');
      expect(entries[1]?.quantityAfter.toFixed(4)).toBe('125.0000');

      expect(entries[2]?.quantityBefore.toFixed(4)).toBe('125.0000');
      expect(entries[2]?.quantityDelta.toFixed(4)).toBe('-30.0000');
      expect(entries[2]?.quantityAfter.toFixed(4)).toBe('95.0000');

      expect(entries[3]?.quantityBefore.toFixed(4)).toBe('95.0000');
      expect(entries[3]?.quantityDelta.toFixed(4)).toBe('5.0000');
      expect(entries[3]?.quantityAfter.toFixed(4)).toBe('100.0000');

      // Invariant: sum(all ledger deltas) = final balance
      const sumDeltas = entries.reduce(
        (acc, entry) => acc.add(entry.quantityDelta),
        new Prisma.Decimal(0),
      );
      expect(sumDeltas.toFixed(4)).toBe(finalRes.balance.quantity);
    });
  });

  describe('Section 39: Idempotency Contract', () => {
    it('returns existing result on retry, and rejects conflicting payload with same key', async () => {
      const prodIdempTest = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-IDEMP-TEST-${timestamp}`,
          name: 'Idempotency Contract Product',
        },
      });

      const testKey = `IDEMP-TEST-KEY-${timestamp}`;

      // First call
      const res1 = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodIdempTest.id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '40.0000',
        idempotencyKey: testKey,
        referenceType: 'PO',
        referenceId: 'PO-999',
      });
      expect(res1.isIdempotentReplay).toBe(false);
      expect(res1.balance.quantity).toBe('40.0000');

      // Retry identical request
      const res2 = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodIdempTest.id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '40.0000',
        idempotencyKey: testKey,
        referenceType: 'PO',
        referenceId: 'PO-999',
      });
      expect(res2.isIdempotentReplay).toBe(true);
      expect(res2.balance.quantity).toBe('40.0000');
      expect(res2.ledgerEntry.id).toBe(res1.ledgerEntry.id);

      // Attempt same key with DIFFERENT mutation parameters (conflict)
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodIdempTest.id,
          warehouseId: whA1Id,
          type: 'ISSUE', // Conflict: was RECEIPT!
          quantityDelta: '-10.0000',
          idempotencyKey: testKey,
        }),
      ).rejects.toThrow(StockIdempotencyConflictException);
    });

    it('allows identical idempotency keys in different organizations', async () => {
      const sharedKey = `CROSS-ORG-IDEMP-${timestamp}`;

      const resA = await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
        idempotencyKey: sharedKey,
      });

      const resB = await mutationService.mutateStock({
        organizationId: orgBId,
        productId: prodB1Id,
        warehouseId: whB1Id,
        type: 'RECEIPT',
        quantityDelta: '20.0000',
        idempotencyKey: sharedKey,
      });

      expect(resA.ledgerEntry.idempotencyKey).toBe(sharedKey);
      expect(resB.ledgerEntry.idempotencyKey).toBe(sharedKey);
      expect(resA.ledgerEntry.organizationId).toBe(orgAId);
      expect(resB.ledgerEntry.organizationId).toBe(orgBId);
    });
  });

  describe('Section 41: AuditEvent Generation', () => {
    it('creates an AuditEvent on successful stock mutation and none on failed transactions', async () => {
      const prodAudit = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `SKU-AUDIT-${timestamp}`,
          name: 'Audit Product',
        },
      });

      const auditCountBefore = await prisma.auditEvent.count({
        where: { organizationId: orgAId, action: 'stock.mutated' },
      });

      // Successful mutation
      await mutationService.mutateStock({
        organizationId: orgAId,
        productId: prodAudit.id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '15.0000',
        actorUserId: userAId,
      });

      const auditCountAfterSuccess = await prisma.auditEvent.count({
        where: { organizationId: orgAId, action: 'stock.mutated' },
      });
      expect(auditCountAfterSuccess).toBe(auditCountBefore + 1);

      // Failed mutation (negative stock)
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          productId: prodAudit.id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-50.0000', // exceeds balance of 15
          actorUserId: userAId,
        }),
      ).rejects.toThrow();

      // Verify audit count did not increment on failed transaction
      const auditCountAfterFailure = await prisma.auditEvent.count({
        where: { organizationId: orgAId, action: 'stock.mutated' },
      });
      expect(auditCountAfterFailure).toBe(auditCountAfterSuccess);
    });
  });
});
