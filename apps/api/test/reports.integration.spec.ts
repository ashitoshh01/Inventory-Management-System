import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService, Prisma } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Reports & Dashboard Integration Tests (PostgreSQL)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const userA = {
    email: `reports-a-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Reports Org A ${timestamp}`,
  };

  const userB = {
    email: `reports-b-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Reports Org B ${timestamp}`,
  };

  let tokenA: string;
  let orgAId: string;
  let whA1Id: string;
  let whA2Id: string;
  let prodA1Id: string;

  let tokenB: string;
  let orgBId: string;
  let whB1Id: string;
  let prodB1Id: string;

  beforeAll(async () => {
    process.env.COOKIE_SECURE = 'true';
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

    // 1. Setup User & Org A
    const regResA = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userA);
    orgAId = regResA.body.data.organization.id;

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password });
    const cookiesA: string[] = loginResA.headers['set-cookie'];
    tokenA = cookiesA.find((c) => c.startsWith('accessToken='))!.split(';')[0]!.split('=')[1]!;

    // 2. Setup User & Org B
    const regResB = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userB);
    orgBId = regResB.body.data.organization.id;

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userB.email, password: userB.password });
    const cookiesB: string[] = loginResB.headers['set-cookie'];
    tokenB = cookiesB.find((c) => c.startsWith('accessToken='))!.split(';')[0]!.split('=')[1]!;

    // 3. Seed Org A fixtures: Category, 2 Warehouses, 2 Products, Balances, Ledger, SalesOrder
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Electronics A ${timestamp}` },
    });

    const whA1 = await prisma.warehouse.create({
      data: { organizationId: orgAId, name: `Main WH A1 ${timestamp}`, code: `WHA1-${timestamp}` },
    });
    whA1Id = whA1.id;

    const whA2 = await prisma.warehouse.create({
      data: { organizationId: orgAId, name: `Secondary WH A2 ${timestamp}`, code: `WHA2-${timestamp}` },
    });
    whA2Id = whA2.id;

    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Keyboard A1 ${timestamp}`,
        sku: `KEY-A1-${timestamp}`,
        unitCost: new Prisma.Decimal('50.0000'),
        unitPrice: new Prisma.Decimal('100.0000'),
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Mouse A2 ${timestamp}`,
        sku: `MOU-A2-${timestamp}`,
        unitCost: new Prisma.Decimal('20.0000'),
        unitPrice: new Prisma.Decimal('40.0000'),
      },
    });

    // Balances and Ledgers for Org A
    await prisma.stockBalance.create({
      data: {
        organizationId: orgAId,
        productId: prodA1.id,
        warehouseId: whA1.id,
        quantity: new Prisma.Decimal('10.0000'),
      },
    });

    await prisma.stockLedgerEntry.create({
      data: {
        organizationId: orgAId,
        productId: prodA1.id,
        warehouseId: whA1.id,
        type: 'OPENING',
        quantityDelta: new Prisma.Decimal('10.0000'),
        quantityBefore: new Prisma.Decimal('0.0000'),
        quantityAfter: new Prisma.Decimal('10.0000'),
      },
    });

    await prisma.stockBalance.create({
      data: {
        organizationId: orgAId,
        productId: prodA2.id,
        warehouseId: whA2.id,
        quantity: new Prisma.Decimal('5.0000'),
      },
    });

    await prisma.stockLedgerEntry.create({
      data: {
        organizationId: orgAId,
        productId: prodA2.id,
        warehouseId: whA2.id,
        type: 'RECEIPT',
        quantityDelta: new Prisma.Decimal('5.0000'),
        quantityBefore: new Prisma.Decimal('0.0000'),
        quantityAfter: new Prisma.Decimal('5.0000'),
      },
    });

    // Sales Order for Org A
    const soA = await prisma.salesOrder.create({
      data: {
        organizationId: orgAId,
        salesOrderNumber: `SO-A-${timestamp}`,
        customerName: 'Customer Alpha',
        warehouseId: whA1.id,
        status: 'FULFILLED',
        subtotal: new Prisma.Decimal('200.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('200.0000'),
      },
    });

    await prisma.salesOrderLine.create({
      data: {
        organizationId: orgAId,
        salesOrderId: soA.id,
        productId: prodA1.id,
        quantity: new Prisma.Decimal('2.0000'),
        unitPrice: new Prisma.Decimal('100.0000'),
        lineTotal: new Prisma.Decimal('200.0000'),
      },
    });

    // 4. Seed Org B fixtures: Category, Warehouse, Product, Balance, SalesOrder
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `Hardware B ${timestamp}` },
    });

    const whB1 = await prisma.warehouse.create({
      data: { organizationId: orgBId, name: `Mega Facility B ${timestamp}`, code: `WHB1-${timestamp}` },
    });
    whB1Id = whB1.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        name: `Industrial Drill B1 ${timestamp}`,
        sku: `DRL-B1-${timestamp}`,
        unitCost: new Prisma.Decimal('500.0000'),
        unitPrice: new Prisma.Decimal('1000.0000'),
      },
    });
    prodB1Id = prodB1.id;

    await prisma.stockBalance.create({
      data: {
        organizationId: orgBId,
        productId: prodB1.id,
        warehouseId: whB1.id,
        quantity: new Prisma.Decimal('50.0000'),
      },
    });

    await prisma.stockLedgerEntry.create({
      data: {
        organizationId: orgBId,
        productId: prodB1.id,
        warehouseId: whB1.id,
        type: 'OPENING',
        quantityDelta: new Prisma.Decimal('50.0000'),
        quantityBefore: new Prisma.Decimal('0.0000'),
        quantityAfter: new Prisma.Decimal('50.0000'),
      },
    });

    const soB = await prisma.salesOrder.create({
      data: {
        organizationId: orgBId,
        salesOrderNumber: `SO-B-${timestamp}`,
        customerName: 'Mega Client Beta',
        warehouseId: whB1.id,
        status: 'FULFILLED',
        subtotal: new Prisma.Decimal('5000.0000'),
        taxTotal: new Prisma.Decimal('0.0000'),
        grandTotal: new Prisma.Decimal('5000.0000'),
      },
    });

    await prisma.salesOrderLine.create({
      data: {
        organizationId: orgBId,
        salesOrderId: soB.id,
        productId: prodB1.id,
        quantity: new Prisma.Decimal('5.0000'),
        unitPrice: new Prisma.Decimal('1000.0000'),
        lineTotal: new Prisma.Decimal('5000.0000'),
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data
      await prisma.salesOrderLine.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.salesOrder.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.stockLedgerEntry.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.stockBalance.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.product.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.category.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.warehouse.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Tenant Isolation in Dashboard & Reporting', () => {
    it('Org A dashboard stats reflect ONLY Org A data and never Org B data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/stats')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      // Org A has total stock = 10 + 5 = 15, valuation = 10*100 + 5*40 = 1200
      // Org B has stock = 50, valuation = 50000. Org A must NEVER see 65 or 51200!
      expect(parseFloat(res.body.data.totalStock)).toBe(15);
      expect(parseFloat(res.body.data.totalInventoryValue)).toBe(1200);
      expect(res.body.data.totalProducts).toBe(2);
      expect(parseFloat(res.body.data.todaysSales)).toBe(200);
    });

    it('Org A sales overview reflects ONLY Org A sales and excludes Org B ($5000)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/sales-overview')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const totalThisPeriod = res.body.data.reduce((sum: number, p: any) => sum + p.thisPeriod, 0);
      expect(totalThisPeriod).toBe(200);
    });

    it('Org A top selling products excludes Org B drill product', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/top-selling-products')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const skus = res.body.data.map((p: any) => p.sku);
      expect(skus).toContain(`KEY-A1-${timestamp}`);
      expect(skus).not.toContain(`DRL-B1-${timestamp}`);
    });

    it('Org A stock movement report never leaks Org B ledger records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/stock-movement')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.total).toBe(2);
      const productSkus = res.body.data.items.map((i: any) => i.productSku);
      expect(productSkus).not.toContain(`DRL-B1-${timestamp}`);
    });

    it('Org A reconciliation report never leaks Org B buckets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/reconciliation')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.total).toBe(2);
      const skus = res.body.data.items.map((i: any) => i.productSku);
      expect(skus).not.toContain(`DRL-B1-${timestamp}`);
    });
  });

  describe('2. Warehouse Filtering', () => {
    it('filters inventory valuation report strictly by selected warehouse', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reports/inventory-valuation?warehouseId=${whA1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].warehouseId).toBe(whA1Id);
      expect(res.body.data.items[0].productSku).toBe(`KEY-A1-${timestamp}`);
      expect(parseFloat(res.body.data.summary.totalCostValue)).toBe(500); // 10 * 50
      expect(parseFloat(res.body.data.summary.totalRetailValue)).toBe(1000); // 10 * 100
    });
  });

  describe('3. Inventory Reconciliation Accuracy', () => {
    it('verifies that balanced products show MATCH with zero discrepancy', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reports/reconciliation?productId=${prodA1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.currentBalance).toBe('10.0000');
      expect(item.ledgerDeltaSum).toBe('10.0000');
      expect(parseFloat(item.discrepancy)).toBe(0);
      expect(item.status).toBe('MATCH');
    });
  });

  describe('4. CSV Export', () => {
    it('exports RFC 4180 CSV attachment scoped to tenant with accurate data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/export?reportType=stock-movement')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="stock-movement-');
      expect(res.text).toContain('# Report: STOCK-MOVEMENT');
      expect(res.text).toContain(`KEY-A1-${timestamp}`);
      expect(res.text).not.toContain(`DRL-B1-${timestamp}`);
    });
  });

  describe('5. Read-Only Guarantee', () => {
    it('proves zero mutations on StockBalance, StockLedgerEntry, and SalesOrder after multiple reads', async () => {
      // 1. Snapshot initial state
      const initialBalances = await prisma.stockBalance.findMany({ where: { organizationId: orgAId } });
      const initialLedger = await prisma.stockLedgerEntry.findMany({ where: { organizationId: orgAId } });
      const initialSales = await prisma.salesOrder.findMany({ where: { organizationId: orgAId } });

      // 2. Call all dashboard and reporting endpoints 5 times
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get('/api/v1/dashboard/stats')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/dashboard/sales-overview')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/reports/reconciliation')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/reports/inventory-valuation')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/reports/export?reportType=reconciliation')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .expect(200);
      }

      // 3. Re-query state
      const finalBalances = await prisma.stockBalance.findMany({ where: { organizationId: orgAId } });
      const finalLedger = await prisma.stockLedgerEntry.findMany({ where: { organizationId: orgAId } });
      const finalSales = await prisma.salesOrder.findMany({ where: { organizationId: orgAId } });

      // 4. Assert absolute invariance (zero additions, deletions, or quantity changes)
      expect(finalBalances).toHaveLength(initialBalances.length);
      expect(finalLedger).toHaveLength(initialLedger.length);
      expect(finalSales).toHaveLength(initialSales.length);

      for (let i = 0; i < initialBalances.length; i++) {
        expect(finalBalances[i]!.quantity.toString()).toBe(initialBalances[i]!.quantity.toString());
        expect(finalBalances[i]!.updatedAt.toISOString()).toBe(initialBalances[i]!.updatedAt.toISOString());
      }
    });
  });
});
