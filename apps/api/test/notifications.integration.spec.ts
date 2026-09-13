import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService, Prisma } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { LowStockProcessor } from '../src/modules/worker/low-stock.processor';
import { ReportExportProcessor } from '../src/modules/worker/report-export.processor';
import { JOB_CHECK_LOW_STOCK, JOB_PROCESS_REPORT_EXPORT } from '../src/modules/queue/queue.constants';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
import { Job } from 'bullmq';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Notifications & Background Jobs Integration Tests', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;
  let lowStockProcessor: LowStockProcessor;
  let reportExportProcessor: ReportExportProcessor;
  let stockMutationService: StockMutationService;

  const timestamp = Date.now();
  const userA = {
    email: `notif-user-a-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Notif Org A ${timestamp}`,
  };

  const userB = {
    email: `notif-user-b-${timestamp}@example.com`,
    password: 'Password123!',
    organizationName: `Notif Org B ${timestamp}`,
  };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;
  let whAId: string;
  let prodAId: string;

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
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    lowStockProcessor = app.get<LowStockProcessor>(LowStockProcessor);
    reportExportProcessor = app.get<ReportExportProcessor>(ReportExportProcessor);
    stockMutationService = app.get<StockMutationService>(StockMutationService);

    // 1. Setup User & Org A
    const regResA = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userA);
    orgAId = regResA.body.data.organization.id;
    userAId = regResA.body.data.user.id;

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password });
    const cookiesA: string[] = loginResA.headers['set-cookie'];
    tokenA = cookiesA.find((c) => c.startsWith('accessToken='))!.split(';')[0]!.split('=')[1]!;

    // 2. Setup User & Org B
    const regResB = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userB);
    orgBId = regResB.body.data.organization.id;
    userBId = regResB.body.data.user.id;

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userB.email, password: userB.password });
    const cookiesB: string[] = loginResB.headers['set-cookie'];
    tokenB = cookiesB.find((c) => c.startsWith('accessToken='))!.split(';')[0]!.split('=')[1]!;

    // 3. Fixtures for Org A
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Hardware ${timestamp}` },
    });

    const whA = await prisma.warehouse.create({
      data: { organizationId: orgAId, name: `Central Warehouse ${timestamp}`, code: `CWH-${timestamp}` },
    });
    whAId = whA.id;

    const prodA = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Microcontroller ${timestamp}`,
        sku: `MCU-${timestamp}`,
        barcode: `BAR-${timestamp}`,
        status: 'ACTIVE',
      },
    });
    prodAId = prodA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Notifications REST API & Tenant Isolation', () => {
    let notifA1Id: string;
    let notifA2Id: string;

    beforeAll(async () => {
      // Seed notifications for Org A
      const n1 = await prisma.notification.create({
        data: {
          organizationId: orgAId,
          userId: userAId,
          type: 'SYSTEM',
          title: 'System Notice Org A',
          message: 'Welcome to Org A system notifications',
          isRead: false,
        },
      });
      notifA1Id = n1.id;

      const n2 = await prisma.notification.create({
        data: {
          organizationId: orgAId,
          userId: null, // Broadcast to entire Org A
          type: 'LOW_STOCK',
          title: 'Broadcast Alert Org A',
          message: 'Broadcast notification',
          isRead: false,
        },
      });
      notifA2Id = n2.id;

      // Seed notification for Org B
      await prisma.notification.create({
        data: {
          organizationId: orgBId,
          userId: userBId,
          type: 'SYSTEM',
          title: 'System Notice Org B',
          message: 'Org B isolated notification',
          isRead: false,
        },
      });
    });

    it('Org A should list only Org A notifications with unread count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(2);

      // Verify no Org B notification leaked
      const hasOrgBNotice = res.body.data.items.some(
        (n: any) => n.title === 'System Notice Org B',
      );
      expect(hasOrgBNotice).toBe(false);
    });

    it('GET /api/v1/notifications/unread-count returns accurate unread count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(2);
    });

    it('Org A marks single notification as read', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notifA1Id}/read`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(notifA1Id);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('IDOR Protection: Org B cannot mark Org A notification as read', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notifA2Id}/read`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .expect(404);
    });

    it('Org A marks all remaining notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.markedCount).toBeGreaterThanOrEqual(1);

      // Confirm unread count is now 0
      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(countRes.body.data.unreadCount).toBe(0);
    });
  });

  describe('2. Low-Stock Alert & Deduplication Pipeline', () => {
    it('executes stock mutation dropping stock to 5 and creates LOW_STOCK notification', async () => {
      // 1. Initial intake of 100 units
      await stockMutationService.mutateStock({
        organizationId: orgAId,
        productId: prodAId,
        warehouseId: whAId,
        mutationType: 'STOCK_INTAKE',
        quantity: new Prisma.Decimal(100),
        reason: 'Initial delivery',
      });

      // 2. Adjust stock down to 5 units (<= 10 threshold)
      await stockMutationService.mutateStock({
        organizationId: orgAId,
        productId: prodAId,
        warehouseId: whAId,
        mutationType: 'STOCK_ADJUSTMENT',
        quantity: new Prisma.Decimal(-95),
        reason: 'Large inventory adjustment to low stock',
      });

      // 3. Process low stock job via LowStockProcessor
      const mockJob = {
        name: JOB_CHECK_LOW_STOCK,
        data: {
          organizationId: orgAId,
          productId: prodAId,
          warehouseId: whAId,
          quantityAfter: 5,
          threshold: 10,
        },
      } as unknown as Job;

      const jobResult = await lowStockProcessor.process(mockJob);
      expect(jobResult.success).toBe(true);
      expect(jobResult.action).toBe('created_low_stock');

      // 4. Verify notification in DB
      const notif = await prisma.notification.findFirst({
        where: {
          organizationId: orgAId,
          type: 'LOW_STOCK',
          isRead: false,
        },
      });
      expect(notif).not.toBeNull();
      expect(notif?.title).toContain('Low Stock Alert');

      // 5. Deduplication check: second run while unread alert exists must be suppressed
      const dupResult = await lowStockProcessor.process(mockJob);
      expect(dupResult.success).toBe(true);
      expect(dupResult.action).toBe('suppressed_duplicate');
    });

    it('drops stock to 0 and creates OUT_OF_STOCK notification', async () => {
      // Mark previous unread notifications as read
      await prisma.notification.updateMany({
        where: { organizationId: orgAId },
        data: { isRead: true },
      });

      // Adjust remaining 5 units to 0
      await stockMutationService.mutateStock({
        organizationId: orgAId,
        productId: prodAId,
        warehouseId: whAId,
        mutationType: 'STOCK_ADJUSTMENT',
        quantity: new Prisma.Decimal(-5),
        reason: 'Sold out all remaining units',
      });

      const oosJob = {
        name: JOB_CHECK_LOW_STOCK,
        data: {
          organizationId: orgAId,
          productId: prodAId,
          warehouseId: whAId,
          quantityAfter: 0,
          threshold: 10,
        },
      } as unknown as Job;

      const jobResult = await lowStockProcessor.process(oosJob);
      expect(jobResult.success).toBe(true);
      expect(jobResult.action).toBe('created_out_of_stock');

      const oosNotif = await prisma.notification.findFirst({
        where: {
          organizationId: orgAId,
          type: 'OUT_OF_STOCK',
          isRead: false,
        },
      });
      expect(oosNotif).not.toBeNull();
      expect(oosNotif?.title).toContain('Out of Stock');
    });
  });

  describe('3. Asynchronous Report Export Lifecycle & Download', () => {
    let exportId: string;

    it('POST /api/v1/reports/exports queues an export job and returns PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/exports')
        .set('Cookie', [`accessToken=${tokenA}`])
        .send({
          reportType: 'stock-movement',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.exportId).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
      exportId = res.body.data.exportId;
    });

    it('GET /api/v1/reports/exports/:id returns job status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reports/exports/${exportId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(exportId);
      expect(res.body.data.reportType).toBe('stock-movement');
    });

    it('Worker executes ReportExportProcessor: generates CSV, updates job to COMPLETED, and notifies user', async () => {
      const mockExportJob = {
        name: JOB_PROCESS_REPORT_EXPORT,
        data: {
          exportId,
          organizationId: orgAId,
          userId: userAId,
          reportType: 'stock-movement',
          queryParams: { reportType: 'stock-movement' },
        },
      } as unknown as Job;

      const workerResult = await reportExportProcessor.process(mockExportJob);
      expect(workerResult.success).toBe(true);

      // Verify job is now COMPLETED
      const jobInDb = await prisma.exportJob.findUnique({
        where: { id: exportId },
      });
      expect(jobInDb?.status).toBe('COMPLETED');
      expect(jobInDb?.fileName).toBeDefined();
      expect(jobInDb?.fileSize).toBeGreaterThan(0);
      expect(jobInDb?.completedAt).not.toBeNull();

      // Verify EXPORT_READY notification was created
      const exportNotif = await prisma.notification.findFirst({
        where: {
          organizationId: orgAId,
          userId: userAId,
          type: 'EXPORT_READY',
          isRead: false,
        },
      });
      expect(exportNotif).not.toBeNull();
      expect(exportNotif?.title).toContain('Stock Movement Export Ready');
    });

    it('GET /api/v1/reports/exports/:id/download streams valid RFC 4180 CSV file', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reports/exports/${exportId}/download`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`export-${exportId}.csv`);
      expect(res.text).toContain('Ledger Entry ID');
      expect(res.text).toContain('Quantity Change');
    });

    it('IDOR Protection: Org B cannot access or download Org A export job', async () => {
      // 1. Get status check fails with 404
      await request(app.getHttpServer())
        .get(`/api/v1/reports/exports/${exportId}`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .expect(404);

      // 2. Download check fails with 404
      await request(app.getHttpServer())
        .get(`/api/v1/reports/exports/${exportId}/download`)
        .set('Cookie', [`accessToken=${tokenB}`])
        .expect(404);
    });
  });
});
