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

describe('Purchase Order REST API (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `po-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `po-owner-b-${timestamp}@test.com`, password: 'Password123!' };
  const viewerUserA = { email: `po-viewer-a-${timestamp}@test.com`, password: 'Password123!' };
  const creatorOnlyUserA = {
    email: `po-creator-a-${timestamp}@test.com`,
    password: 'Password123!',
  };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;

  let tokenB: string;
  let orgBId: string;
  let userBId: string;

  let tokenViewerA: string;
  let viewerUserId: string;

  let tokenCreatorA: string;
  let creatorUserId: string;

  let prodA1Id: string;
  let prodA2Id: string;
  let whA1Id: string;

  let prodBId: string;
  let whBId: string;

  let baselineStockBalances: number;
  let baselineStockLedgers: number;

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
      .send({ ...ownerUserA, organizationName: `PO Org A ${timestamp}` });
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
      .send({ ...ownerUserB, organizationName: `PO Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure purchase-order permissions exist and assign to Owner role
    const poPerms = [
      'purchase-order.read',
      'purchase-order.create',
      'purchase-order.update',
      'purchase-order.delete',
      'purchase-order.submit',
      'purchase-order.approve',
      'purchase-order.cancel',
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY purchase-order.read
    let viewerRole = await prisma.role.findFirst({ where: { name: `POViewer_${timestamp}` } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: {
          name: `POViewer_${timestamp}`,
          description: 'Read only PO',
        },
      });
      const readPerm = await prisma.permission.findFirstOrThrow({
        where: { action: 'purchase-order.read' },
      });
      await prisma.rolePermission.create({
        data: { roleId: viewerRole.id, permissionId: readPerm.id },
      });
    }

    const regViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: viewerUserA.email,
        password: viewerUserA.password,
        organizationName: `Viewer Org Placeholder ${timestamp}`,
      });
    viewerUserId = regViewer.body.data.user.id;

    await prisma.organizationMembership.create({
      data: {
        userId: viewerUserId,
        organizationId: orgAId,
        roleId: viewerRole.id,
      },
    });

    const loginViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(viewerUserA);
    tokenViewerA = loginViewer.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 5. Setup Creator-Only User in Org A with purchase-order.read and purchase-order.create
    let creatorRole = await prisma.role.findFirst({ where: { name: `POCreator_${timestamp}` } });
    if (!creatorRole) {
      creatorRole = await prisma.role.create({
        data: {
          name: `POCreator_${timestamp}`,
          description: 'Create only PO',
        },
      });
      const readPerm = await prisma.permission.findFirstOrThrow({
        where: { action: 'purchase-order.read' },
      });
      const createPerm = await prisma.permission.findFirstOrThrow({
        where: { action: 'purchase-order.create' },
      });
      await prisma.rolePermission.createMany({
        data: [
          { roleId: creatorRole.id, permissionId: readPerm.id },
          { roleId: creatorRole.id, permissionId: createPerm.id },
        ],
      });
    }

    const regCreator = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: creatorOnlyUserA.email,
        password: creatorOnlyUserA.password,
        organizationName: `Creator Org Placeholder ${timestamp}`,
      });
    creatorUserId = regCreator.body.data.user.id;

    await prisma.organizationMembership.create({
      data: {
        userId: creatorUserId,
        organizationId: orgAId,
        roleId: creatorRole.id,
      },
    });

    const loginCreator = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(creatorOnlyUserA);
    tokenCreatorA = loginCreator.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 6. Setup Products & Warehouses for Org A
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `PO E2E Cat A ${timestamp}` },
    });
    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        sku: `PO-E2E-PROD-A1-${timestamp}`,
        name: 'PO E2E Product A1',
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        sku: `PO-E2E-PROD-A2-${timestamp}`,
        name: 'PO E2E Product A2',
      },
    });
    prodA2Id = prodA2.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        code: `PO-WHA1-${timestamp}`.toUpperCase(),
        name: `PO Warehouse A1 ${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    // 7. Setup Products & Warehouses for Org B
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `PO E2E Cat B ${timestamp}` },
    });
    const prodB = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        sku: `PO-E2E-PROD-B-${timestamp}`,
        name: 'PO E2E Product B',
      },
    });
    prodBId = prodB.id;

    const whB = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        code: `PO-WHB-${timestamp}`.toUpperCase(),
        name: `PO Warehouse B ${timestamp}`,
      },
    });
    whBId = whB.id;

    // Record baseline StockBalance and StockLedgerEntry counts before test operations
    baselineStockBalances = await prisma.stockBalance.count();
    baselineStockLedgers = await prisma.stockLedgerEntry.count();
  });

  afterAll(async () => {
    if (prisma) {
      const orgIds = [orgAId, orgBId].filter(Boolean);
      if (orgIds.length > 0) {
        await prisma.purchaseOrderLine.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.purchaseOrder.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.stockLedgerEntry.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.stockBalance.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.warehouse.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.category.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.auditEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
        await prisma.organizationMembership.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      }
      const userIds = [userAId, userBId, viewerUserId, creatorUserId].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Authentication & RBAC Guard Enforcement', () => {
    it('returns 401 Unauthorized when no authentication credentials provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/purchase-orders');
      expect(res.status).toBe(401);
    });

    it('returns 401 Unauthorized when invalid token provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders')
        .set('Cookie', 'accessToken=invalid-token');
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when user lacks purchase-order.create permission', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenViewerA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-NO-PERM-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '15.0000' }],
        });
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when user lacks purchase-order.approve permission', async () => {
      // First create a draft PO using creator
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenCreatorA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-CREATOR-PO-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '20.0000' }],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;

      // Creator attempts to approve PO without purchase-order.approve permission
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/approve`)
        .set('Cookie', `accessToken=${tokenCreatorA}`)
        .set('x-organization-id', orgAId);
      expect(approveRes.status).toBe(403);
    });
  });

  describe('2. Tenant Isolation & IDOR Protection', () => {
    let poOrgBId: string;

    beforeAll(async () => {
      // Create PO in Org B
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId)
        .send({
          purchaseOrderNumber: `PO-ORGB-ONLY-${timestamp}`,
          supplierName: 'Supplier Org B',
          warehouseId: whBId,
          lines: [{ productId: prodBId, quantity: '2.0000', unitPrice: '50.0000' }],
        });
      expect(res.status).toBe(201);
      poOrgBId = res.body.data.id;
    });

    it('returns 404 when Org A attempts to GET Org B purchase order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${poOrgBId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(res.status).toBe(404);
    });

    it('returns 404 when Org A attempts to PATCH Org B purchase order', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${poOrgBId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ supplierName: 'Malicious Update' });
      expect(res.status).toBe(404);
    });

    it('returns 404 when Org A attempts to DELETE Org B purchase order', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/purchase-orders/${poOrgBId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(res.status).toBe(404);
    });

    it('returns 404 when Org A attempts to submit Org B purchase order', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poOrgBId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(res.status).toBe(404);
    });

    it('returns 404 when PO creation in Org A references a warehouse belonging to Org B', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-CROSS-WH-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whBId, // Org B's warehouse!
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '10.0000' }],
        });
      expect(res.status).toBe(404);
    });

    it('returns 404 when PO creation in Org A references a product belonging to Org B', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-CROSS-PROD-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodBId, quantity: '10.0000', unitPrice: '10.0000' }], // Org B's product!
        });
      expect(res.status).toBe(404);
    });
  });

  describe('3. Validation, Exact Precision & Authoritative Totals', () => {
    it('creates PO with exact 4-decimal arithmetic and authoritative server totals', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-EXACT-CALC-${timestamp}`,
          supplierName: 'Precision Supplier',
          supplierEmail: 'precision@supplier.com',
          warehouseId: whA1Id,
          currency: 'INR',
          notes: 'Important batch',
          lines: [
            { productId: prodA1Id, quantity: '12.5000', unitPrice: '10.0000' },
            { productId: prodA2Id, quantity: '4.2500', unitPrice: '20.0000' },
          ],
        });

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.purchaseOrderNumber).toBe(`PO-EXACT-CALC-${timestamp}`);
      expect(data.status).toBe('DRAFT');
      expect(data.lines).toHaveLength(2);

      // Line 1: 12.5000 * 10.0000 = 125.0000
      expect(data.lines[0].lineTotal).toBe('125.0000');
      // Line 2: 4.2500 * 20.0000 = 85.0000
      expect(data.lines[1].lineTotal).toBe('85.0000');

      // Subtotal = 125.0000 + 85.0000 = 210.0000
      expect(data.subtotal).toBe('210.0000');
      expect(data.taxTotal).toBe('0.0000');
      expect(data.grandTotal).toBe('210.0000');
    });

    it('rejects client attempting to pass fabricated grandTotal or subtotal via forbidNonWhitelisted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-FABRICATED-${timestamp}`,
          supplierName: 'Cheating Supplier',
          warehouseId: whA1Id,
          subtotal: '0.0001', // Fabricated field!
          grandTotal: '0.0001', // Fabricated field!
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '100.0000' }],
        });

      expect(res.status).toBe(400);
    });

    it('rejects negative quantity or scale > 4', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-INVALID-QTY-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.12345', unitPrice: '10.0000' }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects negative unit price', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-NEG-PRICE-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '-5.0000' }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate products in the same purchase order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-DUP-PROD-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [
            { productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' },
            { productId: prodA1Id, quantity: '10.0000', unitPrice: '12.0000' },
          ],
        });
      expect(res.status).toBe(400);
    });

    it('rejects expectedDate earlier than orderDate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-DATE-ERR-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          orderDate: '2026-10-15T00:00:00.000Z',
          expectedDate: '2026-10-10T00:00:00.000Z', // Before orderDate!
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('4. Concurrency & Duplicate PO Number Race Condition', () => {
    it('concurrent duplicate PO number creations in same org: exactly 1 succeeds and 1 fails with 409', async () => {
      const racePoNumber = `PO-CONCURRENT-RACE-${timestamp}`;

      const attemptCreation = () =>
        request(app.getHttpServer())
          .post('/api/v1/purchase-orders')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .send({
            purchaseOrderNumber: racePoNumber,
            supplierName: 'Race Supplier',
            warehouseId: whA1Id,
            lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '50.0000' }],
          });

      const [res1, res2] = await Promise.all([attemptCreation(), attemptCreation()]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it('allows identical PO number across distinct organizations', async () => {
      const sharedPoNumber = `PO-SHARED-MULTI-TENANT-${timestamp}`;

      const resA = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: sharedPoNumber,
          supplierName: 'Supplier Org A',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '25.0000' }],
        });
      expect(resA.status).toBe(201);

      const resB = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId)
        .send({
          purchaseOrderNumber: sharedPoNumber, // Same PO number in Org B!
          supplierName: 'Supplier Org B',
          warehouseId: whBId,
          lines: [{ productId: prodBId, quantity: '1.0000', unitPrice: '30.0000' }],
        });
      expect(resB.status).toBe(201);
    });
  });

  describe('5. Idempotency Reconciliation & Replay Semantics', () => {
    const idemKey = `PO-IDEM-KEY-${timestamp}`;

    it('rejects mismatch between header and body idempotency keys with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', 'KEY-FROM-HEADER')
        .send({
          purchaseOrderNumber: `PO-IDEM-MISMATCH-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          idempotencyKey: 'KEY-FROM-BODY',
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      expect(res.status).toBe(400);
    });

    it('creates initial order with 201 Created and caches response for key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idemKey)
        .send({
          purchaseOrderNumber: `PO-IDEM-OK-${timestamp}`,
          supplierName: 'Idem Supplier',
          warehouseId: whA1Id,
          idempotencyKey: idemKey,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.purchaseOrderNumber).toBe(`PO-IDEM-OK-${timestamp}`);
    });

    it('replays identical cached response with 200 OK on duplicate request with same key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idemKey)
        .send({
          purchaseOrderNumber: `PO-IDEM-OK-${timestamp}`,
          supplierName: 'Idem Supplier',
          warehouseId: whA1Id,
          idempotencyKey: idemKey,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.purchaseOrderNumber).toBe(`PO-IDEM-OK-${timestamp}`);
    });

    it('returns 409 Conflict if same idempotency key is reused with differing request payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idemKey)
        .send({
          purchaseOrderNumber: `PO-DIFFERENT-${timestamp}`,
          supplierName: 'Different Supplier',
          warehouseId: whA1Id,
          idempotencyKey: idemKey,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' }],
        });

      expect(res.status).toBe(409);
    });
  });

  describe('6. Lifecycle & State Machine Transitions', () => {
    let poId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-LIFECYCLE-TEST-${timestamp}`,
          supplierName: 'Lifecycle Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '25.0000' }],
        });
      expect(res.status).toBe(201);
      poId = res.body.data.id;
    });

    it('transitions DRAFT -> SUBMITTED via POST /:id/submit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('transitions SUBMITTED -> APPROVED via POST /:id/approve', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approvedById).toBe(userAId);
      expect(res.body.data.approvedAt).toBeDefined();
    });

    it('rejects illegal transition APPROVED -> SUBMITTED with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });

    it('cancels an approved purchase order via POST /:id/cancel', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/cancel`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('rejects further transitions from CANCELLED (terminal state) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });
  });

  describe('7. PATCH & DELETE Invariants', () => {
    it('updates DRAFT purchase order permitted fields and recalculates lines atomically', async () => {
      // 1. Create DRAFT PO
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-TO-PATCH-${timestamp}`,
          supplierName: 'Original Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '10.0000' }],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;
      expect(createRes.body.data.grandTotal).toBe('100.0000');

      // 2. PATCH supplierName and lines
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          supplierName: 'Updated Supplier Name',
          notes: 'Updated notes',
          lines: [
            { productId: prodA1Id, quantity: '5.0000', unitPrice: '10.0000' },
            { productId: prodA2Id, quantity: '2.0000', unitPrice: '50.0000' },
          ],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.supplierName).toBe('Updated Supplier Name');
      expect(patchRes.body.data.notes).toBe('Updated notes');
      expect(patchRes.body.data.lines).toHaveLength(2);
      // (5 * 10) + (2 * 50) = 50 + 100 = 150.0000
      expect(patchRes.body.data.grandTotal).toBe('150.0000');
    });

    it('rejects PATCH on non-DRAFT (SUBMITTED/APPROVED) purchase order with 409 Conflict', async () => {
      // 1. Create and submit PO
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-NON-DRAFT-PATCH-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '2.0000', unitPrice: '10.0000' }],
        });
      const poId = createRes.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      // 2. Attempt to PATCH submitted PO
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ supplierName: 'Illegal Update' });

      expect(patchRes.status).toBe(409);
    });

    it('deletes DRAFT purchase order via DELETE /:id', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-TO-DELETE-${timestamp}`,
          supplierName: 'Delete Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      const poId = createRes.body.data.id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(deleteRes.status).toBe(200);

      // Verify not found
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(getRes.status).toBe(404);
    });

    it('rejects DELETE on SUBMITTED purchase order with 409 Conflict', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-SUBMIT-NO-DEL-${timestamp}`,
          supplierName: 'Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      const poId = createRes.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(deleteRes.status).toBe(409);
    });
  });

  describe('8. Query, Filter, Sorting & Pagination', () => {
    it('filters purchase orders by status and warehouseId with paginated envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/purchase-orders?status=DRAFT&warehouseId=${whA1Id}&page=1&limit=10&sortBy=createdAt&sortOrder=desc`,
        )
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      for (const item of res.body.data) {
        expect(item.status).toBe('DRAFT');
        expect(item.warehouseId).toBe(whA1Id);
      }
    });

    it('searches purchase orders by purchaseOrderNumber substring', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders?search=EXACT-CALC`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].purchaseOrderNumber).toContain('EXACT-CALC');
    });
  });

  describe('9. CRITICAL STOCK SAFETY INVARIANT', () => {
    it('VERIFIES zero stock balance mutations and zero stock ledger entries across all PO operations', async () => {
      // 1. Measure baseline stock balances and ledger entries in Org A
      const initialBalancesCount = await prisma.stockBalance.count({
        where: { organizationId: orgAId },
      });
      const initialLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      // 2. Perform full PO lifecycle via REST API: CREATE -> PATCH -> SUBMIT -> APPROVE -> CANCEL
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-SAFETY-VERIFY-${timestamp}`,
          supplierName: 'Safety Supplier',
          warehouseId: whA1Id,
          lines: [
            { productId: prodA1Id, quantity: '1000.0000', unitPrice: '50.0000' },
            { productId: prodA2Id, quantity: '2000.0000', unitPrice: '75.0000' },
          ],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${poId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          lines: [{ productId: prodA1Id, quantity: '500.0000', unitPrice: '60.0000' }],
        });

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/cancel`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      // 3. Measure post stock balances and ledger entries
      const finalBalancesCount = await prisma.stockBalance.count({
        where: { organizationId: orgAId },
      });
      const finalLedgerCount = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId },
      });

      // ABSOLUTE ASSERTION: STOCK REMAINS TOTALLY UNTOUCHED
      expect(finalBalancesCount).toBe(initialBalancesCount);
      expect(finalLedgerCount).toBe(initialLedgerCount);
    });
  });

  describe('10. FOLLOW-UP 1: Concurrent Lifecycle Transitions (Real PostgreSQL)', () => {
    it('A. Concurrent APPROVE on SUBMITTED: exactly ONE succeeds, remaining fail with 400', async () => {
      // Setup: Create PO in SUBMITTED state
      const poNum = `PO-CONC-APPROVE-${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: poNum,
          supplierName: 'Concurrency Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '10.0000', unitPrice: '15.0000' }],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;

      const submitRes = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(submitRes.status).toBe(201);

      // Fire 10 concurrent APPROVE requests
      const fireApprove = () =>
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${poId}/approve`)
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId);

      const responses = await Promise.all([
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
        fireApprove(),
      ]);

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 400);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(9);
      for (const errRes of conflicts) {
        expect(errRes.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      }

      // Verify database state: APPROVED, approvedById and approvedAt set exactly once
      const poInDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
      });
      expect(poInDb.status).toBe('APPROVED');
      expect(poInDb.approvedById).toBe(userAId);
      expect(poInDb.approvedAt).not.toBeNull();

      // Verify audit events: exactly ONE approval audit event
      const approvalAudits = await prisma.auditEvent.findMany({
        where: {
          entityId: poId,
          action: 'PURCHASE_ORDER_STATUS_CHANGED',
        },
      });
      const approvalEvents = approvalAudits.filter(
        (a) => (a.metadata as Record<string, unknown>)?.toStatus === 'APPROVED',
      );
      expect(approvalEvents).toHaveLength(1);
    });

    it('B. Concurrent SUBMIT on DRAFT: exactly ONE succeeds, remaining fail with 400', async () => {
      // Setup: Create PO in DRAFT state
      const poNum = `PO-CONC-SUBMIT-${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: poNum,
          supplierName: 'Concurrency Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '5.0000', unitPrice: '20.0000' }],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;

      // Fire 10 concurrent SUBMIT requests
      const fireSubmit = () =>
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${poId}/submit`)
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId);

      const responses = await Promise.all([
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
        fireSubmit(),
      ]);

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 400);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(9);
      for (const errRes of conflicts) {
        expect(errRes.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      }

      // Verify database state: SUBMITTED
      const poInDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
      });
      expect(poInDb.status).toBe('SUBMITTED');

      // Verify audit events: exactly ONE submit transition audit event
      const submitAudits = await prisma.auditEvent.findMany({
        where: {
          entityId: poId,
          action: 'PURCHASE_ORDER_STATUS_CHANGED',
        },
      });
      const submitEvents = submitAudits.filter(
        (a) => (a.metadata as Record<string, unknown>)?.toStatus === 'SUBMITTED',
      );
      expect(submitEvents).toHaveLength(1);
    });

    it('C. Concurrent SUBMIT + CANCEL on DRAFT: exactly ONE transition wins, losing fails cleanly', async () => {
      // Setup: Create PO in DRAFT state
      const poNum = `PO-CONC-SUB-CANCEL-${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: poNum,
          supplierName: 'Concurrency Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '2.0000', unitPrice: '10.0000' }],
        });
      expect(createRes.status).toBe(201);
      const poId = createRes.body.data.id;

      // At the same time, fire submit and cancel
      const fireSubmit = () =>
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${poId}/submit`)
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId);

      const fireCancel = () =>
        request(app.getHttpServer())
          .post(`/api/v1/purchase-orders/${poId}/cancel`)
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId);

      const [resSubmit, resCancel] = await Promise.all([fireSubmit(), fireCancel()]);

      const statuses = [resSubmit.status, resCancel.status];
      // Exactly ONE transition succeeds (201) and ONE fails cleanly (400)
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const losingRes = resSubmit.status === 400 ? resSubmit : resCancel;
      expect(losingRes.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');

      // Verify database state matches the winner
      const poInDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
      });
      const expectedStatus = resSubmit.status === 201 ? 'SUBMITTED' : 'CANCELLED';
      expect(poInDb.status).toBe(expectedStatus);

      // Verify audit events: exactly ONE transition audit event committed
      const audits = await prisma.auditEvent.findMany({
        where: {
          entityId: poId,
          action: 'PURCHASE_ORDER_STATUS_CHANGED',
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(audits).toHaveLength(1);
      expect((audits[0]?.metadata as Record<string, unknown>)?.toStatus).toBe(expectedStatus);
    });
  });

  describe('11. FOLLOW-UP 2: Comprehensive Invalid Lifecycle & Mutation Invariant Matrix', () => {
    let draftPoId: string;
    let submittedPoId: string;
    let approvedPoId: string;
    let cancelledPoId: string;

    beforeAll(async () => {
      // 1. DRAFT PO
      const draftRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-ERR-DRAFT-${Date.now()}`,
          supplierName: 'Error Matrix Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      draftPoId = draftRes.body.data.id;

      // 2. SUBMITTED PO
      const subRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-ERR-SUBMITTED-${Date.now()}`,
          supplierName: 'Error Matrix Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      submittedPoId = subRes.body.data.id;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${submittedPoId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      // 3. APPROVED PO
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-ERR-APPROVED-${Date.now()}`,
          supplierName: 'Error Matrix Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      approvedPoId = appRes.body.data.id;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${approvedPoId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${approvedPoId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      // 4. CANCELLED PO
      const canRes = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-ERR-CANCELLED-${Date.now()}`,
          supplierName: 'Error Matrix Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });
      cancelledPoId = canRes.body.data.id;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${cancelledPoId}/cancel`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
    });

    it('SUBMIT from SUBMITTED returns 400 Bad Request (PURCHASE_ORDER_INVALID_TRANSITION)', async () => {
      const auditsBefore = await prisma.auditEvent.count({ where: { entityId: submittedPoId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${submittedPoId}/submit`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      const auditsAfter = await prisma.auditEvent.count({ where: { entityId: submittedPoId } });
      expect(auditsAfter).toBe(auditsBefore);
    });

    it('APPROVE from DRAFT returns 400 Bad Request (PURCHASE_ORDER_INVALID_TRANSITION)', async () => {
      const auditsBefore = await prisma.auditEvent.count({ where: { entityId: draftPoId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${draftPoId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      const auditsAfter = await prisma.auditEvent.count({ where: { entityId: draftPoId } });
      expect(auditsAfter).toBe(auditsBefore);
    });

    it('APPROVE from CANCELLED returns 400 Bad Request (PURCHASE_ORDER_INVALID_TRANSITION)', async () => {
      const auditsBefore = await prisma.auditEvent.count({ where: { entityId: cancelledPoId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${cancelledPoId}/approve`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      const auditsAfter = await prisma.auditEvent.count({ where: { entityId: cancelledPoId } });
      expect(auditsAfter).toBe(auditsBefore);
    });

    it('CANCEL from CANCELLED returns 400 Bad Request (PURCHASE_ORDER_INVALID_TRANSITION)', async () => {
      const auditsBefore = await prisma.auditEvent.count({ where: { entityId: cancelledPoId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${cancelledPoId}/cancel`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_INVALID_TRANSITION');
      const auditsAfter = await prisma.auditEvent.count({ where: { entityId: cancelledPoId } });
      expect(auditsAfter).toBe(auditsBefore);
    });

    it('UPDATE CANCELLED returns 409 Conflict (PURCHASE_ORDER_CANNOT_UPDATE)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${cancelledPoId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ supplierName: 'Illegal Update' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_CANNOT_UPDATE');
    });

    it('DELETE CANCELLED returns 409 Conflict (PURCHASE_ORDER_CANNOT_DELETE)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/purchase-orders/${cancelledPoId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_CANNOT_DELETE');
    });

    it('UPDATE APPROVED returns 409 Conflict (PURCHASE_ORDER_CANNOT_UPDATE)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${approvedPoId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ supplierName: 'Illegal Update' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_CANNOT_UPDATE');
    });

    it('DELETE APPROVED returns 409 Conflict (PURCHASE_ORDER_CANNOT_DELETE)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/purchase-orders/${approvedPoId}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PURCHASE_ORDER_CANNOT_DELETE');
    });
  });

  describe('12. FOLLOW-UP 3: Database-Enforced Idempotency Under Concurrency', () => {
    it('A. Same key + identical payload fired 20 times concurrently creates exactly 1 PO and 19 replays', async () => {
      const raceKey = `IDEM-RACE-20-${Date.now()}`;
      const racePoNumber = `PO-IDEM-RACE-20-${Date.now()}`;
      const payload = {
        purchaseOrderNumber: racePoNumber,
        supplierName: 'Race Idempotency Supplier',
        warehouseId: whA1Id,
        lines: [
          { productId: prodA1Id, quantity: '10.0000', unitPrice: '25.0000' },
          { productId: prodA2Id, quantity: '5.0000', unitPrice: '50.0000' },
        ],
      };

      const fireRequest = () =>
        request(app.getHttpServer())
          .post('/api/v1/purchase-orders')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .set('Idempotency-Key', raceKey)
          .send(payload);

      // Fire 20 requests concurrently
      const requests = Array.from({ length: 20 }, () => fireRequest());
      const responses = await Promise.all(requests);

      const createdResponses = responses.filter((r) => r.status === 201);
      const replayResponses = responses.filter((r) => r.status === 200);

      expect(createdResponses).toHaveLength(1);
      expect(replayResponses).toHaveLength(19);

      // All 20 responses resolve to the EXACT SAME purchase order
      const expectedPoId = createdResponses[0]?.body.data.id;
      expect(expectedPoId).toBeDefined();

      for (const res of responses) {
        expect(res.body.data.id).toBe(expectedPoId);
        expect(res.body.data.purchaseOrderNumber).toBe(racePoNumber);
        expect(res.body.data.grandTotal).toBe('500.0000');
        expect(res.body.data.lines).toHaveLength(2);
      }

      // Verify database: exactly ONE PurchaseOrder record exists with this number and key
      const dbOrders = await prisma.purchaseOrder.findMany({
        where: { organizationId: orgAId, purchaseOrderNumber: racePoNumber },
      });
      expect(dbOrders).toHaveLength(1);
      expect(dbOrders[0]?.idempotencyKey).toBe(raceKey);

      // Exactly ONE set of lines in database
      const dbLines = await prisma.purchaseOrderLine.findMany({
        where: { purchaseOrderId: expectedPoId },
      });
      expect(dbLines).toHaveLength(2);

      // Exactly ONE creation audit event
      const creationAudits = await prisma.auditEvent.findMany({
        where: {
          entityId: expectedPoId,
          action: 'PURCHASE_ORDER_CREATED',
        },
      });
      expect(creationAudits).toHaveLength(1);
    });

    it('B. Same key + different payload returns 409 Conflict without second PO or second lines', async () => {
      const conflictKey = `IDEM-CONFLICT-KEY-${Date.now()}`;
      const payloadA = {
        purchaseOrderNumber: `PO-CONF-A-${Date.now()}`,
        supplierName: 'Supplier A',
        warehouseId: whA1Id,
        lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
      };

      const payloadB = {
        purchaseOrderNumber: `PO-CONF-B-${Date.now()}`,
        supplierName: 'Supplier B (Altered)',
        warehouseId: whA1Id,
        lines: [{ productId: prodA1Id, quantity: '2.0000', unitPrice: '10.0000' }],
      };

      // First request: valid payload A -> 201
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', conflictKey)
        .send(payloadA);
      expect(res1.status).toBe(201);
      const originalPoId = res1.body.data.id;

      // Second request: altered payload B with same key -> 409
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', conflictKey)
        .send(payloadB);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('CONFLICT');

      // Verify original PO unchanged
      const originalPo = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: originalPoId },
        include: { lines: true },
      });
      expect(originalPo.supplierName).toBe('Supplier A');
      expect(originalPo.lines).toHaveLength(1);

      // Verify no second PO created with payloadB's number
      const secondPo = await prisma.purchaseOrder.findFirst({
        where: { organizationId: orgAId, purchaseOrderNumber: payloadB.purchaseOrderNumber },
      });
      expect(secondPo).toBeNull();
    });

    it('C. Same key across distinct tenants operates independently without collision', async () => {
      const sharedKey = `CROSS-TENANT-KEY-${Date.now()}`;
      const payloadA = {
        purchaseOrderNumber: `PO-SHARED-A-${Date.now()}`,
        supplierName: 'Supplier Org A',
        warehouseId: whA1Id,
        lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
      };

      const payloadB = {
        purchaseOrderNumber: `PO-SHARED-B-${Date.now()}`,
        supplierName: 'Supplier Org B',
        warehouseId: whBId,
        lines: [{ productId: prodBId, quantity: '2.0000', unitPrice: '20.0000' }],
      };

      // Tenant A
      const resA = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', sharedKey)
        .send(payloadA);
      expect(resA.status).toBe(201);

      // Tenant B with same key
      const resB = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId)
        .set('Idempotency-Key', sharedKey)
        .send(payloadB);
      expect(resB.status).toBe(201);

      // Both independent POs exist
      expect(resA.body.data.id).not.toBe(resB.body.data.id);
      expect(resA.body.data.organizationId).toBe(orgAId);
      expect(resB.body.data.organizationId).toBe(orgBId);
    });

    it('D. Sequential replays with identical payload consistently return 200 OK without duplicate DB rows', async () => {
      const seqKey = `SEQ-REPLAY-KEY-${Date.now()}`;
      const payload = {
        purchaseOrderNumber: `PO-SEQ-${Date.now()}`,
        supplierName: 'Seq Supplier',
        warehouseId: whA1Id,
        lines: [{ productId: prodA1Id, quantity: '3.0000', unitPrice: '15.0000' }],
      };

      // Initial creation
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', seqKey)
        .send(payload);
      expect(res1.status).toBe(201);
      const poId = res1.body.data.id;

      // Replay 1
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', seqKey)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.data.id).toBe(poId);

      // Replay 2
      const res3 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', seqKey)
        .send(payload);
      expect(res3.status).toBe(200);
      expect(res3.body.data.id).toBe(poId);

      // Replay 3
      const res4 = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', seqKey)
        .send(payload);
      expect(res4.status).toBe(200);
      expect(res4.body.data.id).toBe(poId);

      // Only 1 PO in DB
      const dbCount = await prisma.purchaseOrder.count({
        where: { organizationId: orgAId, purchaseOrderNumber: payload.purchaseOrderNumber },
      });
      expect(dbCount).toBe(1);
    });
  });

  describe('13. FOLLOW-UP 4: Tax Total Authority & Server Invariants', () => {
    it('disallows client from providing taxTotal (ValidationPipe rejects unexpected property)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-TAX-REJECT-${Date.now()}`,
          supplierName: 'Tax Supplier',
          warehouseId: whA1Id,
          taxTotal: '50.0000',
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('property taxTotal should not exist');
    });

    it('disallows client from providing grandTotal (ValidationPipe rejects unexpected property)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-GT-REJECT-${Date.now()}`,
          supplierName: 'Tax Supplier',
          warehouseId: whA1Id,
          grandTotal: '1.0000',
          lines: [{ productId: prodA1Id, quantity: '1.0000', unitPrice: '10.0000' }],
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('property grandTotal should not exist');
    });

    it('server authoritatively sets taxTotal to exactly 0.0000 and grandTotal = subtotal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          purchaseOrderNumber: `PO-TAX-AUTH-${Date.now()}`,
          supplierName: 'Tax Auth Supplier',
          warehouseId: whA1Id,
          lines: [{ productId: prodA1Id, quantity: '4.0000', unitPrice: '25.0000' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subtotal).toBe('100.0000');
      expect(res.body.data.taxTotal).toBe('0.0000');
      expect(res.body.data.grandTotal).toBe('100.0000');

      const poInDb = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(poInDb.taxTotal.toFixed(4)).toBe('0.0000');
      expect(poInDb.grandTotal.toFixed(4)).toBe('100.0000');
    });
  });

  describe('14. COMPREHENSIVE STOCK INVARIANCE FINAL AUDIT', () => {
    it('proves zero StockBalance and zero StockLedgerEntry mutations across all tests', async () => {
      // Fetch all stock balances and ledger entries globally
      const finalGlobalBalances = await prisma.stockBalance.count();
      const finalGlobalLedgers = await prisma.stockLedgerEntry.count();

      // Ensure no stock balance or stock ledger records were ever created or modified across the entire database
      expect(finalGlobalBalances).toBe(baselineStockBalances);
      expect(finalGlobalLedgers).toBe(baselineStockLedgers);

      // Verify zero stock balances or ledger entries exist for the test organizations
      const testOrgBalances = await prisma.stockBalance.count({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      const testOrgLedgers = await prisma.stockLedgerEntry.count({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      expect(testOrgBalances).toBe(0);
      expect(testOrgLedgers).toBe(0);
    });
  });
});
