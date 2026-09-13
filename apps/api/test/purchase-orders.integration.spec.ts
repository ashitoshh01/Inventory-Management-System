import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaService } from '@repo/database';
import { PurchaseOrdersFoundationService } from '../src/modules/purchase-orders/purchase-orders-foundation.service';
import {
  PurchaseOrderCannotDeleteException,
  PurchaseOrderDuplicateNumberException,
  PurchaseOrderInvalidTransitionException,
  PurchaseOrderProductNotFoundException,
  PurchaseOrderWarehouseNotFoundException,
} from '../src/modules/purchase-orders/purchase-orders.errors';

describe('Phase 6A Purchase Order Foundation Integration Suite', () => {
  jest.setTimeout(30000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let poService: PurchaseOrdersFoundationService;

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
  let whB1Id: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    poService = appModule.get<PurchaseOrdersFoundationService>(PurchaseOrdersFoundationService);

    // 1. Create two isolated test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `po-org-a-${timestamp}`,
        name: `PO Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `po-org-b-${timestamp}`,
        name: `PO Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // 2. Create users in each organization
    const userA = await prisma.user.create({
      data: {
        email: `po-user-a-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `po-user-b-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    _userBId = userB.id;

    // 3. Create categories
    const catA = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `PO Cat A ${timestamp}`,
      },
    });
    catAId = catA.id;

    const catB = await prisma.category.create({
      data: {
        organizationId: orgBId,
        name: `PO Cat B ${timestamp}`,
      },
    });
    catBId = catB.id;

    // 4. Create products
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `PO-SKU-A1-${timestamp}`,
        name: 'Product A1',
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `PO-SKU-A2-${timestamp}`,
        name: 'Product A2',
      },
    });
    prodA2Id = prodA2.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catBId,
        sku: `PO-SKU-B1-${timestamp}`,
        name: 'Product B1',
      },
    });
    prodB1Id = prodB1.id;

    // 5. Create warehouses
    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        code: `PO-WHA1-${timestamp}`.toUpperCase(),
        name: `PO Warehouse A1 ${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const whB1 = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        code: `PO-WHB1-${timestamp}`.toUpperCase(),
        name: `PO Warehouse B1 ${timestamp}`,
      },
    });
    whB1Id = whB1.id;
  });

  afterAll(async () => {
    if (prisma) {
      const orgIds = [orgAId, orgBId].filter(Boolean);
      if (orgIds.length > 0) {
        await prisma.purchaseOrderLine.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.purchaseOrder.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.stockLedgerEntry.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.stockBalance.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.product.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.warehouse.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.category.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.auditEvent.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: orgIds } },
        });
      }
    }
    if (appModule) {
      await appModule.close();
    }
  });

  describe('1. Tenant Isolation Invariants', () => {
    it('succeeds when PO targets a warehouse in the same organization', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-TENANT-OK-${timestamp}`,
          supplierName: 'Acme Supply',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      expect(po.id).toBeDefined();
      expect(po.organizationId).toBe(orgAId);
      expect(po.warehouseId).toBe(whA1Id);
    });

    it('rejects PO referencing a warehouse from another organization', async () => {
      // whB1Id belongs to orgBId, attempting to create PO in orgAId
      await expect(
        poService.create(
          orgAId,
          {
            purchaseOrderNumber: `PO-CROSS-WH-${timestamp}`,
            supplierName: 'Acme Supply',
            warehouseId: whB1Id,
            lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
          },
          userAId,
        ),
      ).rejects.toThrow(PurchaseOrderWarehouseNotFoundException);
    });

    it('rejects PO line referencing a product from another organization', async () => {
      // prodB1Id belongs to orgBId, attempting to create PO line in orgAId
      await expect(
        poService.create(
          orgAId,
          {
            purchaseOrderNumber: `PO-CROSS-PROD-${timestamp}`,
            supplierName: 'Acme Supply',
            warehouseId: whA1Id,
            lines: [{ productId: prodB1Id, quantity: '5.0000', unitPrice: '10.0000' }],
          },
          userAId,
        ),
      ).rejects.toThrow(PurchaseOrderProductNotFoundException);
    });

    it('database composite foreign key rejects cross-tenant warehouse directly', async () => {
      await expect(
        prisma.purchaseOrder.create({
          data: {
            organizationId: orgAId,
            purchaseOrderNumber: `RAW-CROSS-WH-${timestamp}`,
            supplierName: 'Raw Supplier',
            warehouseId: whB1Id, // Belongs to Org B!
            subtotal: new Prisma.Decimal('10.0000'),
            taxTotal: new Prisma.Decimal('0.0000'),
            grandTotal: new Prisma.Decimal('10.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('database composite foreign key rejects cross-tenant product directly', async () => {
      // First create valid PO in Org A
      const po = await prisma.purchaseOrder.create({
        data: {
          organizationId: orgAId,
          purchaseOrderNumber: `RAW-PO-FOR-LINE-${timestamp}`,
          supplierName: 'Raw Supplier',
          warehouseId: whA1Id,
          subtotal: new Prisma.Decimal('10.0000'),
          taxTotal: new Prisma.Decimal('0.0000'),
          grandTotal: new Prisma.Decimal('10.0000'),
        },
      });

      // Attempt inserting line referencing Org B's product
      await expect(
        prisma.purchaseOrderLine.create({
          data: {
            organizationId: orgAId,
            purchaseOrderId: po.id,
            productId: prodB1Id, // Belongs to Org B!
            quantity: new Prisma.Decimal('1.0000'),
            unitPrice: new Prisma.Decimal('10.0000'),
            lineTotal: new Prisma.Decimal('10.0000'),
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('2. PO Number Uniqueness Invariants', () => {
    const poNumber = `PO-UNIQ-${timestamp}`;

    it('allows identical PO number across different organizations', async () => {
      const poA = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: poNumber,
          supplierName: 'Supplier A',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      const poB = await poService.create(
        orgBId,
        {
          purchaseOrderNumber: poNumber, // Identical PO number in different tenant
          supplierName: 'Supplier B',
          warehouseId: whB1Id,
          lines: [{ productId: prodB1Id, quantity: '1.0000', unitPrice: '15.0000' }],
        },
        _userBId,
      );

      expect(poA.purchaseOrderNumber).toBe(poNumber);
      expect(poB.purchaseOrderNumber).toBe(poNumber);
      expect(poA.organizationId).toBe(orgAId);
      expect(poB.organizationId).toBe(orgBId);
    });

    it('rejects duplicate PO number within the same organization', async () => {
      await expect(
        poService.create(
          orgAId,
          {
            purchaseOrderNumber: poNumber, // Already exists in Org A
            supplierName: 'Duplicate Supplier',
            warehouseId: whA1Id,
            lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
          },
          userAId,
        ),
      ).rejects.toThrow(PurchaseOrderDuplicateNumberException);
    });
  });

  describe('3. Concurrency & Race Condition Invariant', () => {
    it('concurrent requests attempting identical PO number in same org: exactly one succeeds', async () => {
      const racePoNumber = `PO-RACE-${timestamp}`;

      const attemptCreation = () =>
        poService.create(
          orgAId,
          {
            purchaseOrderNumber: racePoNumber,
            supplierName: 'Race Supplier',
            warehouseId: whA1Id,
            lines: [{ productId: prodA1Id, quantity: '2.0000', unitPrice: '5.0000' }],
          },
          userAId,
        );

      const results = await Promise.allSettled([attemptCreation(), attemptCreation()]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(PurchaseOrderDuplicateNumberException);
    });
  });

  describe('4. Transaction Boundary & Atomicity Invariants', () => {
    it('commits all lines atomically on valid creation', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-ATOMIC-OK-${timestamp}`,
          supplierName: 'Multi Line Supplier',
          warehouseId: whA1Id,
          lines: [
            { productId: prodA1Id, quantity: '10.0000', unitPrice: '12.5000' },
            { productId: prodA2Id, quantity: '4.0000', unitPrice: '25.0000' },
          ],
        },
        userAId,
      );

      expect(po.lines).toHaveLength(2);
      expect(po.subtotal).toBe('225.0000'); // (10 * 12.5) + (4 * 25) = 125 + 100 = 225
      expect(po.grandTotal).toBe('225.0000');

      const linesInDb = await prisma.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });
      expect(linesInDb).toHaveLength(2);
    });

    it('rolls back entire transaction if any line insertion fails', async () => {
      const rollbackPoNumber = `PO-ROLLBACK-${timestamp}`;

      // We simulate a failure in transaction by passing a cross-tenant product that bypasses validator
      // but fails inside transaction check
      await expect(
        poService.create(
          orgAId,
          {
            purchaseOrderNumber: rollbackPoNumber,
            supplierName: 'Fail Supplier',
            warehouseId: whA1Id,
            lines: [
              { productId: prodA1Id, quantity: '10.0000', unitPrice: '10.0000' },
              { productId: prodB1Id, quantity: '5.0000', unitPrice: '10.0000' }, // Invalid!
            ],
          },
          userAId,
        ),
      ).rejects.toThrow(PurchaseOrderProductNotFoundException);

      // Verify that NO PurchaseOrder row was committed
      const poInDb = await prisma.purchaseOrder.findFirst({
        where: { organizationId: orgAId, purchaseOrderNumber: rollbackPoNumber },
      });
      expect(poInDb).toBeNull();
    });
  });

  describe('5. Exact Quantity & Monetary Precision Invariants', () => {
    it('preserves exact 4-decimal precision in quantities and money', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-PRECISION-${timestamp}`,
          supplierName: 'Precision Supplier',
          warehouseId: whA1Id,
          lines: [
            {
              productId: prodA1Id,
              quantity: '0.1234',
              unitPrice: '100.5678',
            },
          ],
        },
        userAId,
      );

      expect(po.lines?.[0]?.quantity).toBe('0.1234');
      expect(po.lines?.[0]?.unitPrice).toBe('100.5678');
      // 0.1234 * 100.5678 = 12.41006652 -> toFixed(4) = 12.4101
      expect(po.lines?.[0]?.lineTotal).toBe('12.4101');
      expect(po.subtotal).toBe('12.4101');
      expect(po.grandTotal).toBe('12.4101');
    });

    it('database CHECK constraint rejects negative unit price', async () => {
      const po = await prisma.purchaseOrder.create({
        data: {
          organizationId: orgAId,
          purchaseOrderNumber: `RAW-NEG-PRICE-${timestamp}`,
          supplierName: 'Neg Supplier',
          warehouseId: whA1Id,
          subtotal: new Prisma.Decimal('0.0000'),
          taxTotal: new Prisma.Decimal('0.0000'),
          grandTotal: new Prisma.Decimal('0.0000'),
        },
      });

      await expect(
        prisma.purchaseOrderLine.create({
          data: {
            organizationId: orgAId,
            purchaseOrderId: po.id,
            productId: prodA1Id,
            quantity: new Prisma.Decimal('1.0000'),
            unitPrice: new Prisma.Decimal('-5.0000'), // Negative!
            lineTotal: new Prisma.Decimal('0.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('database CHECK constraint rejects zero quantity', async () => {
      const po = await prisma.purchaseOrder.create({
        data: {
          organizationId: orgAId,
          purchaseOrderNumber: `RAW-ZERO-QTY-${timestamp}`,
          supplierName: 'Zero Supplier',
          warehouseId: whA1Id,
          subtotal: new Prisma.Decimal('0.0000'),
          taxTotal: new Prisma.Decimal('0.0000'),
          grandTotal: new Prisma.Decimal('0.0000'),
        },
      });

      await expect(
        prisma.purchaseOrderLine.create({
          data: {
            organizationId: orgAId,
            purchaseOrderId: po.id,
            productId: prodA1Id,
            quantity: new Prisma.Decimal('0.0000'), // Zero!
            unitPrice: new Prisma.Decimal('10.0000'),
            lineTotal: new Prisma.Decimal('0.0000'),
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('6. State Machine & Lifecycle Transitions', () => {
    it('executes valid transitions DRAFT -> SUBMITTED -> APPROVED with audit trail', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-LIFECYCLE-${timestamp}`,
          supplierName: 'Lifecycle Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '20.0000' }],
        },
        userAId,
      );
      expect(po.status).toBe('DRAFT');

      // 1. DRAFT -> SUBMITTED
      const submitted = await poService.transitionStatus(orgAId, po.id, 'SUBMITTED', userAId);
      expect(submitted.status).toBe('SUBMITTED');

      // 2. SUBMITTED -> APPROVED
      const approved = await poService.transitionStatus(orgAId, po.id, 'APPROVED', userAId);
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedById).toBe(userAId);
      expect(approved.approvedAt).toBeDefined();

      // 3. Illegal transition: APPROVED -> DRAFT must throw
      await expect(poService.transitionStatus(orgAId, po.id, 'DRAFT', userAId)).rejects.toThrow(
        PurchaseOrderInvalidTransitionException,
      );

      // Verify audit trail
      const auditEvents = await prisma.auditEvent.findMany({
        where: { organizationId: orgAId, entityId: po.id },
        orderBy: { createdAt: 'asc' },
      });
      const actions = auditEvents.map((a) => a.action);
      expect(actions).toContain('PURCHASE_ORDER_CREATED');
      expect(actions).toContain('PURCHASE_ORDER_STATUS_CHANGED');
    });
  });

  describe('7. Deletion Policy & Referential Integrity', () => {
    it('allows deleting a DRAFT purchase order', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-DELETE-DRAFT-${timestamp}`,
          supplierName: 'Delete Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      await expect(poService.deleteDraft(orgAId, po.id, userAId)).resolves.not.toThrow();

      // Verify deleted from DB
      const deletedPo = await prisma.purchaseOrder.findFirst({ where: { id: po.id } });
      expect(deletedPo).toBeNull();
      const deletedLines = await prisma.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });
      expect(deletedLines).toHaveLength(0);
    });

    it('prohibits deleting a SUBMITTED purchase order', async () => {
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-DELETE-SUBMITTED-${timestamp}`,
          supplierName: 'Delete Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      await poService.transitionStatus(orgAId, po.id, 'SUBMITTED', userAId);

      await expect(poService.deleteDraft(orgAId, po.id, userAId)).rejects.toThrow(
        PurchaseOrderCannotDeleteException,
      );
    });

    it('prohibits deleting a warehouse referenced by an active purchase order', async () => {
      const tempWh = await prisma.warehouse.create({
        data: {
          organizationId: orgAId,
          code: `WH-DEL-TEST-${timestamp}`.toUpperCase(),
          name: `Delete Test WH ${timestamp}`,
        },
      });

      await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-WH-RESTRICT-${timestamp}`,
          supplierName: 'Restrict Supplier',
          warehouseId: tempWh.id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      // Deleting warehouse must fail with foreign key violation (onDelete: Restrict)
      await expect(
        prisma.warehouse.delete({
          where: { id: tempWh.id },
        }),
      ).rejects.toThrow();
    });

    it('prohibits deleting a product referenced by a purchase order line', async () => {
      const tempProd = await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: catAId,
          sku: `PROD-DEL-TEST-${timestamp}`,
          name: `Delete Test Prod ${timestamp}`,
        },
      });

      await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-PROD-RESTRICT-${timestamp}`,
          supplierName: 'Restrict Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: tempProd.id, quantity: '1.0000', unitPrice: '10.0000' }],
        },
        userAId,
      );

      // Deleting product must fail with foreign key violation (onDelete: Restrict)
      await expect(
        prisma.product.delete({
          where: { id: tempProd.id },
        }),
      ).rejects.toThrow();
    });
  });

  describe('8. CRITICAL Stock Boundary Invariant', () => {
    it('CONFIRMS Purchase Order creation and lifecycle changes do NOT mutate StockBalance or StockLedgerEntry', async () => {
      // 1. Measure initial stock balances and ledger count
      const initialBalancesCount = await prisma.stockBalance.count({
        where: { organizationId: orgAId },
      });
      const initialLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      // 2. Create Purchase Order
      const po = await poService.create(
        orgAId,
        {
          purchaseOrderNumber: `PO-STOCK-ISOLATED-${timestamp}`,
          supplierName: 'Stock Safety Supplier',
          warehouseId: whA1Id,
          lines: [
            { productId: prodA1Id, quantity: '500.0000', unitPrice: '10.0000' },
            { productId: prodA2Id, quantity: '250.0000', unitPrice: '20.0000' },
          ],
        },
        userAId,
      );

      // 3. Transition to SUBMITTED
      await poService.transitionStatus(orgAId, po.id, 'SUBMITTED', userAId);

      // 4. Transition to APPROVED
      await poService.transitionStatus(orgAId, po.id, 'APPROVED', userAId);

      // 5. Measure stock balances and ledger count after PO operations
      const postBalancesCount = await prisma.stockBalance.count({
        where: { organizationId: orgAId },
      });
      const postLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      // EXACT PARITY MUST BE MAINTAINED: Zero balance mutations, zero ledger entries
      expect(postBalancesCount).toBe(initialBalancesCount);
      expect(postLedgerCount).toBe(initialLedgerCount);
    });
  });
});
