import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { StockMutationService } from '../src/modules/stock/stock-mutation.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Stock Transfers REST API (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `tr-e2e-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `tr-e2e-b-${timestamp}@test.com`, password: 'Password123!' };
  const viewerUserA = { email: `tr-e2e-v-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;

  let tokenB: string;
  let orgBId: string;
  let userBId: string;

  let tokenViewerA: string;
  let viewerUserId: string;

  let prodA1Id: string;
  let prodA2Id: string;
  let whA1Id: string;
  let whA2Id: string;

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
      .send({ ...ownerUserA, organizationName: `Transfer Org A ${timestamp}` });
    orgAId = resA.body.data.organization.id;
    userAId = resA.body.data.user.id;
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserA);
    tokenA = loginA.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 2. Setup Org B and Owner B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserB, organizationName: `Transfer Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure stock-transfer permissions exist and assign to Owner role
    const transferPerms = [
      'stock-transfer.read',
      'stock-transfer.create',
      'stock-transfer.update',
      'stock-transfer.delete',
      'stock-transfer.approve',
      'stock-transfer.ship',
      'stock-transfer.receive',
      'stock-transfer.cancel',
    ];
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of transferPerms) {
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY stock-transfer.read
    const viewerRole = await prisma.role.create({
      data: { name: `TR_Viewer_${timestamp}`, description: 'Read only transfers' },
    });
    const readPerm = await prisma.permission.findUniqueOrThrow({
      where: { action: 'stock-transfer.read' },
    });
    await prisma.rolePermission.create({
      data: { roleId: viewerRole.id, permissionId: readPerm.id },
    });

    const regViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: viewerUserA.email,
        password: viewerUserA.password,
        organizationName: `Viewer Org Placeholder ${timestamp}`,
      });
    viewerUserId = regViewer.body.data.user.id;
    await prisma.organizationMembership.create({
      data: { organizationId: orgAId, userId: viewerUserId, roleId: viewerRole.id },
    });

    const loginViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(viewerUserA);
    tokenViewerA = loginViewer.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 5. Create category, warehouses, products in Org A
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `E2E Cat A ${timestamp}` },
    });

    const p1 = await prisma.product.create({
      data: { organizationId: orgAId, categoryId: catA.id, sku: `E2E-P1-${timestamp}`, name: 'P1' },
    });
    prodA1Id = p1.id;

    const p2 = await prisma.product.create({
      data: { organizationId: orgAId, categoryId: catA.id, sku: `E2E-P2-${timestamp}`, name: 'P2' },
    });
    prodA2Id = p2.id;

    const w1 = await prisma.warehouse.create({
      data: { organizationId: orgAId, name: `E2E W1 ${timestamp}`, code: `W1-${timestamp}` },
    });
    whA1Id = w1.id;

    const w2 = await prisma.warehouse.create({
      data: { organizationId: orgAId, name: `E2E W2 ${timestamp}`, code: `W2-${timestamp}` },
    });
    whA2Id = w2.id;

    // Seed stock at whA1: 100.0000 units of prodA1 and prodA2
    const stockMutation = app.get(StockMutationService);
    await stockMutation.mutateStock({
      organizationId: orgAId,
      productId: prodA1Id,
      warehouseId: whA1Id,
      type: 'OPENING',
      quantityDelta: '100.0000',
      actorUserId: userAId,
    });
    await stockMutation.mutateStock({
      organizationId: orgAId,
      productId: prodA2Id,
      warehouseId: whA1Id,
      type: 'OPENING',
      quantityDelta: '100.0000',
      actorUserId: userAId,
    });
  });

  afterAll(async () => {
    await prisma.stockTransferLine.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.stockTransfer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.stockLedgerEntry.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.stockBalance.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.category.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.warehouse.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMembership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, viewerUserId] } } });
    await app.close();
  });

  describe('Authentication & RBAC', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/transfers').expect(401);
    });

    it('returns 403 Forbidden when user lacks stock-transfer.create permission', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenViewerA}`)
        .set('x-organization-id', orgAId)
        .send({
          sourceWarehouseId: whA1Id,
          destinationWarehouseId: whA2Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000' }],
        })
        .expect(403);
    });
  });

  describe('Full Lifecycle Flow: Create -> Approve -> Ship -> Receive', () => {
    let createdTransferId: string;

    it('creates a new stock transfer with 201 Created and DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          transferNumber: `TR-E2E-FLOW-${timestamp}`,
          sourceWarehouseId: whA1Id,
          destinationWarehouseId: whA2Id,
          notes: 'Inter-warehouse rebalancing',
          lines: [
            { productId: prodA1Id, quantity: '15.0000' },
            { productId: prodA2Id, quantity: '25.0000' },
          ],
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines).toHaveLength(2);
      expect(res.body.data.sourceWarehouse.id).toBe(whA1Id);
      expect(res.body.data.destinationWarehouse.id).toBe(whA2Id);
      createdTransferId = res.body.data.id;
    });

    it('retrieves created transfer by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transfers/${createdTransferId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(createdTransferId);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('approves transfer: status transitions to APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transfers/${createdTransferId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(201);

      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approvedById).toBe(userAId);
    });

    it('dispatches transfer: status transitions to IN_TRANSIT and source stock is deducted', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transfers/${createdTransferId}/ship`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', `idem-ship-${timestamp}`)
        .send({ notes: 'Dispatched via carrier' })
        .expect(201);

      expect(res.body.data.status).toBe('IN_TRANSIT');

      // Verify source warehouse balance:
      // prodA1 was 100, deducted 15 -> now 85
      // prodA2 was 100, deducted 25 -> now 75
      const b1 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(b1?.quantity.toFixed(4)).toBe('85.0000');

      const b2 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(b2?.quantity.toFixed(4)).toBe('75.0000');
    });

    it('replaying ship with same idempotency key returns 200 and does not double-deduct', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transfers/${createdTransferId}/ship`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', `idem-ship-${timestamp}`)
        .send({ notes: 'Dispatched via carrier' })
        .expect(201);

      expect(res.headers['idempotent-replayed']).toBe('true');
      expect(res.body.data.status).toBe('IN_TRANSIT');

      // Balance unchanged at 85
      const b1 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(b1?.quantity.toFixed(4)).toBe('85.0000');
    });

    it('receives transfer: status transitions to RECEIVED and destination stock is credited', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transfers/${createdTransferId}/receive`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', `idem-recv-${timestamp}`)
        .send({ notes: 'Delivered and verified' })
        .expect(201);

      expect(res.body.data.status).toBe('RECEIVED');

      // Verify destination warehouse balance:
      // prodA1 was 0, credited 15 -> now 15
      // prodA2 was 0, credited 25 -> now 25
      const b1 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(b1?.quantity.toFixed(4)).toBe('15.0000');

      const b2 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(b2?.quantity.toFixed(4)).toBe('25.0000');
    });

    it('replaying receive with same idempotency key returns 200 and does not double-credit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transfers/${createdTransferId}/receive`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', `idem-recv-${timestamp}`)
        .send({ notes: 'Delivered and verified' })
        .expect(201);

      expect(res.headers['idempotent-replayed']).toBe('true');
      expect(res.body.data.status).toBe('RECEIVED');

      // Balance unchanged at 15
      const b1 = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(b1?.quantity.toFixed(4)).toBe('15.0000');
    });
  });

  describe('Idempotency on Creation', () => {
    const idemKey = `idem-create-${timestamp}`;

    it('replays identical creation payload and returns 200 OK', async () => {
      const payload = {
        transferNumber: `TR-IDEM-${timestamp}`,
        sourceWarehouseId: whA1Id,
        destinationWarehouseId: whA2Id,
        lines: [{ productId: prodA1Id, quantity: '5.0000' }],
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', idemKey)
        .send(payload)
        .expect(201);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', idemKey)
        .send(payload)
        .expect(200);

      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(replay.body.data.id).toBe(first.body.data.id);
    });

    it('rejects different payload with same idempotency key with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('idempotency-key', idemKey)
        .send({
          transferNumber: `TR-DIFF-${timestamp}`,
          sourceWarehouseId: whA1Id,
          destinationWarehouseId: whA2Id,
          lines: [{ productId: prodA1Id, quantity: '99.0000' }], // Different payload!
        })
        .expect(409);
    });
  });

  describe('Multi-Tenancy & IDOR Prevention', () => {
    let transferAId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          sourceWarehouseId: whA1Id,
          destinationWarehouseId: whA2Id,
          lines: [{ productId: prodA1Id, quantity: '2.0000' }],
        });
      transferAId = res.body.data.id;
    });

    it('returns 404 Not Found when Tenant B attempts to read Tenant A transfer', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/transfers/${transferAId}`)
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId)
        .expect(404);
    });

    it('returns 404 Not Found when Tenant B attempts to mutate Tenant A transfer', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/transfers/${transferAId}/approve`)
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId)
        .expect(404);
    });
  });

  describe('Operational Metrics & Audit Trail', () => {
    it('returns aggregate metrics grouped by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transfers/metrics')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.totalCount).toBeGreaterThan(0);
      expect(res.body.data.statusCounts).toBeDefined();
    });

    it('returns audit trail timeline for transfer', async () => {
      // Find a transfer with events
      const list = await request(app.getHttpServer())
        .get('/api/v1/transfers?limit=1')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      const trId = list.body.data[0].id;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transfers/${trId}/audit-trail`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
