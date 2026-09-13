import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaService } from '@repo/database';
import { TransfersService } from '../src/modules/transfers/transfers.service';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
import { StockTransferDuplicateNumberException } from '../src/modules/transfers/transfers.errors';
import { StockInsufficientQuantityException } from '../src/modules/stock/stock.errors';

describe('Phase 7A Stock Transfers Integration Suite', () => {
  jest.setTimeout(45000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let transfersService: TransfersService;
  let stockMutationService: StockMutationService;

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
  let whSourceAId: string;
  let whDestAId: string;
  let whBId: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    transfersService = appModule.get<TransfersService>(TransfersService);
    stockMutationService = appModule.get<StockMutationService>(StockMutationService);

    // 1. Create two isolated test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `tr-org-a-${timestamp}`,
        name: `Transfer Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `tr-org-b-${timestamp}`,
        name: `Transfer Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // 2. Create users
    const userA = await prisma.user.create({
      data: {
        email: `tr-user-a-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `tr-user-b-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    _userBId = userB.id;

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
        userId: _userBId,
        organizationId: orgBId,
        roleId: role.id,
      },
    });

    // 3. Create categories
    const catA = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Transfer Cat A ${timestamp}`,
      },
    });
    catAId = catA.id;

    const catB = await prisma.category.create({
      data: {
        organizationId: orgBId,
        name: `Transfer Cat B ${timestamp}`,
      },
    });
    catBId = catB.id;

    // 4. Create products
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `TR-SKU-A1-${timestamp}`,
        name: 'Transfer Product A1',
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catAId,
        sku: `TR-SKU-A2-${timestamp}`,
        name: 'Transfer Product A2',
      },
    });
    prodA2Id = prodA2.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catBId,
        sku: `TR-SKU-B1-${timestamp}`,
        name: 'Transfer Product B1',
      },
    });
    prodB1Id = prodB1.id;

    // 5. Create warehouses
    const whSourceA = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Source WH A ${timestamp}`,
        code: `WH-SRC-${timestamp}`,
      },
    });
    whSourceAId = whSourceA.id;

    const whDestA = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Dest WH A ${timestamp}`,
        code: `WH-DST-${timestamp}`,
      },
    });
    whDestAId = whDestA.id;

    const whB = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `WH B ${timestamp}`,
        code: `WH-B-${timestamp}`,
      },
    });
    whBId = whB.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.stockTransferLine.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.stockTransfer.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.stockLedgerEntry.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.stockBalance.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.product.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.category.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.warehouse.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organizationMembership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, _userBId] } },
    });

    await appModule.close();
  });

  describe('PostgreSQL Database Invariants & Check Constraints', () => {
    it('enforces check constraint rejecting sourceWarehouseId == destinationWarehouseId directly in PostgreSQL', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "StockTransfer" ("id", "organizationId", "transferNumber", "status", "sourceWarehouseId", "destinationWarehouseId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${orgAId}, ${`TR-RAW-${timestamp}`}, 'DRAFT'::"StockTransferStatus", ${whSourceAId}, ${whSourceAId}, NOW(), NOW());
        `,
      ).rejects.toThrow();
    });

    it('enforces check constraint rejecting non-positive quantity directly in PostgreSQL', async () => {
      const transfer = await prisma.stockTransfer.create({
        data: {
          organizationId: orgAId,
          transferNumber: `TR-CHK-${timestamp}`,
          status: 'DRAFT',
          sourceWarehouseId: whSourceAId,
          destinationWarehouseId: whDestAId,
        },
      });

      await expect(
        prisma.$executeRaw`
          INSERT INTO "StockTransferLine" ("id", "organizationId", "transferId", "productId", "quantity", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${orgAId}, ${transfer.id}, ${prodA1Id}, 0, NOW(), NOW());
        `,
      ).rejects.toThrow();

      await expect(
        prisma.$executeRaw`
          INSERT INTO "StockTransferLine" ("id", "organizationId", "transferId", "productId", "quantity", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${orgAId}, ${transfer.id}, ${prodA1Id}, -5, NOW(), NOW());
        `,
      ).rejects.toThrow();
    });

    it('enforces composite foreign key rejecting cross-tenant source warehouse', async () => {
      await expect(
        prisma.stockTransfer.create({
          data: {
            organizationId: orgAId,
            transferNumber: `TR-XWH-${timestamp}`,
            status: 'DRAFT',
            sourceWarehouseId: whBId, // Belongs to Org B!
            destinationWarehouseId: whDestAId,
          },
        }),
      ).rejects.toThrow();
    });

    it('enforces composite foreign key rejecting cross-tenant destination warehouse', async () => {
      await expect(
        prisma.stockTransfer.create({
          data: {
            organizationId: orgAId,
            transferNumber: `TR-XWHD-${timestamp}`,
            status: 'DRAFT',
            sourceWarehouseId: whSourceAId,
            destinationWarehouseId: whBId, // Belongs to Org B!
          },
        }),
      ).rejects.toThrow();
    });

    it('enforces composite foreign key rejecting cross-tenant product in lines', async () => {
      const transfer = await prisma.stockTransfer.create({
        data: {
          organizationId: orgAId,
          transferNumber: `TR-XPROD-${timestamp}`,
          status: 'DRAFT',
          sourceWarehouseId: whSourceAId,
          destinationWarehouseId: whDestAId,
        },
      });

      await expect(
        prisma.stockTransferLine.create({
          data: {
            organizationId: orgAId,
            transferId: transfer.id,
            productId: prodB1Id, // Belongs to Org B!
            quantity: new Prisma.Decimal('10.0000'),
          },
        }),
      ).rejects.toThrow();
    });

    it('enforces unique transferNumber per organization', async () => {
      const transferNumber = `TR-UNIQ-${timestamp}`;
      await transfersService.create(orgAId, userAId, {
        transferNumber,
        sourceWarehouseId: whSourceAId,
        destinationWarehouseId: whDestAId,
        lines: [{ productId: prodA1Id, quantity: '5.0000' }],
      });

      await expect(
        transfersService.create(orgAId, userAId, {
          transferNumber,
          sourceWarehouseId: whSourceAId,
          destinationWarehouseId: whDestAId,
          lines: [{ productId: prodA1Id, quantity: '5.0000' }],
        }),
      ).rejects.toThrow(StockTransferDuplicateNumberException);

      // Same transfer number in Org B should succeed (multi-tenant uniqueness)
      const orgBTransfer = await transfersService.create(orgBId, userAId, {
        transferNumber,
        sourceWarehouseId: whBId,
        destinationWarehouseId: (
          await prisma.warehouse.create({
            data: {
              organizationId: orgBId,
              name: `Dest WH B ${timestamp}`,
              code: `WH-DST-B-${timestamp}`,
            },
          })
        ).id,
        lines: [{ productId: prodB1Id, quantity: '5.0000' }],
      });
      expect(orgBTransfer.transfer.transferNumber).toBe(transferNumber);
    });

    it('enforces unique productId per transfer in line items', async () => {
      const transfer = await prisma.stockTransfer.create({
        data: {
          organizationId: orgAId,
          transferNumber: `TR-DUPLN-${timestamp}`,
          status: 'DRAFT',
          sourceWarehouseId: whSourceAId,
          destinationWarehouseId: whDestAId,
        },
      });

      await prisma.stockTransferLine.create({
        data: {
          organizationId: orgAId,
          transferId: transfer.id,
          productId: prodA1Id,
          quantity: new Prisma.Decimal('5.0000'),
        },
      });

      // Second line with same product on same transfer rejected by @@unique([organizationId, transferId, productId])
      await expect(
        prisma.stockTransferLine.create({
          data: {
            organizationId: orgAId,
            transferId: transfer.id,
            productId: prodA1Id,
            quantity: new Prisma.Decimal('2.0000'),
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Full Stock Movement Integration Lifecycle', () => {
    it('preserves stock conservation across DRAFT -> APPROVED -> IN_TRANSIT -> RECEIVED', async () => {
      // Step 1: Initialize stock at source warehouse (50.0000 units of prodA2)
      await stockMutationService.mutateStock({
        organizationId: orgAId,
        productId: prodA2Id,
        warehouseId: whSourceAId,
        type: 'OPENING',
        quantityDelta: '50.0000',
        actorUserId: userAId,
      });

      const initialSourceBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(initialSourceBalance?.quantity.toFixed(4)).toBe('50.0000');

      // Step 2: Create Stock Transfer for 20.0000 units
      const { transfer: created } = await transfersService.create(orgAId, userAId, {
        transferNumber: `TR-FLOW-${timestamp}`,
        sourceWarehouseId: whSourceAId,
        destinationWarehouseId: whDestAId,
        notes: 'Move stock to secondary hub',
        lines: [{ productId: prodA2Id, quantity: '20.0000' }],
      });
      expect(created.status).toBe('DRAFT');

      // Check stock after creation: source still 50, dest still 0 (no stock moved)
      const afterCreateSource = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(afterCreateSource?.quantity.toFixed(4)).toBe('50.0000');

      // Step 3: Approve Transfer
      const approved = await transfersService.approve(created.id, orgAId, userAId);
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedById).toBe(userAId);

      // Check stock after approval: source still 50, dest still 0
      const afterApproveSource = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(afterApproveSource?.quantity.toFixed(4)).toBe('50.0000');

      // Step 4: Dispatch / Ship Transfer to IN_TRANSIT
      const shipResult = await transfersService.ship(created.id, orgAId, userAId, {
        notes: 'Truck dispatched',
      });
      expect(shipResult.status).toBe('IN_TRANSIT');
      expect(shipResult.isIdempotentReplay).toBe(false);

      // Check stock after dispatch:
      // Source on-hand decreased from 50.0000 to 30.0000!
      // Destination on-hand is still 0.0000!
      // (Satisfies requirement: Transferred stock moves into IN_TRANSIT state before arrival)
      const afterShipSource = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(afterShipSource?.quantity.toFixed(4)).toBe('30.0000');

      const afterShipDest = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whDestAId,
          },
        },
      });
      expect(afterShipDest ? afterShipDest.quantity.toFixed(4) : '0.0000').toBe('0.0000');

      // Verify source ledger entry written with type: ISSUE, delta: -20.0000
      const sourceLedger = await prisma.stockLedgerEntry.findFirst({
        where: {
          organizationId: orgAId,
          productId: prodA2Id,
          warehouseId: whSourceAId,
          referenceType: 'STOCK_TRANSFER',
          referenceId: created.id,
        },
      });
      expect(sourceLedger).toBeDefined();
      expect(sourceLedger?.type).toBe('ISSUE');
      expect(sourceLedger?.quantityDelta.toFixed(4)).toBe('-20.0000');
      expect(sourceLedger?.quantityBefore.toFixed(4)).toBe('50.0000');
      expect(sourceLedger?.quantityAfter.toFixed(4)).toBe('30.0000');

      // Step 5: Receive Transfer at Destination Warehouse
      const receiveResult = await transfersService.receive(created.id, orgAId, userAId, {
        notes: 'Goods received in good condition',
      });
      expect(receiveResult.status).toBe('RECEIVED');
      expect(receiveResult.isIdempotentReplay).toBe(false);

      // Check stock after receive:
      // Source remains 30.0000
      // Destination is now 20.0000!
      // Total organization stock across both warehouses = 30 + 20 = 50 (Stock conserved!)
      const finalSource = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(finalSource?.quantity.toFixed(4)).toBe('30.0000');

      const finalDest = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whDestAId,
          },
        },
      });
      expect(finalDest?.quantity.toFixed(4)).toBe('20.0000');

      // Verify destination ledger entry written with type: RECEIPT, delta: 20.0000
      const destLedger = await prisma.stockLedgerEntry.findFirst({
        where: {
          organizationId: orgAId,
          productId: prodA2Id,
          warehouseId: whDestAId,
          referenceType: 'STOCK_TRANSFER',
          referenceId: created.id,
        },
      });
      expect(destLedger).toBeDefined();
      expect(destLedger?.type).toBe('RECEIPT');
      expect(destLedger?.quantityDelta.toFixed(4)).toBe('20.0000');
      expect(destLedger?.quantityBefore.toFixed(4)).toBe('0.0000');
      expect(destLedger?.quantityAfter.toFixed(4)).toBe('20.0000');

      // Step 6: Verify audit trail
      const auditTrail = await transfersService.getAuditTrail(orgAId, created.id);
      const actions = auditTrail.map((a) => a.action);
      expect(actions).toContain('stock-transfer.created');
      expect(actions).toContain('stock-transfer.approved');
      expect(actions).toContain('stock-transfer.shipped');
      expect(actions).toContain('stock-transfer.received');
    });

    it('rejects dispatch with StockInsufficientQuantityException when source stock is insufficient and rolls back', async () => {
      // Currently source warehouse has 30.0000 of prodA2.
      // Create transfer requesting 100.0000 units.
      const { transfer: overTransfer } = await transfersService.create(orgAId, userAId, {
        transferNumber: `TR-OVER-${timestamp}`,
        sourceWarehouseId: whSourceAId,
        destinationWarehouseId: whDestAId,
        lines: [{ productId: prodA2Id, quantity: '100.0000' }],
      });

      await transfersService.approve(overTransfer.id, orgAId, userAId);

      // Attempting to ship 100 units must fail atomically
      await expect(transfersService.ship(overTransfer.id, orgAId, userAId, {})).rejects.toThrow(
        StockInsufficientQuantityException,
      );

      // Assert transfer remains APPROVED (transaction rollback)
      const afterFailTransfer = await transfersService.findOne(overTransfer.id, orgAId);
      expect(afterFailTransfer.status).toBe('APPROVED');

      // Assert source balance is unchanged at 30.0000
      const sourceBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(sourceBalance?.quantity.toFixed(4)).toBe('30.0000');
    });

    it('cancelling a DRAFT or APPROVED transfer does not mutate stock', async () => {
      const { transfer: cancelTransfer } = await transfersService.create(orgAId, userAId, {
        transferNumber: `TR-CANCEL-${timestamp}`,
        sourceWarehouseId: whSourceAId,
        destinationWarehouseId: whDestAId,
        lines: [{ productId: prodA2Id, quantity: '5.0000' }],
      });

      const cancelled = await transfersService.cancel(cancelTransfer.id, orgAId, userAId);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledById).toBe(userAId);

      // Source stock remains 30.0000
      const sourceBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whSourceAId,
          },
        },
      });
      expect(sourceBalance?.quantity.toFixed(4)).toBe('30.0000');
    });
  });
});
