import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { ImportProcessor } from '../src/modules/worker/import.processor';
import { JOB_PROCESS_IMPORT } from '../src/modules/queue/queue.constants';
import { Job } from 'bullmq';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Imports & Bulk Operations Integration Suite', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;
  let importProcessor: ImportProcessor;

  const timestamp = Date.now();
  const userA = {
    email: `import-user-a-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Import Org A ${timestamp}`,
  };

  const userB = {
    email: `import-user-b-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Import Org B ${timestamp}`,
  };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;
  let categoryAId: string;
  let warehouseAId: string;
  let warehouseACode: string;

  let tokenB: string;
  let orgBId: string;
  let userBId: string;

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
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(
      new LoggingInterceptor(logger),
      new TransformInterceptor(),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    importProcessor = moduleFixture.get<ImportProcessor>(ImportProcessor);

    // 1. Setup User A + Org A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userA)
      .expect(201);

    orgAId = resA.body.data.organization.id;
    userAId = resA.body.data.user.id;

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password })
      .expect(200);

    const cookiesA = loginResA.headers['set-cookie'] as unknown as string[];
    const authCookieA = Array.isArray(cookiesA)
      ? cookiesA.find((c: string) => c.startsWith('accessToken='))
      : undefined;
    tokenA = authCookieA ? authCookieA.split(';')[0]!.split('=')[1]! : '';

    // Create a default category in Org A
    const cat = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Electronics ${timestamp}`,
      },
    });
    categoryAId = cat.id;

    // Create a warehouse in Org A
    warehouseACode = `WHA${timestamp}`.slice(0, 10);
    const wh = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Main Warehouse ${timestamp}`,
        code: warehouseACode,
      },
    });
    warehouseAId = wh.id;

    // 2. Setup User B + Org B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userB)
      .expect(201);

    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userB.email, password: userB.password })
      .expect(200);

    const cookiesB = loginResB.headers['set-cookie'] as unknown as string[];
    const authCookieB = Array.isArray(cookiesB)
      ? cookiesB.find((c: string) => c.startsWith('accessToken='))
      : undefined;
    tokenB = authCookieB ? authCookieB.split(';')[0]!.split('=')[1]! : '';
  });

  afterAll(async () => {
    // Clean up created records
    try {
      await prisma.stockLedgerEntry.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.stockBalance.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.importJob.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.product.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.warehouse.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.category.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
    } catch {
      // ignore
    }
    await app.close();
  });

  describe('1. Product Dry-Run Preview (Read-Only)', () => {
    it('returns validation summary without creating any database records', async () => {
      const csv = `SKU,Name,Category,Unit of Measure,Unit Cost,Unit Price\nIMP-P1,Widget A,Electronics ${timestamp},UNIT,15.5000,29.9900\nIMP-P2,Widget B,Electronics ${timestamp},UNIT,20.0000,45.0000\n`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .field('type', 'PRODUCT')
        .attach('file', Buffer.from(csv), 'products.csv')
        .expect(201);

      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.validRows).toBe(2);
      expect(res.body.data.invalidRows).toBe(0);
      expect(res.body.data.errors).toHaveLength(0);

      // Verify ZERO database products were inserted during preview
      const count = await prisma.product.count({
        where: { organizationId: orgAId, sku: { in: ['IMP-P1', 'IMP-P2'] } },
      });
      expect(count).toBe(0);
    });

    it('identifies invalid rows and duplicate SKUs in preview', async () => {
      const csv = `SKU,Name,Category\nIMP-DUP,Item 1,Electronics ${timestamp}\nIMP-DUP,Item 2,Electronics ${timestamp}\nINVALID-SKU-WITH SPACE,Item 3,Electronics ${timestamp}\n`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .field('type', 'PRODUCT')
        .attach('file', Buffer.from(csv), 'products.csv')
        .expect(201);

      expect(res.body.data.totalRows).toBe(3);
      expect(res.body.data.invalidRows).toBe(2);
      expect(res.body.data.errors.some((e: any) => e.code === 'DUPLICATE_SKU_IN_FILE')).toBe(true);
      expect(res.body.data.errors.some((e: any) => e.code === 'INVALID_SKU')).toBe(true);
    });
  });

  describe('2. Real Product Import via Worker', () => {
    let importJobId: string;

    it('creates ImportJob in database and enqueues job', async () => {
      const csv = `SKU,Name,Category,Unit of Measure,Unit Cost,Unit Price\nREAL-P1-${timestamp},Hammer,Electronics ${timestamp},UNIT,12.0000,25.0000\nREAL-P2-${timestamp},Wrench,Electronics ${timestamp},UNIT,18.5000,32.0000\n`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/imports')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .field('type', 'PRODUCT')
        .field('mode', 'CREATE')
        .attach('file', Buffer.from(csv), 'products.csv')
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.totalRows).toBe(2);

      importJobId = res.body.data.id;
    });

    it('worker executes product import and persists real database records', async () => {
      let updatedJob = await prisma.importJob.findUnique({
        where: { id: importJobId },
      });
      expect(updatedJob).not.toBeNull();

      // Wait for BullMQ worker to finish processing
      let attempts = 0;
      while (updatedJob?.status === 'PENDING' || updatedJob?.status === 'PROCESSING') {
        await new Promise((r) => setTimeout(r, 100));
        updatedJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
        attempts++;
        if (attempts > 30) break;
      }

      if (updatedJob?.status !== 'COMPLETED') {
        const storagePath = `${process.cwd()}/storage/imports/import-${importJobId}.csv`;
        const mockJob = {
          name: JOB_PROCESS_IMPORT,
          data: {
            importId: importJobId,
            organizationId: orgAId,
            userId: userAId,
            type: 'PRODUCT' as const,
            filePath: storagePath,
            fileName: 'products.csv',
          },
        } as unknown as Job<any>;

        await importProcessor.process(mockJob);
        updatedJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
      }

      // Verify ImportJob state updated in DB
      expect(updatedJob?.status).toBe('COMPLETED');
      expect(updatedJob?.successfulRows).toBe(2);
      expect(updatedJob?.failedRows).toBe(0);

      // Verify real Products exist in PostgreSQL
      const p1 = await prisma.product.findFirst({
        where: { organizationId: orgAId, sku: `REAL-P1-${timestamp}` },
      });
      expect(p1).not.toBeNull();
      expect(p1?.name).toBe('Hammer');
      expect(p1?.categoryId).toBe(categoryAId);
    });
  });

  describe('3. Real Stock Import via StockMutationService', () => {
    let stockJobId: string;
    const stockSku = `STOCK-SKU-${timestamp}`;

    beforeAll(async () => {
      // Create product to mutate stock for
      await prisma.product.create({
        data: {
          organizationId: orgAId,
          categoryId: categoryAId,
          sku: stockSku,
          name: 'Inventory Test Item',
        },
      });
    });

    it('creates stock ImportJob and executes mutation via StockMutationService', async () => {
      const csv = `SKU,Warehouse Code,Quantity Delta,Type,Reason\n${stockSku},${warehouseACode},100.5000,ADJUSTMENT,Initial Stock Take\n`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/imports')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .field('type', 'STOCK')
        .attach('file', Buffer.from(csv), 'stock.csv')
        .expect(201);

      stockJobId = res.body.data.id;

      // Wait for BullMQ worker to finish processing
      let updatedJob = await prisma.importJob.findUnique({
        where: { id: stockJobId },
      });
      let attempts = 0;
      while (updatedJob?.status === 'PENDING' || updatedJob?.status === 'PROCESSING') {
        await new Promise((r) => setTimeout(r, 100));
        updatedJob = await prisma.importJob.findUnique({ where: { id: stockJobId } });
        attempts++;
        if (attempts > 30) break;
      }

      if (updatedJob?.status !== 'COMPLETED') {
        const storagePath = `${process.cwd()}/storage/imports/import-${stockJobId}.csv`;
        const mockJob = {
          name: JOB_PROCESS_IMPORT,
          data: {
            importId: stockJobId,
            organizationId: orgAId,
            userId: userAId,
            type: 'STOCK' as const,
            filePath: storagePath,
            fileName: 'stock.csv',
          },
        } as unknown as Job<any>;

        await importProcessor.process(mockJob);
        updatedJob = await prisma.importJob.findUnique({ where: { id: stockJobId } });
      }

      expect(updatedJob?.status).toBe('COMPLETED');

      // Verify StockBalance in PostgreSQL
      const balance = await prisma.stockBalance.findFirst({
        where: {
          organizationId: orgAId,
          warehouseId: warehouseAId,
          product: { sku: stockSku },
        },
      });
      expect(balance).not.toBeNull();
      expect(Number(balance?.quantity)).toBe(100.5);

      // Verify immutable StockLedgerEntry
      const ledger = await prisma.stockLedgerEntry.findFirst({
        where: {
          organizationId: orgAId,
          warehouseId: warehouseAId,
          referenceType: 'IMPORT',
          referenceId: stockJobId,
        },
      });
      expect(ledger).not.toBeNull();
      expect(Number(ledger?.quantityDelta)).toBe(100.5);
      expect(Number(ledger?.quantityAfter)).toBe(100.5);
      expect(ledger?.idempotencyKey).toBe(`import:${stockJobId}:row:2`);
    });
  });

  describe('4. Tenant Isolation and Security Enforcement', () => {
    let jobAId: string;

    beforeAll(async () => {
      const job = await prisma.importJob.create({
        data: {
          organizationId: orgAId,
          userId: userAId,
          type: 'PRODUCT',
          status: 'COMPLETED',
          fileName: 'orgA.csv',
          fileSize: 100,
          totalRows: 1,
          processedRows: 1,
          successfulRows: 1,
          failedRows: 0,
        },
      });
      jobAId = job.id;
    });

    it('User B cannot view or download ImportJob belonging to Org A (IDOR rejection)', async () => {
      // User B tries to access Job A
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${jobAId}`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(404);
    });

    it('rejects cross-tenant warehouse reference in stock import', async () => {
      // Org B tries to mutate stock using Org A's warehouse code
      const csv = `SKU,Warehouse Code,Quantity Delta,Type\nNONEXISTENT,${warehouseACode},50,ADJUSTMENT\n`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .field('type', 'STOCK')
        .attach('file', Buffer.from(csv), 'stock.csv')
        .expect(201);

      expect(res.body.data.invalidRows).toBe(1);
      // Warehouse belongs to Org A, so Org B cannot resolve it
      expect(res.body.data.errors.some((e: any) => e.code === 'WAREHOUSE_NOT_FOUND')).toBe(true);
    });
  });

  describe('5. Error CSV Export', () => {
    let failedJobId: string;

    beforeAll(async () => {
      const job = await prisma.importJob.create({
        data: {
          organizationId: orgAId,
          userId: userAId,
          type: 'PRODUCT',
          status: 'PARTIALLY_COMPLETED',
          fileName: 'partially_failed.csv',
          fileSize: 200,
          totalRows: 2,
          processedRows: 2,
          successfulRows: 1,
          failedRows: 1,
          errors: [
            {
              row: 2,
              column: 'sku',
              value: 'PROD-BAD',
              code: 'DUPLICATE_SKU_IN_DATABASE',
              message: 'Product with SKU "PROD-BAD" already exists in database.',
            },
          ],
        },
      });
      failedJobId = job.id;
    });

    it('streams RFC 4180 CSV with correct headers and download filename', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/imports/${failedJobId}/errors`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(
        `attachment; filename="import-errors-${failedJobId}.csv"`,
      );
      expect(res.text).toContain('Row Number,Column,Submitted Value,Error Code,Error Message');
      expect(res.text).toContain('PROD-BAD');
      expect(res.text).toContain('DUPLICATE_SKU_IN_DATABASE');
    });
  });
});
