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

describe('Phase 5F — Stock Security & Adversarial QA Suite (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `sec-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `sec-owner-b-${timestamp}@test.com`, password: 'Password123!' };
  const unprivilegedUserA = {
    email: `sec-unpriv-a-${timestamp}@test.com`,
    password: 'Password123!',
  };
  const readerUserA = { email: `sec-reader-a-${timestamp}@test.com`, password: 'Password123!' };
  const mutatorUserA = { email: `sec-mutator-a-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;

  let tokenB: string;
  let orgBId: string;

  let tokenUnprivA: string;
  let tokenReaderA: string;
  let tokenMutatorA: string;

  let prodA1Id: string;
  let whA1Id: string;
  let balanceA1Id: string;
  let ledgerA1Id: string;

  let prodB1Id: string;
  let whB1Id: string;
  let balanceB1Id: string;
  let ledgerB1Id: string;

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
      .send({ ...ownerUserA, organizationName: `Security Org A ${timestamp}` });
    orgAId = resA.body.data.organization.id;
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserA);
    tokenA = loginA.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 2. Setup Org B and Owner B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...ownerUserB, organizationName: `Security Org B ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure stock permissions exist
    const readPerm = await prisma.permission.findFirst({ where: { action: 'stock.read' } });
    const mutatePerm = await prisma.permission.findFirst({ where: { action: 'stock.mutate' } });

    // 4. Setup unprivileged user in Org A (no stock permissions)
    const unprivRole = await prisma.role.create({
      data: { name: `SecUnpriv_${timestamp}`, description: 'No permissions' },
    });
    const regUnpriv = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...unprivilegedUserA, organizationName: `Unpriv Org ${timestamp}` });
    const unprivUserId = regUnpriv.body.data.user.id;
    await prisma.organizationMembership.create({
      data: { userId: unprivUserId, organizationId: orgAId, roleId: unprivRole.id },
    });
    const loginUnpriv = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(unprivilegedUserA);
    tokenUnprivA = loginUnpriv.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 5. Setup Reader-only user in Org A
    const readerRole = await prisma.role.create({
      data: { name: `SecReader_${timestamp}`, description: 'Reader only' },
    });
    if (readPerm) {
      await prisma.rolePermission.create({
        data: { roleId: readerRole.id, permissionId: readPerm.id },
      });
    }
    const regReader = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...readerUserA, organizationName: `Reader Org ${timestamp}` });
    const readerUserId = regReader.body.data.user.id;
    await prisma.organizationMembership.create({
      data: { userId: readerUserId, organizationId: orgAId, roleId: readerRole.id },
    });
    const loginReader = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(readerUserA);
    tokenReaderA = loginReader.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 6. Setup Mutator-only user in Org A
    const mutatorRole = await prisma.role.create({
      data: { name: `SecMutator_${timestamp}`, description: 'Mutator only' },
    });
    if (mutatePerm) {
      await prisma.rolePermission.create({
        data: { roleId: mutatorRole.id, permissionId: mutatePerm.id },
      });
    }
    const regMutator = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...mutatorUserA, organizationName: `Mutator Org ${timestamp}` });
    const mutatorUserId = regMutator.body.data.user.id;
    await prisma.organizationMembership.create({
      data: { userId: mutatorUserId, organizationId: orgAId, roleId: mutatorRole.id },
    });
    const loginMutator = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(mutatorUserA);
    tokenMutatorA = loginMutator.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 7. Setup Categories, Products, Warehouses
    const catA = await prisma.category.create({
      data: { organizationId: orgAId, name: `Sec Cat A ${timestamp}` },
    });
    const catB = await prisma.category.create({
      data: { organizationId: orgBId, name: `Sec Cat B ${timestamp}` },
    });

    const prodA1 = await prisma.product.create({
      data: {
        organizationId: orgAId,
        categoryId: catA.id,
        name: `Sec Prod A1 ${timestamp}`,
        sku: `SKU-SEC-A1-${timestamp}`,
      },
    });
    prodA1Id = prodA1.id;

    const whA1 = await prisma.warehouse.create({
      data: {
        organizationId: orgAId,
        name: `Sec WH A1 ${timestamp}`,
        code: `WH-SEC-A1-${timestamp}`,
      },
    });
    whA1Id = whA1.id;

    const prodB1 = await prisma.product.create({
      data: {
        organizationId: orgBId,
        categoryId: catB.id,
        name: `Sec Prod B1 ${timestamp}`,
        sku: `SKU-SEC-B1-${timestamp}`,
      },
    });
    prodB1Id = prodB1.id;

    const whB1 = await prisma.warehouse.create({
      data: {
        organizationId: orgBId,
        name: `Sec WH B1 ${timestamp}`,
        code: `WH-SEC-B1-${timestamp}`,
      },
    });
    whB1Id = whB1.id;

    // 8. Create baseline stock in Org A and Org B
    const mutResA = await request(app.getHttpServer())
      .post('/api/v1/stock/mutations')
      .set('Cookie', `accessToken=${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({
        productId: prodA1Id,
        warehouseId: whA1Id,
        type: 'OPENING',
        quantityDelta: '100.0000',
        referenceType: 'INIT',
        referenceId: 'INIT-A1',
      });
    expect(mutResA.status).toBe(201);
    balanceA1Id = mutResA.body.data.balance.id;
    ledgerA1Id = mutResA.body.data.ledgerEntry.id;

    const mutResB = await request(app.getHttpServer())
      .post('/api/v1/stock/mutations')
      .set('Cookie', `accessToken=${tokenB}`)
      .set('x-organization-id', orgBId)
      .send({
        productId: prodB1Id,
        warehouseId: whB1Id,
        type: 'OPENING',
        quantityDelta: '200.0000',
        referenceType: 'INIT',
        referenceId: 'INIT-B1',
      });
    expect(mutResB.status).toBe(201);
    balanceB1Id = mutResB.body.data.balance.id;
    ledgerB1Id = mutResB.body.data.ledgerEntry.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Tenant Isolation & Header Spoofing Attacks', () => {
    it('User A cannot read Org B stock balance by ID (returns 404, not 403, preventing resource enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/${balanceB1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('STOCK_BALANCE_NOT_FOUND');
    });

    it('User B cannot read Org A stock balance by ID (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/${balanceA1Id}`)
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('STOCK_BALANCE_NOT_FOUND');
    });

    it('User A cannot read Org B ledger entry by ID (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/ledger/${ledgerB1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('User B cannot read Org A ledger entry by ID (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/ledger/${ledgerA1Id}`)
        .set('Cookie', `accessToken=${tokenB}`)
        .set('x-organization-id', orgBId);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('User A cannot mutate stock for Org B product and warehouse from Org A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodB1Id,
          warehouseId: whB1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('User A cannot mutate stock in Org A referencing Org B product', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodB1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('User A cannot mutate stock in Org A referencing Org B warehouse', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whB1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
    });

    it('HEADER SPOOFING: User A sending x-organization-id: orgBId is denied (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgBId);

      expect(res.status).toBe(403);
    });

    it('Malformed x-organization-id header is rejected cleanly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', 'not-a-valid-uuid-12345');

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('2. IDOR & Path Manipulation Attacks', () => {
    it('Random non-existent UUIDv4 on GET /stock/balances/:id returns 404 without leaking internal state', async () => {
      const nonExistent = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/balances/${nonExistent}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('STOCK_BALANCE_NOT_FOUND');
    });

    it('Malformed balance ID returns 400 Bad Request via ParseUUIDPipe', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances/malformed-balance-id-12345')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('uuid v 4 is expected');
    });

    it('Path traversal attempts are neutralized cleanly (returns 400 or 404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect([400, 404]).toContain(res.status);
    });

    it('Random non-existent UUIDv4 on GET /stock/ledger/:id returns 404', async () => {
      const nonExistent = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/stock/ledger/${nonExistent}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });

    it('Malformed ledger ID returns 400 Bad Request via ParseUUIDPipe', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/ledger/malformed-id-999')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });
  });

  describe('3. Server-Side RBAC & Authentication Attacks', () => {
    it('Unauthenticated requests to /stock/balances return 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(401);
    });

    it('Invalid JWT token returns 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', 'accessToken=invalid.jwt.token')
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(401);
    });

    it('User with no stock permissions is denied on GET /stock/balances (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', `accessToken=${tokenUnprivA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(403);
    });

    it('User with no stock permissions is denied on POST /stock/mutations (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenUnprivA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });

      expect(res.status).toBe(403);
    });

    it('Reader-only user can access GET /stock/balances (200) but denied on POST /stock/mutations (403)', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', `accessToken=${tokenReaderA}`)
        .set('x-organization-id', orgAId);
      expect(getRes.status).toBe(200);

      const postRes = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenReaderA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '10.0000',
        });
      expect(postRes.status).toBe(403);
    });

    it('Mutator-only user can execute POST /stock/mutations (201) but denied on GET /stock/balances (403)', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/stock/balances')
        .set('Cookie', `accessToken=${tokenMutatorA}`)
        .set('x-organization-id', orgAId);
      expect(getRes.status).toBe(403);

      const postRes = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenMutatorA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '5.0000',
        });
      expect(postRes.status).toBe(201);
    });
  });

  describe('4. Mass Assignment Attacks on POST /stock/mutations', () => {
    it('Rejects unknown arbitrary fields (400 forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '1.0000',
          maliciousField: 'hacked',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('property maliciousField should not exist');
    });

    it('Rejects injected server-authoritative fields (organizationId, quantityBefore, quantityAfter)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '1.0000',
          organizationId: orgBId,
          quantityBefore: '9999.0000',
          quantityAfter: '9999.0000',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('5. Numeric JSON & Precision Abuse Attacks', () => {
    it('Rejects numeric quantityDelta (strict exact string required)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: 25, // numeric, not string
        });

      expect(res.status).toBe(400);
    });

    it('Rejects quantityDelta exceeding 4 decimal places (scale abuse)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '1.12345',
        });

      expect(res.status).toBe(400);
    });

    it('Rejects zero quantityDelta ("0.0000")', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stock/mutations')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          productId: prodA1Id,
          warehouseId: whA1Id,
          type: 'RECEIPT',
          quantityDelta: '0.0000',
        });

      expect(res.status).toBe(400);
    });

    it('Rejects non-numeric strings ("NaN", "Infinity", "1e5")', async () => {
      for (const badValue of ['NaN', 'Infinity', '1e5', '0x12', 'invalid']) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/stock/mutations')
          .set('Cookie', `accessToken=${tokenA}`)
          .set('x-organization-id', orgAId)
          .send({
            productId: prodA1Id,
            warehouseId: whA1Id,
            type: 'RECEIPT',
            quantityDelta: badValue,
          });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('6. SQL Injection & Query Parameter Abuse', () => {
    it('SQL injection in productId query is rejected by UUID validator (400)', async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/stock/balances?productId=' OR 1=1 --")
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });

    it('SQL injection in warehouseId query is rejected by UUID validator (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?warehouseId="; DROP TABLE "StockBalance"; --')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });

    it('Arbitrary or dangerous sort fields are rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?sortBy=__proto__')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });

    it('SQL injection in ledger sortBy query is rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/stock/ledger?sortBy=' OR 1=1 --")
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });
  });

  describe('7. Pagination Abuse Attacks', () => {
    it('Rejects page=0 and page=-1', async () => {
      const resZero = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?page=0')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(resZero.status).toBe(400);

      const resNeg = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?page=-5')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(resNeg.status).toBe(400);
    });

    it('Rejects limit=0 and limit=-1', async () => {
      const resZero = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?limit=0')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(resZero.status).toBe(400);

      const resNeg = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?limit=-10')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);
      expect(resNeg.status).toBe(400);
    });

    it('Rejects excessive limit (limit=999999999)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances?limit=999999999')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(400);
    });
  });

  describe('8. Ledger Immutability Attacks', () => {
    it('PUT /stock/ledger is not exposed (404)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/stock/ledger')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ id: ledgerA1Id, quantityDelta: '999.0000' });

      expect(res.status).toBe(404);
    });

    it('DELETE /stock/ledger/:id is not exposed (404)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/stock/ledger/${ledgerA1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.status).toBe(404);
    });

    it('PATCH /stock/ledger/:id is not exposed (404)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/stock/ledger/${ledgerA1Id}`)
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId)
        .send({ notes: 'altered' });

      expect(res.status).toBe(404);
    });
  });

  describe('9. Error Leakage Sanitization', () => {
    it('Sanitizes error responses and does not leak database URLs or stack traces', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stock/balances/non-existent-balance-uuid')
        .set('Cookie', `accessToken=${tokenA}`)
        .set('x-organization-id', orgAId);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error).toHaveProperty('requestId');

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('postgres://');
      expect(bodyStr).not.toContain('postgresql://');
      expect(bodyStr).not.toContain('DATABASE_URL');
      expect(bodyStr).not.toContain('node_modules');
    });
  });
});
