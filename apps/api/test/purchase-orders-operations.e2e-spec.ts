import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Purchase Order Operations, Reconciliation & Production QA (e2e)', () => {
  jest.setTimeout(90000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `ops-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `ops-owner-b-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;

  let tokenB: string;
  let orgBId: string;

  let prodA1Id: string;
  let prodA2Id: string;
  let prodA3Id: string;
  let whA1Id: string;

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

    // 1. Setup Org A and Owner A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserA, organizationName: `Ops Org A ${timestamp}` });
    orgAId = resA.body.data.organization.id;
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserA);
    tokenA = loginA.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 2. Setup Org B and Owner B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserB, organizationName: `Ops Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Assign permissions to Owner role
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

    // 4. Setup Org A Catalog & Warehouse
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Ops Cat A ${timestamp}` },
    });
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Ops Product A1',
        sku: `OPS-SKU-A1-${timestamp}`,
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Ops Product A2',
        sku: `OPS-SKU-A2-${timestamp}`,
      },
    });
    prodA2Id = prodA2.id;

    const prodA3 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: 'Ops Product A3',
        sku: `OPS-SKU-A3-${timestamp}`,
      },
    });
    prodA3Id = prodA3.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Ops WH A1 ${timestamp}`,
        code: `OWHA1-${timestamp.toString().slice(-4)}`,
      },
    });
    whA1Id = whA1.id;

    // 5. Setup Org B Catalog & Warehouse
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `Ops Cat B ${timestamp}` },
    });
    await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        name: 'Ops Product B1',
        sku: `OPS-SKU-B1-${timestamp}`,
      },
    });

    await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `Ops WH B1 ${timestamp}`,
        code: `OWHB1-${timestamp.toString().slice(-4)}`,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Procurement Operational Workflow & Metrics', () => {
    let orderId: string;
    let overdueOrderId: string;

    it('should create an approved 3-line purchase order', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-OPS-${timestamp}`,
          warehouseId: whA1Id,
          supplierName: 'Acme Heavy Industries',
          orderDate: new Date().toISOString(),
          expectedDate: tomorrow,
          currency: 'USD',
          lines: [
            { productId: prodA1Id, quantity: '100', unitPrice: '10.00' },
            { productId: prodA2Id, quantity: '50', unitPrice: '20.00' },
            { productId: prodA3Id, quantity: '25', unitPrice: '40.00' },
          ],
        });

      expect(res.status).toBe(201);
      orderId = res.body.data.id;
      expect(orderId).toBeDefined();
      expect(res.body.data.status).toBe('DRAFT');

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
      expect(approveRes.body.data.status).toBe('APPROVED');
    });

    it('should create an overdue purchase order for filtering verification', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-OVERDUE-${timestamp}`,
          warehouseId: whA1Id,
          supplierName: 'Overdue Supplier Co',
          orderDate: new Date(Date.now() - 172800000).toISOString(),
          expectedDate: yesterday,
          currency: 'USD',
          lines: [{ productId: prodA1Id, quantity: '10', unitPrice: '5.00' }],
        });

      expect(res.status).toBe(201);
      overdueOrderId = res.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${overdueOrderId}/submit`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${overdueOrderId}/approve`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(201);
    });

    it('should return aggregate procurement metrics on GET /api/v1/purchase-orders/metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders/metrics')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const metrics = res.body.data;
      expect(metrics).toBeDefined();
      expect(metrics.totalOrders).toBeGreaterThanOrEqual(2);
      expect(metrics.statusCounts.APPROVED).toBeGreaterThanOrEqual(2);
      expect(metrics.pendingReceivingCount).toBeGreaterThanOrEqual(2);
      expect(metrics.overdueCount).toBeGreaterThanOrEqual(1);
    });

    it('should support operational query filtering (isOverdue, receivingState, supplierName)', async () => {
      // 1. isOverdue=true
      const overdueRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?isOverdue=true')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const overdueIds = overdueRes.body.data.map((p: { id: string }) => p.id);
      expect(overdueIds).toContain(overdueOrderId);
      expect(overdueIds).not.toContain(orderId);

      // 2. isOverdue=false
      const notOverdueRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?isOverdue=false')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const notOverdueIds = notOverdueRes.body.data.map((p: { id: string }) => p.id);
      expect(notOverdueIds).toContain(orderId);
      expect(notOverdueIds).not.toContain(overdueOrderId);

      // 3. receivingState=OUTSTANDING (should include both APPROVED orders)
      const outstandingRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?receivingState=OUTSTANDING')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const outstandingIds = outstandingRes.body.data.map((p: { id: string }) => p.id);
      expect(outstandingIds).toContain(orderId);
      expect(outstandingIds).toContain(overdueOrderId);

      // 4. receivingState=RECEIVED (should be empty before receiving)
      const receivedRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?receivingState=RECEIVED')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const receivedIds = receivedRes.body.data.map((p: { id: string }) => p.id);
      expect(receivedIds).not.toContain(orderId);
      expect(receivedIds).not.toContain(overdueOrderId);

      // 5. supplierName partial search
      const supplierRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?supplierName=Heavy%20Industries')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(supplierRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(supplierRes.body.data[0].id).toBe(orderId);
    });

    it('should reconcile cleanly with 0 received before receiving', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const rec = res.body.data;
      expect(rec.purchaseOrderId).toBe(orderId);
      expect(rec.isReconciled).toBe(true);
      expect(rec.discrepancies).toEqual([]);
      expect(rec.totalOrderedQuantity).toBe('175.0000');
      expect(rec.totalReceivedQuantity).toBe('0.0000');
      expect(rec.totalRemainingQuantity).toBe('175.0000');
      expect(rec.totalGoodsReceiptQuantity).toBe('0.0000');
      expect(rec.totalReceiptLedgerDelta).toBe('0.0000');
      expect(rec.lines).toHaveLength(3);
    });

    it('should perform partial receipt and verify live reconciliation math', async () => {
      const poLinesRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const lines: Array<{ id: string; productId: string }> = poLinesRes.body.data.lines;
      const line1 = lines.find((l) => l.productId === prodA1Id)!;
      const line2 = lines.find((l) => l.productId === prodA2Id)!;

      // Receive: Line 1 = 40, Line 2 = 20, Line 3 = 0 (omitted)
      const receiveRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderId}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [
            { purchaseOrderLineId: line1.id, quantity: '40' },
            { purchaseOrderLineId: line2.id, quantity: '20' },
          ],
        });

      expect(receiveRes.status).toBe(201);
      expect(receiveRes.body.data.order.status).toBe('PARTIALLY_RECEIVED');

      // Now query live reconciliation
      const recRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const rec = recRes.body.data;
      expect(rec.isReconciled).toBe(true);
      expect(rec.discrepancies).toEqual([]);
      expect(rec.totalOrderedQuantity).toBe('175.0000');
      expect(rec.totalReceivedQuantity).toBe('60.0000');
      expect(rec.totalRemainingQuantity).toBe('115.0000');
      expect(rec.totalGoodsReceiptQuantity).toBe('60.0000');
      expect(rec.totalReceiptLedgerDelta).toBe('60.0000');

      interface RecLine {
        productId: string;
        orderedQuantity: string;
        receivedQuantity: string;
        remainingQuantity: string;
        goodsReceiptQuantity: string;
        ledgerDeltaQuantity: string;
        isLineReconciled: boolean;
      }
      const recLines: RecLine[] = rec.lines;

      const recLine1 = recLines.find((l) => l.productId === prodA1Id)!;
      expect(recLine1.orderedQuantity).toBe('100.0000');
      expect(recLine1.receivedQuantity).toBe('40.0000');
      expect(recLine1.remainingQuantity).toBe('60.0000');
      expect(recLine1.goodsReceiptQuantity).toBe('40.0000');
      expect(recLine1.ledgerDeltaQuantity).toBe('40.0000');
      expect(recLine1.isLineReconciled).toBe(true);

      const recLine2 = recLines.find((l) => l.productId === prodA2Id)!;
      expect(recLine2.orderedQuantity).toBe('50.0000');
      expect(recLine2.receivedQuantity).toBe('20.0000');
      expect(recLine2.remainingQuantity).toBe('30.0000');
      expect(recLine2.goodsReceiptQuantity).toBe('20.0000');
      expect(recLine2.ledgerDeltaQuantity).toBe('20.0000');
      expect(recLine2.isLineReconciled).toBe(true);

      const recLine3 = recLines.find((l) => l.productId === prodA3Id)!;
      expect(recLine3.orderedQuantity).toBe('25.0000');
      expect(recLine3.receivedQuantity).toBe('0.0000');
      expect(recLine3.remainingQuantity).toBe('25.0000');
      expect(recLine3.goodsReceiptQuantity).toBe('0.0000');
      expect(recLine3.ledgerDeltaQuantity).toBe('0.0000');
      expect(recLine3.isLineReconciled).toBe(true);
    });

    it('should complete final receipt and verify full reconciliation with physical stock', async () => {
      const poLinesRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const lines: Array<{ id: string; productId: string }> = poLinesRes.body.data.lines;
      const line1 = lines.find((l) => l.productId === prodA1Id)!;
      const line2 = lines.find((l) => l.productId === prodA2Id)!;
      const line3 = lines.find((l) => l.productId === prodA3Id)!;

      // Final receive remainder: Line 1 = 60, Line 2 = 30, Line 3 = 25
      const finalRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${orderId}/receive`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          lines: [
            { purchaseOrderLineId: line1.id, quantity: '60' },
            { purchaseOrderLineId: line2.id, quantity: '30' },
            { purchaseOrderLineId: line3.id, quantity: '25' },
          ],
        });

      expect(finalRes.status).toBe(201);
      expect(finalRes.body.data.order.status).toBe('RECEIVED');

      // Live reconciliation check
      const recRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const rec = recRes.body.data;
      expect(rec.isReconciled).toBe(true);
      expect(rec.discrepancies).toEqual([]);
      expect(rec.totalOrderedQuantity).toBe('175.0000');
      expect(rec.totalReceivedQuantity).toBe('175.0000');
      expect(rec.totalRemainingQuantity).toBe('0.0000');
      expect(rec.totalGoodsReceiptQuantity).toBe('175.0000');
      expect(rec.totalReceiptLedgerDelta).toBe('175.0000');

      // Verify physical stock balances in database
      const stock1 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            warehouseId: whA1Id,
            productId: prodA1Id,
          },
        },
      });
      const stock2 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            warehouseId: whA1Id,
            productId: prodA2Id,
          },
        },
      });
      const stock3 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            warehouseId: whA1Id,
            productId: prodA3Id,
          },
        },
      });

      expect(stock1?.quantity.toString()).toBe('100');
      expect(stock2?.quantity.toString()).toBe('50');
      expect(stock3?.quantity.toString()).toBe('25');

      // Verify receivingState filter now returns this PO under RECEIVED
      const receivedFilterRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders?receivingState=RECEIVED')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const receivedIds = receivedFilterRes.body.data.map((p: { id: string }) => p.id);
      expect(receivedIds).toContain(orderId);
    });

    it('should prove strict read-only guarantee of reconciliation and metrics endpoints', async () => {
      // Capture baseline counts and state
      const initialBalances = await prisma.stockBalance.findMany({
        where: { organizationId: orgAId },
      });
      const initialLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });
      const initialReceiptsCount = await prisma.goodsReceipt.count({
        where: { organizationId: orgAId },
      });
      const initialPoLines = await prisma.purchaseOrderLine.findMany({
        where: { purchaseOrderId: orderId },
      });

      // Call reconciliation endpoint multiple times
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/purchase-orders/metrics')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .expect(200);
      }

      // Assert identical post-read state
      const postBalances = await prisma.stockBalance.findMany({
        where: { organizationId: orgAId },
      });
      const postLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });
      const postReceiptsCount = await prisma.goodsReceipt.count({
        where: { organizationId: orgAId },
      });
      const postPoLines = await prisma.purchaseOrderLine.findMany({
        where: { purchaseOrderId: orderId },
      });

      expect(postBalances).toEqual(initialBalances);
      expect(postLedgerCount).toBe(initialLedgerCount);
      expect(postReceiptsCount).toBe(initialReceiptsCount);
      expect(postPoLines).toEqual(initialPoLines);
    });

    it('should return chronological audit history timeline on GET /:id/audit-trail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/audit-trail`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      interface AuditEventItem {
        id: string;
        action: string;
        entityId?: string | null;
      }
      const events: AuditEventItem[] = res.body.data;
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(5);

      const actions = events.map((e) => e.action);
      // Descending order verification: recent actions first
      expect(actions[0]).toBe('purchase-order.received');
      expect(actions).toContain('purchase-order.received');
      expect(actions).toContain('PURCHASE_ORDER_STATUS_CHANGED');
      expect(actions).toContain('PURCHASE_ORDER_CREATED');

      // Verify all events belong strictly to Org A
      events.forEach((e) => {
        expect(e.entityId).toBe(orderId);
      });
    });

    it('should enforce strict tenant isolation on operational endpoints', async () => {
      // Org B user attempts to access Org A's reconciliation -> 404
      await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(404);

      // Org B user attempts to access Org A's audit-trail -> 404
      await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/audit-trail`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(404);

      // Org B user querying metrics sees only Org B's metrics
      const orgBMetricsRes = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders/metrics')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(200);

      expect(orgBMetricsRes.body.data.totalOrders).toBe(0);
      expect(orgBMetricsRes.body.data.pendingReceivingCount).toBe(0);

      // Unauthenticated requests should be rejected with 401
      await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/reconciliation`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${orderId}/audit-trail`)
        .expect(401);

      await request(app.getHttpServer()).get('/api/v1/purchase-orders/metrics').expect(401);
    });
  });
});
