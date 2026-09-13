import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Purchase Order Receiving & Inventory Integration (e2e)', () => {
  jest.setTimeout(90000);
  let app: INestApplication;
  let prisma: PrismaService;
  let stockMutationService: StockMutationService;

  const timestamp = Date.now();
  const ownerUserA = { email: `rec-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `rec-owner-b-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;

  let tokenB: string;
  let orgBId: string;

  let prodA1Id: string;
  let prodA2Id: string;
  let prodA3Id: string;
  let whA1Id: string;

  let prodBId: string;
  let whBId: string;

  beforeAll(async () => {
    const logger = new StructuredLogger();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health/{*path}', 'api/v1/health/{*path}'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    stockMutationService = app.get<StockMutationService>(StockMutationService);

    // 1. Setup Org A and Owner A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserA, organizationName: `Rec Org A ${timestamp}` });
    orgAId = resA.body.data.organization.id;
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserA);
    tokenA = loginA.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 2. Setup Org B and Owner B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserB, organizationName: `Rec Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure permissions exist and assign to Owner role
    const poPerms = [
      'purchase-order.read',
      'purchase-order.create',
      'purchase-order.update',
      'purchase-order.delete',
      'purchase-order.submit',
      'purchase-order.approve',
      'purchase-order.receive',
      'purchase-order.cancel',
      'stock.read',
      'stock.mutate',
    ];
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of poPerms) {
        let perm = await prisma.permission.findFirst({ where: { action } });
        if (!perm) {
          perm = await prisma.permission.create({ data: { action, description: action } });
        }
        const exists = await prisma.rolePermission.findFirst({
          where: { roleId: ownerRole.id, permissionId: perm.id },
        });
        if (!exists) {
          await prisma.rolePermission.create({
            data: { roleId: ownerRole.id, permissionId: perm.id },
          });
        }
      }
    }

    // 5. Setup test Catalog & Warehouses
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Cat A ${timestamp}` },
    });
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Product A1',
        sku: `SKU-A1-${timestamp}`,
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Product A2',
        sku: `SKU-A2-${timestamp}`,
      },
    });
    prodA2Id = prodA2.id;

    const prodA3 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Product A3',
        sku: `SKU-A3-${timestamp}`,
      },
    });
    prodA3Id = prodA3.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `WH A1 ${timestamp}`,
        code: `WHA1-${timestamp.toString().slice(-4)}`,
      },
    });
    whA1Id = whA1.id;

    // Setup Org B Catalog & Warehouse
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `Cat B ${timestamp}` },
    });
    const prodB = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        name: 'Product B1',
        sku: `SKU-B1-${timestamp}`,
      },
    });
    prodBId = prodB.id;

    const whB = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `WH B1 ${timestamp}`,
        code: `WHB1-${timestamp.toString().slice(-4)}`,
      },
    });
    whBId = whB.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create and approve an order
  async function createApprovedOrder(
    poNum: string,
    lines: Array<{ productId: string; quantity: string; unitPrice: string }>,
  ) {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [`accessToken=${tokenA}`])
      .set('x-organization-id', orgAId)
      .send({
        purchaseOrderNumber: poNum,
        supplierName: 'Reliable Supplier Inc',
        warehouseId: whA1Id,
        lines,
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id;

    // Submit
    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${orderId}/submit`)
      .set('Cookie', [`accessToken=${tokenA}`])
      .set('x-organization-id', orgAId);
    expect(submitRes.status).toBe(201);

    // Approve
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${orderId}/approve`)
      .set('Cookie', [`accessToken=${tokenA}`])
      .set('x-organization-id', orgAId);
    expect(approveRes.status).toBe(201);

    return approveRes.body.data;
  }

  describe('1. Lifecycle Eligibility & Validation', () => {
    it('rejects receiving on DRAFT purchase order with 400 Bad Request', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-DRAFT-${timestamp}`,
          supplierName: 'Vendor',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' }],
        });
      const order = createRes.body.data;

      const receiveRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '5.0000' }],
        });

      expect(receiveRes.status).toBe(400);
      expect(receiveRes.body.error.code).toBe('PURCHASE_ORDER_NOT_APPROVED_FOR_RECEIPT');
    });

    it('rejects receiving on SUBMITTED purchase order with 400 Bad Request', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-SUBMITTED-${timestamp}`,
          supplierName: 'Vendor',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' }],
        });
      const order = createRes.body.data;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/submit`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      const receiveRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '5.0000' }],
        });

      expect(receiveRes.status).toBe(400);
      expect(receiveRes.body.error.code).toBe('PURCHASE_ORDER_NOT_APPROVED_FOR_RECEIPT');
    });

    it('rejects receiving with empty lines array with 400 Bad Request', async () => {
      const order = await createApprovedOrder(`PO-EMPTY-${timestamp}`, [
        { productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' },
      ]);

      const receiveRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ lines: [] });

      expect(receiveRes.status).toBe(400);
    });

    it('rejects zero or negative receipt quantity with 400 Bad Request', async () => {
      const order = await createApprovedOrder(`PO-ZERONEG-${timestamp}`, [
        { productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' },
      ]);

      const zeroRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '0.0000' }],
        });
      expect(zeroRes.status).toBe(400);

      const negRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '-5.0000' }],
        });
      expect(negRes.status).toBe(400);
    });

    it('rejects over-receiving beyond ordered quantity with 400 Bad Request', async () => {
      const order = await createApprovedOrder(`PO-OVERREC-${timestamp}`, [
        { productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' },
      ]);

      const overRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '10.0001' }],
        });

      expect(overRes.status).toBe(400);
      expect(overRes.body.error.code).toBe('PURCHASE_ORDER_OVER_RECEIPT_NOT_ALLOWED');
    });

    it('rejects non-existent line ID with 400 Bad Request', async () => {
      const order = await createApprovedOrder(`PO-NOEXIST-${timestamp}`, [
        { productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' },
      ]);

      const fakeLineRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: randomUUID(), quantity: '5.0000' }],
        });

      expect(fakeLineRes.status).toBe(400);
      expect(fakeLineRes.body.error.code).toBe('PURCHASE_ORDER_INVALID_LINE');
    });
  });

  describe('2. Atomic Partial & Final Receiving and Stock Mutation', () => {
    it('executes partial receipt, transitions to PARTIALLY_RECEIVED, and increases stock balance and ledger', async () => {
      // Check initial stock balance
      const initialBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      const initialQty = initialBalance ? Number(initialBalance.quantity) : 0;

      const order = await createApprovedOrder(`PO-PARTIAL-${timestamp}`, [
        { productId: prodA1Id, quantity: '50.0000', unitPrice: '10.0000' },
      ]);

      // Receive 20 units
      const recRes1 = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '20.0000' }],
          notes: 'Batch 1 of 2',
        });

      expect(recRes1.status).toBe(201);
      expect(recRes1.body.data.order.status).toBe('PARTIALLY_RECEIVED');
      expect(recRes1.body.data.order.lines[0].receivedQuantity).toBe('20.0000');
      expect(recRes1.body.data.receipt.receiptNumber).toMatch(/^GR-/);
      expect(recRes1.body.data.receipt.lines[0].quantityReceived).toBe('20.0000');

      // Verify StockBalance
      const balanceAfterPart1 = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(Number(balanceAfterPart1.quantity)).toBe(initialQty + 20);

      // Verify StockLedgerEntry
      const ledgerEntry = await prisma.stockLedgerEntry.findFirstOrThrow({
        where: {
          organizationId: orgAId,
          productId: prodA1Id,
          warehouseId: whA1Id,
          referenceType: 'PURCHASE_ORDER',
          referenceId: order.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(ledgerEntry.type).toBe('RECEIPT');
      expect(Number(ledgerEntry.quantityDelta)).toBe(20);

      // Second receipt: receive remaining 30 units
      const recRes2 = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '30.0000' }],
          notes: 'Final batch',
        });

      expect(recRes2.status).toBe(201);
      expect(recRes2.body.data.order.status).toBe('RECEIVED');
      expect(recRes2.body.data.order.lines[0].receivedQuantity).toBe('50.0000');

      // Verify updated StockBalance
      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(Number(finalBalance.quantity)).toBe(initialQty + 50);

      // Verify further receipt on RECEIVED order is rejected
      const overRec = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: order.lines[0].id, quantity: '1.0000' }],
        });
      expect(overRec.status).toBe(400);

      // Verify Receipts history endpoint
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${order.id}/receipts`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.length).toBe(2);
      expect(historyRes.body.data[0].lines.length).toBe(1);
    });

    it('rolls back completely if any line in a multi-line receipt fails validation', async () => {
      const order = await createApprovedOrder(`PO-MULTILINE-${timestamp}`, [
        { productId: prodA1Id, quantity: '10.0000', unitPrice: '5.0000' },
        { productId: prodA2Id, quantity: '10.0000', unitPrice: '8.0000' },
      ]);

      const line1Id = order.lines[0].id;
      const line2Id = order.lines[1].id;

      // Line 1 is valid (5.0000), but Line 2 is over-receiving (15.0000 > 10.0000)
      const failRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [
            { purchaseOrderLineId: line1Id, quantity: '5.0000' },
            { purchaseOrderLineId: line2Id, quantity: '15.0000' },
          ],
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.code).toBe('PURCHASE_ORDER_OVER_RECEIPT_NOT_ALLOWED');

      // Verify that Line 1 was NOT partially received
      const orderDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
      expect(orderDb.status).toBe('APPROVED');
      expect(Number(orderDb.lines[0].receivedQuantity)).toBe(0);
      expect(Number(orderDb.lines[1].receivedQuantity)).toBe(0);

      // Verify zero GoodsReceipt records were written
      const receiptsCount = await prisma.goodsReceipt.count({
        where: { purchaseOrderId: order.id },
      });
      expect(receiptsCount).toBe(0);
    });

    it('reconciles multi-line receipt across PO lines, GoodsReceipt, StockLedgerEntries, and StockBalances', async () => {
      const order = await createApprovedOrder(`PO-RECON-${timestamp}`, [
        { productId: prodA1Id, quantity: '100.0000', unitPrice: '10.0000' },
        { productId: prodA2Id, quantity: '50.0000', unitPrice: '20.0000' },
        { productId: prodA3Id, quantity: '25.0000', unitPrice: '30.0000' },
      ]);

      const lineAId = order.lines[0].id;
      const lineBId = order.lines[1].id;
      const lineCId = order.lines[2].id;

      // Capture initial balances
      const getBalance = async (productId: string) => {
        const bal = await prisma.stockBalance.findUnique({
          where: {
            organizationId_productId_warehouseId: {
              organizationId: orgAId,
              productId,
              warehouseId: whA1Id,
            },
          },
        });
        return Number(bal?.quantity ?? 0);
      };

      const initialA = await getBalance(prodA1Id);
      const initialB = await getBalance(prodA2Id);
      const initialC = await getBalance(prodA3Id);

      // Execute receipt: A = 40, B = 20, C = 25
      const recRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [
            { purchaseOrderLineId: lineAId, quantity: '40.0000' },
            { purchaseOrderLineId: lineBId, quantity: '20.0000' },
            { purchaseOrderLineId: lineCId, quantity: '25.0000' },
          ],
          notes: 'Multi-line reconciliation delivery',
        });

      expect(recRes.status).toBe(201);
      const receiptId = recRes.body.data.receipt.id;

      // 1. Purchase Order and Lines reconciliation
      const orderDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
      expect(orderDb.status).toBe('PARTIALLY_RECEIVED');

      const dbLineA = orderDb.lines.find((l) => l.id === lineAId)!;
      const dbLineB = orderDb.lines.find((l) => l.id === lineBId)!;
      const dbLineC = orderDb.lines.find((l) => l.id === lineCId)!;

      expect(Number(dbLineA.receivedQuantity)).toBe(40);
      expect(Number(dbLineB.receivedQuantity)).toBe(20);
      expect(Number(dbLineC.receivedQuantity)).toBe(25);

      // 2. Stock balances reconciliation
      expect(await getBalance(prodA1Id)).toBe(initialA + 40);
      expect(await getBalance(prodA2Id)).toBe(initialB + 20);
      expect(await getBalance(prodA3Id)).toBe(initialC + 25);

      // 3. GoodsReceipt and GoodsReceiptLines reconciliation
      const grDb = await prisma.goodsReceipt.findUniqueOrThrow({
        where: { id: receiptId },
        include: { lines: true },
      });
      expect(grDb.lines.length).toBe(3);

      const grLineA = grDb.lines.find((l) => l.purchaseOrderLineId === lineAId)!;
      const grLineB = grDb.lines.find((l) => l.purchaseOrderLineId === lineBId)!;
      const grLineC = grDb.lines.find((l) => l.purchaseOrderLineId === lineCId)!;

      expect(Number(grLineA.quantityReceived)).toBe(40);
      expect(Number(grLineB.quantityReceived)).toBe(20);
      expect(Number(grLineC.quantityReceived)).toBe(25);

      // 4. StockLedgerEntries reconciliation
      const ledgers = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          referenceType: 'PURCHASE_ORDER',
          referenceId: order.id,
        },
      });
      expect(ledgers.length).toBe(3);

      const sumGrLines = grDb.lines.reduce((sum, l) => sum + Number(l.quantityReceived), 0);
      const sumLedgerDeltas = ledgers.reduce((sum, l) => sum + Number(l.quantityDelta), 0);
      expect(sumGrLines).toBe(85);
      expect(sumLedgerDeltas).toBe(85);
      expect(sumGrLines).toBe(sumLedgerDeltas);

      // Line receivedQuantity equals sum of GoodsReceiptLine records
      expect(Number(dbLineA.receivedQuantity)).toBe(Number(grLineA.quantityReceived));
      expect(Number(dbLineB.receivedQuantity)).toBe(Number(grLineB.quantityReceived));
      expect(Number(dbLineC.receivedQuantity)).toBe(Number(grLineC.quantityReceived));

      // 5. Transactional AuditEvent reconciliation
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          organizationId: orgAId,
          entityType: 'PurchaseOrder',
          entityId: order.id,
          action: 'purchase-order.received',
        },
      });
      expect(auditEvents.length).toBe(1);
      const eventMeta = auditEvents[0].metadata as Record<string, unknown>;
      expect(eventMeta.goodsReceiptId).toBe(receiptId);
      expect(eventMeta.newStatus).toBe('PARTIALLY_RECEIVED');
      expect(eventMeta.linesReceived.length).toBe(3);
    });

    it('verifies stock ledger reference traceability to both PurchaseOrder and GoodsReceipt', async () => {
      const order = await createApprovedOrder(`PO-TRACE-${timestamp}`, [
        { productId: prodA1Id, quantity: '30.0000', unitPrice: '15.0000' },
      ]);
      const lineId = order.lines[0].id;

      const recRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ purchaseOrderLineId: lineId, quantity: '15.0000' }],
        });
      expect(recRes.status).toBe(201);
      const receipt = recRes.body.data.receipt;

      // Retrieve StockLedgerEntry
      const ledger = await prisma.stockLedgerEntry.findFirstOrThrow({
        where: {
          organizationId: orgAId,
          referenceType: 'PURCHASE_ORDER',
          referenceId: order.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Assert primary reference
      expect(ledger.referenceType).toBe('PURCHASE_ORDER');
      expect(ledger.referenceId).toBe(order.id);

      // Assert unambiguous metadata tracing to GoodsReceipt
      const meta = ledger.metadata as Record<string, unknown>;
      expect(meta.goodsReceiptId).toBe(receipt.id);
      expect(meta.goodsReceiptNumber).toBe(receipt.receiptNumber);
      expect(meta.purchaseOrderLineId).toBe(lineId);
      expect(meta.purchaseOrderNumber).toBe(order.purchaseOrderNumber);

      // Reciprocal query 1: Trace from StockLedgerEntry to GoodsReceipt
      const resolvedReceipt = await prisma.goodsReceipt.findUniqueOrThrow({
        where: { id: meta.goodsReceiptId },
        include: { lines: true },
      });
      expect(resolvedReceipt.receiptNumber).toBe(receipt.receiptNumber);
      expect(resolvedReceipt.purchaseOrderId).toBe(order.id);

      // Reciprocal query 2: Trace from GoodsReceipt to StockLedgerEntry
      const matchedLedgers = await prisma.stockLedgerEntry.findMany({
        where: {
          organizationId: orgAId,
          referenceId: order.id,
        },
      });
      const matchingLedger = matchedLedgers.find(
        (l) => (l.metadata as Record<string, unknown>)?.goodsReceiptId === receipt.id,
      );
      expect(matchingLedger).toBeDefined();
      expect(matchingLedger!.id).toBe(ledger.id);
    });

    it('PROVES full transaction rollback after stock mutation has occurred in PostgreSQL', async () => {
      const order = await createApprovedOrder(`PO-ROLLBACK-POST-${timestamp}`, [
        { productId: prodA1Id, quantity: '50.0000', unitPrice: '12.0000' },
      ]);
      const lineId = order.lines[0].id;

      // Capture baseline state before the aborted transaction
      const initialBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      const initialQty = Number(initialBalance?.quantity ?? 0);
      const initialLedgerCount = await prisma.stockLedgerEntry.count({
        where: { referenceId: order.id },
      });
      const initialReceiptCount = await prisma.goodsReceipt.count({
        where: { purchaseOrderId: order.id },
      });

      // Execute atomic interactive transaction directly against PostgreSQL
      await expect(
        prisma.$transaction(async (tx) => {
          // 1. Lock PO
          const lockedOrders = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id, status, "warehouseId", "purchaseOrderNumber"
            FROM "PurchaseOrder"
            WHERE "id" = ${order.id} AND "organizationId" = ${orgAId}
            FOR UPDATE;
          `;
          expect(lockedOrders.length).toBe(1);

          // 2. Lock PO lines
          const lockedLines = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id, "productId", quantity, "receivedQuantity"
            FROM "PurchaseOrderLine"
            WHERE "purchaseOrderId" = ${order.id} AND "organizationId" = ${orgAId}
            FOR UPDATE;
          `;
          expect(lockedLines.length).toBe(1);

          // 3. Create GoodsReceipt header
          const receipt = await tx.goodsReceipt.create({
            data: {
              organizationId: orgAId,
              purchaseOrderId: order.id,
              warehouseId: whA1Id,
              receiptNumber: `GR-${order.purchaseOrderNumber}-TEST-ROLLBACK`,
              notes: 'Testing post-stock-mutation rollback',
            },
          });

          // 4. Create GoodsReceiptLine
          await tx.goodsReceiptLine.create({
            data: {
              organizationId: orgAId,
              goodsReceiptId: receipt.id,
              purchaseOrderLineId: lineId,
              productId: prodA1Id,
              quantityReceived: '25.0000',
            },
          });

          // 5. Mutate StockBalance AND insert StockLedgerEntry through mutateStockTx
          await stockMutationService.mutateStockTx(tx, {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
            type: 'RECEIPT',
            quantityDelta: '25.0000',
            referenceType: 'PURCHASE_ORDER',
            referenceId: order.id,
            metadata: {
              goodsReceiptId: receipt.id,
              receiptNumber: receipt.receiptNumber,
            },
          });

          // 6. Update PurchaseOrderLine.receivedQuantity
          await tx.purchaseOrderLine.update({
            where: { id: lineId },
            data: { receivedQuantity: '25.0000' },
          });

          // 7. Update PurchaseOrder status
          await tx.purchaseOrder.update({
            where: { id: order.id },
            data: { status: 'PARTIALLY_RECEIVED' },
          });

          // 8. CRITICAL STEP: Deliberately throw error AFTER all mutations have occurred inside transaction
          throw new Error('FORCED_SIMULATED_POST_MUTATION_FAILURE');
        }),
      ).rejects.toThrow('FORCED_SIMULATED_POST_MUTATION_FAILURE');

      // VERIFY FINAL REAL POSTGRESQL STATE AFTER ABORTED TRANSACTION
      // GoodsReceipt: UNCHANGED (0 records)
      const postReceipts = await prisma.goodsReceipt.findMany({
        where: { purchaseOrderId: order.id },
      });
      expect(postReceipts.length).toBe(initialReceiptCount);

      // GoodsReceiptLine: UNCHANGED (0 records)
      const postReceiptLines = await prisma.goodsReceiptLine.findMany({
        where: { purchaseOrderLineId: lineId },
      });
      expect(postReceiptLines.length).toBe(0);

      // StockBalance: UNCHANGED (exact baseline)
      const postBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(Number(postBalance.quantity)).toBe(initialQty);

      // StockLedgerEntry: UNCHANGED (0 records for this PO)
      const postLedgers = await prisma.stockLedgerEntry.findMany({
        where: { referenceId: order.id },
      });
      expect(postLedgers.length).toBe(initialLedgerCount);

      // PurchaseOrderLine.receivedQuantity: UNCHANGED (0.0000)
      const postPoLine = await prisma.purchaseOrderLine.findUniqueOrThrow({
        where: { id: lineId },
      });
      expect(Number(postPoLine.receivedQuantity)).toBe(0);

      // PurchaseOrder.status: UNCHANGED ('APPROVED')
      const postOrder = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(postOrder.status).toBe('APPROVED');

      // AuditEvent: NO successful receipt audit event
      const postAudits = await prisma.auditEvent.findMany({
        where: {
          organizationId: orgAId,
          entityId: order.id,
          action: 'purchase-order.received',
        },
      });
      expect(postAudits.length).toBe(0);
    });
  });

  describe('3. Concurrency Tests (Real PostgreSQL)', () => {
    it('CONCURRENCY TEST 1: concurrent partial receipts (60 + 60 on 100 units) strictly prevents over-receiving', async () => {
      const order = await createApprovedOrder(`PO-CONC1-${timestamp}`, [
        { productId: prodA1Id, quantity: '100.0000', unitPrice: '1.0000' },
      ]);
      const lineId = order.lines[0].id;

      const initialLedgers = await prisma.stockLedgerEntry.count({
        where: { referenceId: order.id },
      });

      // Fire 2 concurrent requests for 60 units each
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '60.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '60.0000' }] }),
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly ONE request succeeds (201), the other MUST fail with 400 Bad Request
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Verify total received in DB is strictly 60, NEVER 120
      const poLineDb = await prisma.purchaseOrderLine.findUniqueOrThrow({
        where: { id: lineId },
      });
      expect(Number(poLineDb.receivedQuantity)).toBe(60);

      // Verify StockLedgerEntry count increased by exactly 1
      const finalLedgers = await prisma.stockLedgerEntry.count({
        where: { referenceId: order.id },
      });
      expect(finalLedgers - initialLedgers).toBe(1);
    });

    it('CONCURRENCY TEST 2: concurrent final receipts (50 + 50 on 50 remaining units) allows exactly one winner', async () => {
      const order = await createApprovedOrder(`PO-CONC2-${timestamp}`, [
        { productId: prodA2Id, quantity: '100.0000', unitPrice: '2.0000' },
      ]);
      const lineId = order.lines[0].id;

      // First receive 50 units sequentially
      const firstRec = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '50.0000' }] });
      expect(firstRec.status).toBe(201);

      // Remaining is 50. Fire 2 concurrent requests for 50 each.
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '50.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '50.0000' }] }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Final PO status must be RECEIVED and receivedQuantity must be exactly 100
      const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
      expect(poDb.status).toBe('RECEIVED');
      expect(Number(poDb.lines[0].receivedQuantity)).toBe(100);
    });

    it('CONCURRENCY TEST 3: 20 concurrent duplicate receipts with same Idempotency-Key results in 1 mutation and 19 replays with complete domain reconciliation', async () => {
      const order = await createApprovedOrder(`PO-IDEM-CONC-${timestamp}`, [
        { productId: prodA1Id, quantity: '25.0000', unitPrice: '10.0000' },
      ]);
      const lineId = order.lines[0].id;
      const idempotencyKey = `idem-rec-${timestamp}-${Math.random().toString(36).slice(2)}`;

      const initialBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      const initialQty = Number(initialBalance?.quantity ?? 0);
      const initialLedgers = await prisma.stockLedgerEntry.count({
        where: { referenceId: order.id },
      });

      // Fire 20 concurrent requests with the SAME idempotency key
      const requests = Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .set('idempotency-key', idempotencyKey)
          .send({
            lines: [{ purchaseOrderLineId: lineId, quantity: '25.0000' }],
            notes: 'Idempotency test receipt',
          }),
      );

      const results = await Promise.all(requests);

      // Every single request must return 200 or 201 (success / replay)
      let primaryCount = 0;
      let replayCount = 0;
      for (const res of results) {
        expect([200, 201]).toContain(res.status);
        if (res.body.data?.isIdempotentReplay) {
          replayCount++;
        } else {
          primaryCount++;
        }
      }

      // Exactly ONE primary mutation and 19 replays
      expect(primaryCount).toBe(1);
      expect(replayCount).toBe(19);

      // Verify domain reconciliation:
      // Exactly ONE GoodsReceipt record was persisted
      const receipts = await prisma.goodsReceipt.findMany({
        where: { purchaseOrderId: order.id },
      });
      expect(receipts.length).toBe(1);

      // Exactly ONE GoodsReceiptLine was persisted
      const receiptLines = await prisma.goodsReceiptLine.findMany({
        where: { goodsReceiptId: receipts[0].id },
      });
      expect(receiptLines.length).toBe(1);
      expect(Number(receiptLines[0].quantityReceived)).toBe(25);

      // Exactly ONE StockLedgerEntry was created
      const finalLedgers = await prisma.stockLedgerEntry.count({
        where: { referenceId: order.id },
      });
      expect(finalLedgers - initialLedgers).toBe(1);

      // StockBalance delta is exactly +25 once
      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(Number(finalBalance.quantity)).toBe(initialQty + 25);

      // PurchaseOrderLine receivedQuantity is exactly 25 once
      const poLineDb = await prisma.purchaseOrderLine.findUniqueOrThrow({
        where: { id: lineId },
      });
      expect(Number(poLineDb.receivedQuantity)).toBe(25);

      // Exactly ONE AuditEvent for successful receipt
      const auditCount = await prisma.auditEvent.count({
        where: {
          organizationId: orgAId,
          entityId: order.id,
          action: 'purchase-order.received',
        },
      });
      expect(auditCount).toBe(1);
    });

    it('CONCURRENCY TEST 4 (Receipt Number Concurrency): concurrent receipts against the SAME PO generate strictly unique sequential receipt numbers', async () => {
      const order = await createApprovedOrder(`PO-RECSEQ-SAME-${timestamp}`, [
        { productId: prodA1Id, quantity: '60.0000', unitPrice: '10.0000' },
      ]);
      const lineId = order.lines[0].id;

      // Fire 3 concurrent partial receipts of 10 units each against the same PO
      const [res1, res2, res3] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .set('idempotency-key', `seq-same-1-${timestamp}`)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '10.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .set('idempotency-key', `seq-same-2-${timestamp}`)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '10.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .set('idempotency-key', `seq-same-3-${timestamp}`)
          .send({ lines: [{ purchaseOrderLineId: lineId, quantity: '10.0000' }] }),
      ]);

      // All 3 succeed because 10 + 10 + 10 = 30 <= 60
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res3.status).toBe(201);

      const receiptNums = [
        res1.body.data.receipt.receiptNumber,
        res2.body.data.receipt.receiptNumber,
        res3.body.data.receipt.receiptNumber,
      ];

      // Zero duplicate receipt numbers
      const uniqueNums = new Set(receiptNums);
      expect(uniqueNums.size).toBe(3);

      // Verify receipt numbers match sequence pattern
      expect(receiptNums).toContain(`GR-${order.purchaseOrderNumber}-1`);
      expect(receiptNums).toContain(`GR-${order.purchaseOrderNumber}-2`);
      expect(receiptNums).toContain(`GR-${order.purchaseOrderNumber}-3`);

      // Exactly 3 GoodsReceipt records in database
      const dbReceipts = await prisma.goodsReceipt.findMany({
        where: { purchaseOrderId: order.id },
      });
      expect(dbReceipts.length).toBe(3);

      // Final PO receivedQuantity is 30.0000
      const poLineDb = await prisma.purchaseOrderLine.findUniqueOrThrow({
        where: { id: lineId },
      });
      expect(Number(poLineDb.receivedQuantity)).toBe(30);
    });

    it('CONCURRENCY TEST 5 (Receipt Number Concurrency): concurrent receipts across DIFFERENT POs in the same organization never collide', async () => {
      const order1 = await createApprovedOrder(`PO-DIFF1-${timestamp}`, [
        { productId: prodA1Id, quantity: '20.0000', unitPrice: '5.0000' },
      ]);
      const order2 = await createApprovedOrder(`PO-DIFF2-${timestamp}`, [
        { productId: prodA2Id, quantity: '20.0000', unitPrice: '5.0000' },
      ]);

      // Fire concurrent receipts on distinct POs
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order1.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: order1.lines[0].id, quantity: '10.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order2.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: order2.lines[0].id, quantity: '10.0000' }] }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const rNum1 = res1.body.data.receipt.receiptNumber;
      const rNum2 = res2.body.data.receipt.receiptNumber;

      expect(rNum1).toBe(`GR-${order1.purchaseOrderNumber}-1`);
      expect(rNum2).toBe(`GR-${order2.purchaseOrderNumber}-1`);
      expect(rNum1).not.toBe(rNum2);
    });

    it('CONCURRENCY TEST 6 (Different Lines Concurrency): concurrent receipts targeting different lines of the same PO execute without lost updates or double-receiving', async () => {
      const order = await createApprovedOrder(`PO-DIFFLINES-${timestamp}`, [
        { productId: prodA1Id, quantity: '100.0000', unitPrice: '10.0000' },
        { productId: prodA2Id, quantity: '100.0000', unitPrice: '15.0000' },
      ]);

      const lineAId = order.lines[0].id;
      const lineBId = order.lines[1].id;

      const initialA = Number(
        (
          await prisma.stockBalance.findUnique({
            where: {
              organizationId_productId_warehouseId: {
                organizationId: orgAId,
                productId: prodA1Id,
                warehouseId: whA1Id,
              },
            },
          })
        )?.quantity ?? 0,
      );
      const initialB = Number(
        (
          await prisma.stockBalance.findUnique({
            where: {
              organizationId_productId_warehouseId: {
                organizationId: orgAId,
                productId: prodA2Id,
                warehouseId: whA1Id,
              },
            },
          })
        )?.quantity ?? 0,
      );

      // Fire Request 1 (receiving 60 of Line A) and Request 2 (receiving 40 of Line B) concurrently
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineAId, quantity: '60.0000' }] }),
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${order.id}/receive`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ lines: [{ purchaseOrderLineId: lineBId, quantity: '40.0000' }] }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Verify DB PurchaseOrder and lines
      const orderDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
      expect(orderDb.status).toBe('PARTIALLY_RECEIVED');

      const dbLineA = orderDb.lines.find((l) => l.id === lineAId)!;
      const dbLineB = orderDb.lines.find((l) => l.id === lineBId)!;

      // Strict assertions: No lost updates!
      expect(Number(dbLineA.receivedQuantity)).toBe(60);
      expect(Number(dbLineB.receivedQuantity)).toBe(40);

      // Stock balances updated correctly
      const finalA = Number(
        (
          await prisma.stockBalance.findUniqueOrThrow({
            where: {
              organizationId_productId_warehouseId: {
                organizationId: orgAId,
                productId: prodA1Id,
                warehouseId: whA1Id,
              },
            },
          })
        ).quantity,
      );
      const finalB = Number(
        (
          await prisma.stockBalance.findUniqueOrThrow({
            where: {
              organizationId_productId_warehouseId: {
                organizationId: orgAId,
                productId: prodA2Id,
                warehouseId: whA1Id,
              },
            },
          })
        ).quantity,
      );

      expect(finalA).toBe(initialA + 60);
      expect(finalB).toBe(initialB + 40);

      // Exactly 2 GoodsReceipt records created
      const receipts = await prisma.goodsReceipt.findMany({
        where: { purchaseOrderId: order.id },
        orderBy: { receivedAt: 'asc' },
      });
      expect(receipts.length).toBe(2);
      expect(receipts[0].receiptNumber).not.toBe(receipts[1].receiptNumber);
    });

    it('IDEMPOTENCY TEST 4: payload mismatch with same idempotency key returns 409 Conflict', async () => {
      const order = await createApprovedOrder(`PO-IDEM-MISMATCH-${timestamp}`, [
        { productId: prodA1Id, quantity: '50.0000', unitPrice: '10.0000' },
      ]);
      const lineId = order.lines[0].id;
      const idempotencyKey = `idem-mismatch-${timestamp}`;

      // First receipt
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('idempotency-key', idempotencyKey)
        .send({
          lines: [{ purchaseOrderLineId: lineId, quantity: '10.0000' }],
        });
      expect(res1.status).toBe(201);

      // Second request with SAME key but DIFFERENT quantity (20.0000 instead of 10.0000)
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${order.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('idempotency-key', idempotencyKey)
        .send({
          lines: [{ purchaseOrderLineId: lineId, quantity: '20.0000' }],
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('PURCHASE_ORDER_RECEIPT_IDEMPOTENCY_MISMATCH');
    });

    it('TENANT ISOLATION: same idempotency key in distinct tenants operates independently without collision', async () => {
      // Create PO in Org B
      const createResB = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .send({
          purchaseOrderNumber: `PO-ORGB-${timestamp}`,
          supplierName: 'Vendor B',
          warehouseId: whBId,
          lines: [{ productId: prodBId, quantity: '20.0000', unitPrice: '15.0000' }],
        });
      const orderB = createResB.body.data;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderB.id}/submit`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId);
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderB.id}/approve`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId);

      // Create PO in Org A
      const orderA = await createApprovedOrder(`PO-ORGA-${timestamp}`, [
        { productId: prodA1Id, quantity: '20.0000', unitPrice: '15.0000' },
      ]);

      const sharedKey = `shared-cross-tenant-key-${timestamp}`;

      // Receive in Org A
      const recA = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderA.id}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('idempotency-key', sharedKey)
        .send({
          lines: [{ purchaseOrderLineId: orderA.lines[0].id, quantity: '10.0000' }],
        });
      expect(recA.status).toBe(201);

      // Receive in Org B with same key
      const recB = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderB.id}/receive`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .set('idempotency-key', sharedKey)
        .send({
          lines: [{ purchaseOrderLineId: orderB.lines[0].id, quantity: '10.0000' }],
        });
      expect(recB.status).toBe(201);
      expect(recB.body.data.receipt.organizationId).toBe(orgBId);
    });
  });
});
