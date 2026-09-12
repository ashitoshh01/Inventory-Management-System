import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaService } from '@repo/database';
import { StockFoundationService } from '../src/modules/stock/stock-foundation.service';
import { StockQuantityValidator } from '../src/modules/stock/stock.quantity';
import { StockInvalidQuantityException } from '../src/modules/stock/stock.errors';

describe('Phase 5A Stock & Inventory Database and Domain Foundation Suite', () => {
  jest.setTimeout(30000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let stockService: StockFoundationService;

  const timestamp = Date.now();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let _userBId: string;
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
    stockService = appModule.get<StockFoundationService>(StockFoundationService);

    // 1. Create two isolated test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `stock-org-a-${timestamp}`,
        name: `Stock Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `stock-org-b-${timestamp}`,
        name: `Stock Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // 2. Create users
    const userA = await prisma.user.create({
      data: {
        email: `stock-user-a-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `stock-user-b-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    _userBId = userB.id;

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
        sku: `SKU-A1-${timestamp}`,
        name: 'Product A1',
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `SKU-A2-${timestamp}`,
        name: 'Product A2',
      },
    });
    prodA2Id = prodA2.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catBId,
        sku: `SKU-B1-${timestamp}`,
        name: 'Product B1',
      },
    });
    prodB1Id = prodB1.id;

    // 5. Create warehouses
    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A1 ${timestamp}`,
        code: `WHA1-${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const whA2 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A2 ${timestamp}`,
        code: `WHA2-${timestamp}`,
      },
    });
    whA2Id = whA2.id;

    const whB1 = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `Warehouse B1 ${timestamp}`,
        code: `WHB1-${timestamp}`,
      },
    });
    whB1Id = whB1.id;
  });

  afterAll(async () => {
    if (prisma) {
      const orgIds = [orgAId, orgBId].filter(Boolean);
      const userEmails = [
        `stock-user-a-${timestamp}@test.com`,
        `stock-user-b-${timestamp}@test.com`,
      ];

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
        await prisma.organizationMembership.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.auditEvent.deleteMany({
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

  describe('Section 31: Database Integrity Tests A-L', () => {
    it('A. Same-tenant Product + Warehouse -> StockBalance creation possible', async () => {
      const balance = await prisma.stockBalance.create({
        data: {
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA1Id,
          quantity: new Prisma.Decimal('100.0000'),
        },
      });

      expect(balance).toBeDefined();
      expect(balance.id).toBeDefined();
      expect(balance.organizationId).toBe(orgAId);
      expect(balance.productId).toBe(prodA1Id);
      expect(balance.warehouseId).toBe(whA1Id);
      expect(balance.quantity.toString()).toBe('100');
    });

    it('B. Cross-tenant Product reference -> rejected by composite foreign key constraint', async () => {
      // Attempting to create a balance in Org A referencing Product from Org B
      await expect(
        prisma.stockBalance.create({
          data: {
            organizationId: orgAId,
            productId: prodB1Id, // Belongs to Org B!
            warehouseId: whA1Id,
            quantity: new Prisma.Decimal('50.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('C. Cross-tenant Warehouse reference -> rejected by composite foreign key constraint', async () => {
      // Attempting to create a balance in Org A referencing Warehouse from Org B
      await expect(
        prisma.stockBalance.create({
          data: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whB1Id, // Belongs to Org B!
            quantity: new Prisma.Decimal('50.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('D. Duplicate StockBalance -> rejected by composite unique constraint', async () => {
      // Balance for (orgAId, prodA1Id, whA1Id) already exists from Test A
      await expect(
        prisma.stockBalance.create({
          data: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
            quantity: new Prisma.Decimal('200.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('E. Same product + same warehouse + same organization -> exactly one balance exists', async () => {
      const count = await prisma.stockBalance.count({
        where: {
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA1Id,
        },
      });
      expect(count).toBe(1);
    });

    it('F. Same product + different warehouse -> allowed', async () => {
      const balance = await prisma.stockBalance.create({
        data: {
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA2Id, // Different warehouse in same Org A
          quantity: new Prisma.Decimal('25.5000'),
        },
      });

      expect(balance).toBeDefined();
      expect(balance.warehouseId).toBe(whA2Id);
    });

    it('G. Different product + same warehouse -> allowed', async () => {
      const balance = await prisma.stockBalance.create({
        data: {
          organizationId: orgAId,
          productId: prodA2Id, // Different product in same warehouse
          warehouseId: whA1Id,
          quantity: new Prisma.Decimal('75.2500'),
        },
      });

      expect(balance).toBeDefined();
      expect(balance.productId).toBe(prodA2Id);
    });

    it('H. Same SKU/product code across different organizations -> isolated', async () => {
      const sharedSku = `SHARED-SKU-${timestamp}`;

      const prodA = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: sharedSku,
          name: 'Shared Product A',
        },
      });

      const prodB = await prisma.product.create({
        data: {
          organizationId: orgBId,
          categoryId: catBId,
          sku: sharedSku,
          name: 'Shared Product B',
        },
      });

      const balanceA = await prisma.stockBalance.create({
        data: {
          organizationId: orgAId,
          productId: prodA.id,
          warehouseId: whA1Id,
          quantity: new Prisma.Decimal('10.0000'),
        },
      });

      const balanceB = await prisma.stockBalance.create({
        data: {
          organizationId: orgBId,
          productId: prodB.id,
          warehouseId: whB1Id,
          quantity: new Prisma.Decimal('20.0000'),
        },
      });

      expect(balanceA.organizationId).toBe(orgAId);
      expect(balanceB.organizationId).toBe(orgBId);
      expect(balanceA.quantity.toString()).toBe('10');
      expect(balanceB.quantity.toString()).toBe('20');
    });

    it('I. Organization cascade behavior -> deleting organization cascades to stock records', async () => {
      // Create dedicated ephemeral org to test cascade
      const ephemOrg = await prisma.organization.create({
        data: {
          slug: `ephem-org-${timestamp}`,
          name: `Ephemeral Org ${timestamp}`,
        },
      });

      const ephemCat = await prisma.category.create({
        data: {
          organizationId: ephemOrg.id,
          name: 'Ephem Category',
        },
      });

      const ephemProd = await prisma.product.create({
        data: {
          organizationId: ephemOrg.id,
          categoryId: ephemCat.id,
          sku: `EPHEM-${timestamp}`,
          name: 'Ephem Product',
        },
      });

      const ephemWh = await prisma.warehouse.create({
        data: {
          organizationId: ephemOrg.id,
          name: 'Ephem Warehouse',
          code: `EPHEM-WH-${timestamp}`,
        },
      });

      const ephemBalance = await prisma.stockBalance.create({
        data: {
          organizationId: ephemOrg.id,
          productId: ephemProd.id,
          warehouseId: ephemWh.id,
          quantity: new Prisma.Decimal('100.0000'),
        },
      });

      const ephemLedger = await prisma.stockLedgerEntry.create({
        data: {
          organizationId: ephemOrg.id,
          productId: ephemProd.id,
          warehouseId: ephemWh.id,
          quantityDelta: new Prisma.Decimal('100.0000'),
          quantityBefore: new Prisma.Decimal('0.0000'),
          quantityAfter: new Prisma.Decimal('100.0000'),
          type: 'OPENING',
        },
      });

      // Delete the organization
      await prisma.organization.delete({
        where: { id: ephemOrg.id },
      });

      // Verify cascading deletion of stock records
      const balanceCheck = await prisma.stockBalance.findUnique({
        where: { id: ephemBalance.id },
      });
      const ledgerCheck = await prisma.stockLedgerEntry.findUnique({
        where: { id: ephemLedger.id },
      });

      expect(balanceCheck).toBeNull();
      expect(ledgerCheck).toBeNull();
    });

    it('J. Product deletion behavior -> restricted when stock history exists', async () => {
      // prodA1 has stock balances in whA1 and whA2
      await expect(
        prisma.product.delete({
          where: { id: prodA1Id },
        }),
      ).rejects.toThrow();
    });

    it('K. Warehouse deletion behavior -> restricted when stock history exists', async () => {
      // whA1 has stock balances
      await expect(
        prisma.warehouse.delete({
          where: { id: whA1Id },
        }),
      ).rejects.toThrow();
    });

    it('L. Ledger foreign-key integrity -> cross-tenant references on StockLedgerEntry rejected', async () => {
      // Attempting to create ledger entry in Org A referencing Product from Org B
      await expect(
        prisma.stockLedgerEntry.create({
          data: {
            organizationId: orgAId,
            productId: prodB1Id, // Cross-tenant!
            warehouseId: whA1Id,
            quantityDelta: new Prisma.Decimal('10.0000'),
            quantityBefore: new Prisma.Decimal('0.0000'),
            quantityAfter: new Prisma.Decimal('10.0000'),
            type: 'RECEIPT',
          },
        }),
      ).rejects.toThrow();

      // Attempting to create ledger entry in Org A referencing Warehouse from Org B
      await expect(
        prisma.stockLedgerEntry.create({
          data: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whB1Id, // Cross-tenant!
            quantityDelta: new Prisma.Decimal('10.0000'),
            quantityBefore: new Prisma.Decimal('0.0000'),
            quantityAfter: new Prisma.Decimal('10.0000'),
            type: 'RECEIPT',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Section 32: Ledger Immutability & Architectural Invariant', () => {
    it('verifies that StockFoundationService exposes no mutation or deletion methods on ledger entries', () => {
      // Inspect methods on service
      const servicePrototype = Object.getPrototypeOf(stockService);
      const propertyNames = Object.getOwnPropertyNames(servicePrototype);

      expect(propertyNames).toContain('recordLedgerEntry');
      expect(propertyNames).toContain('getLedgerEntries');
      expect(propertyNames).toContain('getBalance');
      expect(propertyNames).toContain('listBalances');

      // Strict check: no update/delete/modify ledger methods
      expect(propertyNames).not.toContain('updateLedgerEntry');
      expect(propertyNames).not.toContain('deleteLedgerEntry');
      expect(propertyNames).not.toContain('modifyLedgerEntry');
    });

    it('verifies ledger append-only creation via domain service', async () => {
      const entry = await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '100.0000',
        quantityDelta: '50.0000',
        quantityAfter: '150.0000',
        type: 'RECEIPT',
        referenceType: 'MANUAL_TEST',
        referenceId: 'REF-001',
        createdById: userAId,
      });

      expect(entry).toBeDefined();
      expect(entry.quantityBefore).toBe('100.0000');
      expect(entry.quantityDelta).toBe('50.0000');
      expect(entry.quantityAfter).toBe('150.0000');
      expect(entry.type).toBe('RECEIPT');
      expect(entry.createdById).toBe(userAId);
    });
  });

  describe('Section 33: Quantity Exactness and Precision', () => {
    it('persists exact decimal quantities up to 4 decimal places without floating-point error', async () => {
      const testValues = ['0.0000', '1.0000', '1.2500', '0.0001', '12345.6789'];

      for (const val of testValues) {
        const delta = val === '0.0000' ? '1.0000' : val;
        const entry = await stockService.recordLedgerEntry(orgAId, {
          productId: prodA2Id,
          warehouseId: whA2Id,
          quantityBefore: '0.0000',
          quantityDelta: delta,
          quantityAfter: delta,
          type: 'OPENING',
        });

        expect(entry.quantityAfter).toBe(StockQuantityValidator.validatePrecision(delta));
      }
    });

    it('rejects unsupported precision beyond 4 decimal places', async () => {
      await expect(
        stockService.recordLedgerEntry(orgAId, {
          productId: prodA1Id,
          warehouseId: whA1Id,
          quantityBefore: '0.0000',
          quantityDelta: '0.00001', // 5 decimal places!
          quantityAfter: '0.00001',
          type: 'ADJUSTMENT',
        }),
      ).rejects.toThrow(StockInvalidQuantityException);
    });

    it('handles negative deltas exactly (e.g. ISSUE / deduction)', async () => {
      const entry = await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '150.0000',
        quantityDelta: '-20.5000',
        quantityAfter: '129.5000',
        type: 'ISSUE',
      });

      expect(entry.quantityDelta).toBe('-20.5000');
      expect(entry.quantityAfter).toBe('129.5000');
    });
  });

  describe('Section 34: Idempotency Key Constraint', () => {
    it('rejects duplicate idempotencyKey within the same organization', async () => {
      const idempotencyKey = `IDEMP-KEY-TEST-${timestamp}`;

      await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '0.0000',
        quantityDelta: '10.0000',
        quantityAfter: '10.0000',
        type: 'OPENING',
        idempotencyKey,
      });

      // Second attempt with same organization and same key must be rejected by unique constraint
      await expect(
        stockService.recordLedgerEntry(orgAId, {
          productId: prodA1Id,
          warehouseId: whA1Id,
          quantityBefore: '10.0000',
          quantityDelta: '10.0000',
          quantityAfter: '20.0000',
          type: 'RECEIPT',
          idempotencyKey,
        }),
      ).rejects.toThrow();
    });

    it('allows identical idempotencyKey across different organizations', async () => {
      const crossOrgKey = `CROSS-ORG-KEY-${timestamp}`;

      const entryA = await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '10.0000',
        quantityDelta: '5.0000',
        quantityAfter: '15.0000',
        type: 'RECEIPT',
        idempotencyKey: crossOrgKey,
      });

      const entryB = await stockService.recordLedgerEntry(orgBId, {
        productId: prodB1Id,
        warehouseId: whB1Id,
        quantityBefore: '0.0000',
        quantityDelta: '5.0000',
        quantityAfter: '5.0000',
        type: 'OPENING',
        idempotencyKey: crossOrgKey,
      });

      expect(entryA.idempotencyKey).toBe(crossOrgKey);
      expect(entryB.idempotencyKey).toBe(crossOrgKey);
      expect(entryA.organizationId).toBe(orgAId);
      expect(entryB.organizationId).toBe(orgBId);
    });

    it('allows multiple rows with null idempotencyKey within the same organization', async () => {
      const entry1 = await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '15.0000',
        quantityDelta: '1.0000',
        quantityAfter: '16.0000',
        type: 'RECEIPT',
        idempotencyKey: undefined,
      });

      const entry2 = await stockService.recordLedgerEntry(orgAId, {
        productId: prodA1Id,
        warehouseId: whA1Id,
        quantityBefore: '16.0000',
        quantityDelta: '1.0000',
        quantityAfter: '17.0000',
        type: 'RECEIPT',
        idempotencyKey: undefined,
      });

      expect(entry1.idempotencyKey).toBeNull();
      expect(entry2.idempotencyKey).toBeNull();
    });
  });

  describe('Section 29: Database-Level Mathematical Check Constraints', () => {
    it('database CHECK constraint rejects zero delta (StockLedgerEntry_delta_nonzero)', async () => {
      // Direct raw query / prisma create bypassing service validation
      await expect(
        prisma.stockLedgerEntry.create({
          data: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
            quantityDelta: new Prisma.Decimal('0.0000'), // Zero delta!
            quantityBefore: new Prisma.Decimal('10.0000'),
            quantityAfter: new Prisma.Decimal('10.0000'),
            type: 'ADJUSTMENT',
          },
        }),
      ).rejects.toThrow();
    });

    it('database CHECK constraint rejects inconsistent math (StockLedgerEntry_math_consistent)', async () => {
      // 10.0000 + 5.0000 != 20.0000
      await expect(
        prisma.stockLedgerEntry.create({
          data: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
            quantityDelta: new Prisma.Decimal('5.0000'),
            quantityBefore: new Prisma.Decimal('10.0000'),
            quantityAfter: new Prisma.Decimal('20.0000'), // Inconsistent!
            type: 'RECEIPT',
          },
        }),
      ).rejects.toThrow();
    });
  });
});
