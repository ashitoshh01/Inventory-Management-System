import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaService } from '@repo/database';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
import {
  StockIdempotencyConflictException,
  StockInsufficientQuantityException,
  StockProductNotFoundException,
  StockWarehouseNotFoundException,
} from '../src/modules/stock/stock.errors';

describe('Phase 5F — Stock Concurrency, Atomicity & Decimal Math Integration (Real PostgreSQL)', () => {
  jest.setTimeout(60000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let mutationService: StockMutationService;

  const timestamp = Date.now();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let catAId: string;
  let prodA1Id: string;
  let prodA2Id: string;
  let prodA3Id: string;
  let whA1Id: string;
  let whA2Id: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    mutationService = appModule.get<StockMutationService>(StockMutationService);

    // 1. Create two test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `adv-org-a-${timestamp}`,
        name: `Adversarial Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `adv-org-b-${timestamp}`,
        name: `Adversarial Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // 2. Create users and memberships
    const userA = await prisma.user.create({
      data: { email: `adv-user-a-${timestamp}@test.com`, passwordHash: 'dummy' },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { email: `adv-user-b-${timestamp}@test.com`, passwordHash: 'dummy' },
    });
    userBId = userB.id;

    const role = await prisma.role.findFirstOrThrow();
    await prisma.organizationMembership.create({
      data: {
        userId: userAId,
        organizationId: orgAId,
        roleId: role.id,
      },
    });

    await prisma.organizationMembership.create({
      data: {
        userId: userBId,
        organizationId: orgBId,
        roleId: role.id,
      },
    });

    // 3. Create categories, products, warehouses in Org A
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Adv Cat ${timestamp}` },
    });
    catAId = catA.id;

    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        name: `Adv Prod 1 ${timestamp}`,
        sku: `SKU-ADV-1-${timestamp}`,
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        name: `Adv Prod 2 ${timestamp}`,
        sku: `SKU-ADV-2-${timestamp}`,
      },
    });
    prodA2Id = prodA2.id;

    const prodA3 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        name: `Adv Prod 3 ${timestamp}`,
        sku: `SKU-ADV-3-${timestamp}`,
      },
    });
    prodA3Id = prodA3.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Adv WH 1 ${timestamp}`,
        code: `WH-ADV-1-${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const whA2 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Adv WH 2 ${timestamp}`,
        code: `WH-ADV-2-${timestamp}`,
      },
    });
    whA2Id = whA2.id;
  });

  afterAll(async () => {
    await appModule.close();
  });

  describe('1. Concurrent ISSUE Operations & Negative Stock Prevention', () => {
    it('10 concurrent ISSUE requests of -15.0000 against stock 100.0000 never result in negative stock', async () => {
      // Initialize balance to 100.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
        referenceType: 'INIT',
        referenceId: 'INIT-P1',
      });

      // Send 10 concurrent ISSUE -15.0000 requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        mutationService
          .mutateStock({
            organizationId: orgAId,
            actorUserId: userAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
            type: 'ISSUE',
            quantityDelta: '-15.0000',
            referenceType: 'RACE',
            referenceId: `ISSUE-${i}`,
          })
          .then((res) => ({ status: 'fulfilled' as const, value: res }))
          .catch((err) => ({ status: 'rejected' as const, reason: err })),
      );

      const results = await Promise.all(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // 100 / 15 = 6 full deductions (total 90.0000), leaving 10.0000
      expect(fulfilled).toHaveLength(6);
      expect(rejected).toHaveLength(4);

      for (const r of rejected) {
        if (r.status === 'rejected') {
          expect(r.reason).toBeInstanceOf(StockInsufficientQuantityException);
        }
      }

      // Verify PostgreSQL database state
      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });

      expect(balance.quantity.toString()).toBe('10');
      expect(balance.quantity.toNumber()).toBeGreaterThanOrEqual(0);

      // Verify ledger entry count: 1 OPENING + 6 successful ISSUE = 7 entries
      const ledgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId, productId: prodA1Id, warehouseId: whA1Id },
      });
      expect(ledgerCount).toBe(7);
    });

    it('20 concurrent ISSUE requests of -10.0000 against stock 100.0000 reach exactly 0.0000 with 0 lost updates', async () => {
      // Initialize balance on prodA2 to 100.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: prodA2Id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
        referenceType: 'INIT',
        referenceId: 'INIT-P2',
      });

      // 20 concurrent requests each requesting -10.0000
      const promises = Array.from({ length: 20 }, (_, i) =>
        mutationService
          .mutateStock({
            organizationId: orgAId,
            actorUserId: userAId,
            productId: prodA2Id,
            warehouseId: whA1Id,
            type: 'ISSUE',
            quantityDelta: '-10.0000',
            referenceType: 'RACE20',
            referenceId: `ISSUE20-${i}`,
          })
          .then((res) => ({ status: 'fulfilled' as const, value: res }))
          .catch((err) => ({ status: 'rejected' as const, reason: err })),
      );

      const results = await Promise.all(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(10);
      expect(rejected).toHaveLength(10);

      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whA1Id,
          },
        },
      });

      expect(balance.quantity.toString()).toBe('0');

      const ledgerEntries = await prisma.stockLedgerEntry.findMany({
        where: { organizationId: orgAId, productId: prodA2Id, warehouseId: whA1Id },
        orderBy: { createdAt: 'asc' },
      });
      // 1 OPENING + 10 ISSUE = 11 entries
      expect(ledgerEntries).toHaveLength(11);
    });
  });

  describe('2. First-Balance Creation Race', () => {
    it('10 concurrent mutations starting with NO StockBalance row create exactly 1 row with correct final balance', async () => {
      // Ensure NO StockBalance exists for prodA3 on whA2
      const existing = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA3Id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(existing).toBeNull();

      // Send 10 concurrent RECEIPT +10.0000 mutations
      const promises = Array.from({ length: 10 }, (_, i) =>
        mutationService.mutateStock({
          organizationId: orgAId,
          actorUserId: userAId,
          productId: prodA3Id,
          warehouseId: whA2Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
          referenceType: 'FIRST_RACE',
          referenceId: `FIRST-${i}`,
        }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Verify exactly ONE balance row exists in PostgreSQL
      const balances = await prisma.stockBalance.findMany({
        where: {
          organizationId: orgAId,
          productId: prodA3Id,
          warehouseId: whA2Id,
        },
      });
      expect(balances).toHaveLength(1);
      expect(balances[0]!.quantity.toString()).toBe('100');

      // Verify all 10 ledger entries exist
      const ledgerEntries = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          productId: prodA3Id,
          warehouseId: whA2Id,
        },
      });
      expect(ledgerEntries).toHaveLength(10);
    });
  });

  describe('3. Idempotency Race & Multi-Tenant Scoping', () => {
    it('20 concurrent identical requests with same idempotency key result in exactly 1 mutation', async () => {
      const idempotencyKey = `idem-race-${timestamp}`;

      const promises = Array.from({ length: 20 }, () =>
        mutationService.mutateStock({
          organizationId: orgAId,
          actorUserId: userAId,
          productId: prodA3Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '25.0000',
          idempotencyKey,
          referenceType: 'IDEM_RACE',
          referenceId: 'IDEM-REF-1',
        }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);

      // Verify all 20 returned identical ledgerEntry ID
      const firstEntryId = results[0]!.ledgerEntry.id;
      for (const res of results) {
        expect(res.ledgerEntry.id).toBe(firstEntryId);
      }

      // Exactly ONE ledger entry was created in PostgreSQL
      const entries = await prisma.stockLedgerEntry.findMany({
        where: { organizationId: orgAId, idempotencyKey },
      });
      expect(entries).toHaveLength(1);

      // Balance was only incremented by 25.0000 once
      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA3Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(balance.quantity.toString()).toBe('25');
    });

    it('Same idempotency key with DIFFERENT payload throws StockIdempotencyConflictException (409)', async () => {
      const conflictKey = `idem-conflict-${timestamp}`;

      // First mutation
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: prodA3Id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
        idempotencyKey: conflictKey,
      });

      // Attempt second mutation with different quantity
      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          actorUserId: userAId,
          productId: prodA3Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '20.0000', // mismatched payload
          idempotencyKey: conflictKey,
        }),
      ).rejects.toThrow(StockIdempotencyConflictException);
    });

    it('Same idempotency key across DIFFERENT organizations operates independently without collision', async () => {
      const crossTenantKey = `idem-shared-${timestamp}`;

      // Create product & warehouse in Org B
      const catB = await prisma.category.create({
        data: { organizationId: orgBId, name: `Adv Cat B ${timestamp}` },
      });
      const prodB = await prisma.product.create({
        data: {
          organizationId: orgBId,
          categoryId: catB.id,
          name: `Adv Prod B ${timestamp}`,
          sku: `SKU-ADV-B-${timestamp}`,
        },
      });
      const whB = await prisma.warehouse.create({
        data: {
          organizationId: orgBId,
          name: `Adv WH B ${timestamp}`,
          code: `WH-ADV-B-${timestamp}`,
        },
      });

      // Org A mutation with crossTenantKey
      const resA = await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: prodA1Id,
        warehouseId: whA2Id,
        type: 'RECEIPT',
        quantityDelta: '15.0000',
        idempotencyKey: crossTenantKey,
      });
      expect(resA.isIdempotentReplay).toBe(false);

      // Org B mutation with SAME crossTenantKey but Org B resources
      const resB = await mutationService.mutateStock({
        organizationId: orgBId,
        actorUserId: userBId,
        productId: prodB.id,
        warehouseId: whB.id,
        type: 'RECEIPT',
        quantityDelta: '30.0000',
        idempotencyKey: crossTenantKey,
      });
      expect(resB.isIdempotentReplay).toBe(false);

      // Both ledger rows exist independently
      const entries = await prisma.stockLedgerEntry.findMany({
        where: { idempotencyKey: crossTenantKey },
      });
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.organizationId).sort()).toEqual([orgAId, orgBId].sort());
    });
  });

  describe('4. Transaction Atomicity & Rollback Verification', () => {
    it('Failed mutation on non-existent product leaves zero balance or ledger trace', async () => {
      const countBefore = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          actorUserId: userAId,
          productId: '00000000-0000-4000-8000-000000000000',
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockProductNotFoundException);

      const countAfter = await prisma.stockLedgerEntry.count({ where: { organizationId: orgAId } });
      expect(countAfter).toBe(countBefore);
    });

    it('Failed mutation on non-existent warehouse leaves zero balance or ledger trace', async () => {
      const countBefore = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      await expect(
        mutationService.mutateStock({
          organizationId: orgAId,
          actorUserId: userAId,
          productId: prodA1Id,
          warehouseId: '00000000-0000-4000-8000-000000000000',
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        }),
      ).rejects.toThrow(StockWarehouseNotFoundException);

      const countAfter = await prisma.stockLedgerEntry.count({ where: { organizationId: orgAId } });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('5. Balance ↔ Ledger Mathematical Consistency', () => {
    it('Maintains exact mathematical consistency across Opening, Receipt, Issue, and Adjustment', async () => {
      // Create fresh product & warehouse
      const testProd = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          name: `Math Test Prod ${timestamp}`,
          sku: `SKU-MATH-${timestamp}`,
        },
      });

      // 1. Opening: +100.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: testProd.id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
      });

      // 2. Receipt: +25.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: testProd.id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '25.0000',
      });

      // 3. Issue: -30.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: testProd.id,
        warehouseId: whA1Id,
        type: 'ISSUE',
        quantityDelta: '-30.0000',
      });

      // 4. Adjustment: +5.0000
      await mutationService.mutateStock({
        organizationId: orgAId,
        actorUserId: userAId,
        productId: testProd.id,
        warehouseId: whA1Id,
        type: 'ADJUSTMENT',
        quantityDelta: '5.0000',
      });

      // Expected final balance: 100 + 25 - 30 + 5 = 100.0000
      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: testProd.id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(balance.quantity.toString()).toBe('100');

      // Fetch all ledger entries in chronological order
      const entries = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          productId: testProd.id,
          warehouseId: whA1Id,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(entries).toHaveLength(4);

      // Verify invariant: quantityAfter = quantityBefore + quantityDelta for every entry
      let runningTotal = new Prisma.Decimal(0);
      for (const entry of entries) {
        const expectedAfter = entry.quantityBefore.add(entry.quantityDelta);
        expect(entry.quantityAfter.toString()).toBe(expectedAfter.toString());
        runningTotal = runningTotal.add(entry.quantityDelta);
      }

      // Sum of all deltas strictly equals the authoritative balance
      expect(runningTotal.toString()).toBe(balance.quantity.toString());
    });
  });
});
