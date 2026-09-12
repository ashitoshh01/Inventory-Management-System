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

describe('Stock REST API (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `stock-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `stock-owner-b-${timestamp}@test.com`, password: 'Password123!' };
  const viewerUserA = { email: `stock-viewer-a-${timestamp}@test.com`, password: 'Password123!' };
  const mutatorOnlyUserA = {
    email: `stock-mutator-a-${timestamp}@test.com`,
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

  let tokenMutatorA: string;
  let mutatorUserId: string;

  let prodA1Id: string;
  let prodA2Id: string;
  let whA1Id: string;
  let whA2Id: string;

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

    // 1. Setup Org A and Owner A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserA, organizationName: `Stock Org A ${timestamp}` });
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
      .send({ ...ownerUserB, organizationName: `Stock Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure stock permissions exist and assign to Owner role
    const stockPerms = ['stock.read', 'stock.mutate'];
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of stockPerms) {
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY stock.read
    let viewerRole = await prisma.role.findFirst({ where: { name: `StockViewer_${timestamp}` } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: { name: `StockViewer_${timestamp}`, description: 'Read-only stock viewer' },
      });
    }
    const readPerm = await prisma.permission.findFirst({ where: { action: 'stock.read' } });
    if (readPerm) {
      await prisma.rolePermission.create({
        data: { roleId: viewerRole.id, permissionId: readPerm.id },
      });
    }

    const regViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...viewerUserA, organizationName: `Viewer Org ${timestamp}` });
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

    // 5. Setup Mutator-Only User in Org A with ONLY stock.mutate (no stock.read)
    let mutatorRole = await prisma.role.findFirst({ where: { name: `StockMutator_${timestamp}` } });
    if (!mutatorRole) {
      mutatorRole = await prisma.role.create({
        data: { name: `StockMutator_${timestamp}`, description: 'Mutator only stock user' },
      });
    }
    const mutatePerm = await prisma.permission.findFirst({ where: { action: 'stock.mutate' } });
    if (mutatePerm) {
      await prisma.rolePermission.create({
        data: { roleId: mutatorRole.id, permissionId: mutatePerm.id },
      });
    }

    const regMutator = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...mutatorOnlyUserA, organizationName: `Mutator Org ${timestamp}` });
    mutatorUserId = regMutator.body.data.user.id;

    await prisma.organizationMembership.create({
      data: {
        userId: mutatorUserId,
        organizationId: orgAId,
        roleId: mutatorRole.id,
      },
    });

    const loginMutator = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(mutatorOnlyUserA);
    tokenMutatorA = loginMutator.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 6. Setup Category, Products, Warehouses in Org A and Org B
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Stock Cat A ${timestamp}` },
    });
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `Stock Cat B ${timestamp}` },
    });

    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Prod A1 ${timestamp}`,
        sku: `SKU-A1-${timestamp}`,
      },
    });
    prodA1Id = prodA1.id;

    const prodA2 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Prod A2 ${timestamp}`,
        sku: `SKU-A2-${timestamp}`,
      },
    });
    prodA2Id = prodA2.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A1 ${timestamp}`,
        code: `WH-A1-${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const whA2 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Warehouse A2 ${timestamp}`,
        code: `WH-A2-${timestamp}`,
      },
    });
    whA2Id = whA2.id;

    const prodB = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        name: `Prod B1 ${timestamp}`,
        sku: `SKU-B1-${timestamp}`,
      },
    });
    prodBId = prodB.id;

    const whB = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `Warehouse B1 ${timestamp}`,
        code: `WH-B1-${timestamp}`,
      },
    });
    whBId = whB.id;
  });

  afterAll(async () => {
    if (prisma) {
      const allOrgIds = [orgAId, orgBId].filter(Boolean);
      const allUserIds = [userAId, userBId, viewerUserId, mutatorUserId].filter(Boolean);

      if (allOrgIds.length > 0) {
        await prisma.stockLedgerEntry.deleteMany({ where: { organizationId: { in: allOrgIds } } });
        await prisma.stockBalance.deleteMany({ where: { organizationId: { in: allOrgIds } } });
        await prisma.auditEvent.deleteMany({ where: { organizationId: { in: allOrgIds } } });
        await prisma.product.deleteMany({ where: { organizationId: { in: allOrgIds } } });
        await prisma.warehouse.deleteMany({ where: { organizationId: { in: allOrgIds } } });
        await prisma.category.deleteMany({ where: { organizationId: { in: allOrgIds } } });
      }

      if (allUserIds.length > 0) {
        await prisma.organizationMembership.deleteMany({ where: { userId: { in: allUserIds } } });
        await prisma.session.deleteMany({ where: { userId: { in: allUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
      }

      if (allOrgIds.length > 0) {
        await prisma.organization.deleteMany({ where: { id: { in: allOrgIds } } });
      }

      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Authentication (401)', () => {
    it('rejects unauthenticated GET /stock/balances with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/stock/balances');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET /stock/ledger with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/stock/ledger');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated POST /stock/mutations with 401', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/stock/mutations').send({
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('2. Authorization & RBAC (403)', () => {
    it('rejects read request if user lacks stock.read permission', async () => {
      // mutatorOnlyUser has stock.mutate but NOT stock.read
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', [`accessToken=${tokenMutatorA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Missing required permissions: stock.read/i);
    });

    it('rejects mutation request if user lacks stock.mutate permission', async () => {
      // viewerUser has stock.read but NOT stock.mutate
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Missing required permissions: stock.mutate/i);
    });

    it('rejects cross-tenant organization spoofing via x-organization-id with 403', async () => {
      // User A trying to claim Org B
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgBId);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Core Stock Mutation Lifecycle (OPENING, RECEIPT, ISSUE, ADJUSTMENT)', () => {
    it('executes OPENING mutation (0 -> 100.0000) and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'OPENING',
          quantityDelta: '100.0000',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('100.0000');
      expect(res.body.data.ledgerEntry.quantityBefore).toBe('0.0000');
      expect(res.body.data.ledgerEntry.quantityDelta).toBe('100.0000');
      expect(res.body.data.ledgerEntry.quantityAfter).toBe('100.0000');
      expect(res.body.data.ledgerEntry.type).toBe('OPENING');
      expect(res.body.data.isIdempotentReplay).toBe(false);

      // Verify PostgreSQL database record
      const dbBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(dbBalance?.quantity.toFixed(4)).toBe('100.0000');
    });

    it('executes RECEIPT mutation (100 -> 125.0000) and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '25.0000',
          referenceType: 'PO',
          referenceId: 'PO-1001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('125.0000');
      expect(res.body.data.ledgerEntry.quantityBefore).toBe('100.0000');
      expect(res.body.data.ledgerEntry.quantityDelta).toBe('25.0000');
      expect(res.body.data.ledgerEntry.quantityAfter).toBe('125.0000');
      expect(res.body.data.ledgerEntry.type).toBe('RECEIPT');
    });

    it('executes ISSUE mutation (125 -> 95.0000) and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-30.0000',
          referenceType: 'SO',
          referenceId: 'SO-2002',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('95.0000');
      expect(res.body.data.ledgerEntry.quantityBefore).toBe('125.0000');
      expect(res.body.data.ledgerEntry.quantityDelta).toBe('-30.0000');
      expect(res.body.data.ledgerEntry.quantityAfter).toBe('95.0000');
      expect(res.body.data.ledgerEntry.type).toBe('ISSUE');
    });

    it('executes ADJUSTMENT mutation (95 -> 100.0000) and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'ADJUSTMENT',
          quantityDelta: '5.0000',
          metadata: { reason: 'Inventory count adjustment' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('100.0000');
      expect(res.body.data.ledgerEntry.quantityBefore).toBe('95.0000');
      expect(res.body.data.ledgerEntry.quantityDelta).toBe('5.0000');
      expect(res.body.data.ledgerEntry.quantityAfter).toBe('100.0000');
      expect(res.body.data.ledgerEntry.type).toBe('ADJUSTMENT');
    });

    it('rejects negative stock attempt with 409 Conflict (STOCK_INSUFFICIENT_QUANTITY)', async () => {
      // Balance is 100.0000. Attempting to issue -150.0000.
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'ISSUE',
          quantityDelta: '-150.0000',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STOCK_INSUFFICIENT_QUANTITY');

      // Verify balance was unchanged
      const dbBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA1Id,
            warehouseId: whA1Id,
          },
        },
      });
      expect(dbBalance?.quantity.toFixed(4)).toBe('100.0000');
    });
  });

  describe('4. Idempotency Contract', () => {
    const idempKey = `IDEMP-HTTP-${timestamp}`;

    it('creates initial mutation with 201 Created', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idempKey)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '20.0000',
          idempotencyKey: idempKey,
          referenceType: 'PO',
          referenceId: 'PO-IDEMP',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('120.0000');
      expect(res.body.data.isIdempotentReplay).toBe(false);
    });

    it('replays identical mutation and returns 200 OK without creating new ledger entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idempKey)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '20.0000',
          idempotencyKey: idempKey,
          referenceType: 'PO',
          referenceId: 'PO-IDEMP',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.balance.quantity).toBe('120.0000');
      expect(res.body.data.isIdempotentReplay).toBe(true);

      // Verify strictly 1 ledger entry exists with this idempotency key
      const count = await prisma.stockLedgerEntry.count({
        where: { organizationId: orgAId, idempotencyKey: idempKey },
      });
      expect(count).toBe(1);
    });

    it('rejects same idempotency key with different payload with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', idempKey)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '30.0000', // Changed from 20.0000
          idempotencyKey: idempKey,
          referenceType: 'PO',
          referenceId: 'PO-IDEMP',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STOCK_IDEMPOTENCY_CONFLICT');
    });

    it('rejects mismatch between header and body idempotency keys with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('Idempotency-Key', 'KEY-IN-HEADER')
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
          idempotencyKey: 'KEY-IN-BODY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/do not match/i);
    });

    it('allows Org B to use the exact same idempotency key independently', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .set('Idempotency-Key', idempKey)
        .send({
          productId: prodBId,
          warehouseId: whBId,
          type: 'OPENING',
          quantityDelta: '50.0000',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.quantity).toBe('50.0000');
    });
  });

  describe('5. Concurrency E2E (Real HTTP Requests)', () => {
    it('handles concurrent ISSUE requests without race conditions or lost updates', async () => {
      // First initialize balance for prodA2 to 100.0000
      await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA2Id,
          warehouseId: whA2Id,
          type: 'OPENING',
          quantityDelta: '100.0000',
        });

      // Dispatch two concurrent HTTP ISSUE requests: -30.0000 and -50.0000
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/stock/mutations')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({
            productId: prodA2Id,
            warehouseId: whA2Id,
            type: 'ISSUE',
            quantityDelta: '-30.0000',
          }),
        request(app.getHttpServer())
          .post('/api/v1/stock/mutations')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({
            productId: prodA2Id,
            warehouseId: whA2Id,
            type: 'ISSUE',
            quantityDelta: '-50.0000',
          }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Verify PostgreSQL final balance: 100 - 30 - 50 = 20.0000
      const finalBalance = await prisma.stockBalance.findUnique({
        where: {
          organizationId_productId_warehouseId: {
            organizationId: orgAId,
            productId: prodA2Id,
            warehouseId: whA2Id,
          },
        },
      });
      expect(finalBalance?.quantity.toFixed(4)).toBe('20.0000');

      // Verify ledger entries count: 1 OPENING + 2 ISSUEs = 3
      const entries = await prisma.stockLedgerEntry.findMany({
        where: { organizationId: orgAId, productId: prodA2Id, warehouseId: whA2Id },
      });
      expect(entries.length).toBe(3);
    });
  });

  describe('6. Tenant Isolation (IDOR)', () => {
    it('prevents Org A from reading Org B balance by balance ID (returns 404)', async () => {
      // Get Org B's balance
      const bBalance = await prisma.stockBalance.findFirst({
        where: { organizationId: orgBId },
      });
      expect(bBalance).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/${bBalance!.id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });

    it('prevents Org A from mutating Org B product (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodBId, // Org B's product
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('prevents Org A from querying balances for Org B product (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/product/${prodBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });

    it('prevents Org A from querying balances for Org B warehouse (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/warehouse/${whBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });

    it('prevents Org A from reading Org B ledger entry by ID (returns 404)', async () => {
      const bLedger = await prisma.stockLedgerEntry.findFirst({
        where: { organizationId: orgBId },
      });
      expect(bLedger).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/ledger/${bLedger!.id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });
  });

  describe('7. Pagination, Filtering, and Sorting', () => {
    it('supports pagination on GET /stock/balances', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?page=1&limit=1')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.hasNextPage).toBe(true);
    });

    it('filters balances by productId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances?productId=${prodA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.productId).toBe(prodA1Id);
      }
    });

    it('filters ledger entries by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/ledger?type=RECEIPT')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const entry of res.body.data) {
        expect(entry.type).toBe('RECEIPT');
      }
    });

    it('sorts ledger entries by quantityDelta asc and desc', async () => {
      const resAsc = await request(app.getHttpServer())
        .get('/api/v1/stock/ledger?sortBy=quantityDelta&sortOrder=asc')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(resAsc.status).toBe(200);
      const deltas = resAsc.body.data.map((e: { quantityDelta: string }) =>
        parseFloat(e.quantityDelta),
      );
      for (let i = 1; i < deltas.length; i++) {
        expect(deltas[i]).toBeGreaterThanOrEqual(deltas[i - 1]);
      }
    });

    it('rejects malicious sortBy field with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/ledger?sortBy=malicious;DROP TABLE "StockBalance"')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });
  });

  describe('8. Validation & Mass Assignment', () => {
    it('rejects quantityDelta sent as a number with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: 10.5, // Number instead of string
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/quantityDelta must be a string/i);
    });

    it('rejects quantityDelta with 5 decimal places with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/at most 4 decimal places/i);
    });

    it('rejects zero quantityDelta with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '0.0000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/non-zero/i);
    });

    it('rejects mass-assignment attempts of server-controlled fields with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
          organizationId: orgBId,
          actorId: 'spoofed-user',
          quantityBefore: '9999.0000',
          quantityAfter: '9999.0000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/should not exist/i);
    });
  });

  describe('9. Audit Trail', () => {
    it('creates tenant-scoped AuditEvent on successful stock mutation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '1.0000',
        });

      expect(res.status).toBe(201);

      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'stock.mutated',
          entityType: 'StockBalance',
          entityId: res.body.data.balance.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
    });
  });
});
