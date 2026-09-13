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

describe('Clean Registration to Business Journey (e2e)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = {
    email: `owner-journey-${Date.now()}@example.com`,
    password: 'Password123!',
    organizationName: `Journey Org ${Date.now()}`,
  };

  const userB = {
    email: `isolated-journey-${Date.now()}@example.com`,
    password: 'Password123!',
    organizationName: `Isolated Org ${Date.now()}`,
  };

  let orgAId: string;
  let orgBId: string;
  let userAAccessToken: string;
  let userARefreshToken: string;
  let createdWarehouseId: string;

  beforeAll(async () => {
    process.env.COOKIE_SECURE = 'false';
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
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data
      await prisma.warehouse.deleteMany({
        where: { organization: { slug: { contains: 'journey' } } },
      });
      await prisma.organizationMembership.deleteMany({
        where: { user: { email: { in: [userA.email, userB.email] } } },
      });
      await prisma.auditEvent.deleteMany({
        where: { organization: { slug: { contains: 'journey' } } },
      });
      await prisma.session.deleteMany({
        where: { user: { email: { in: [userA.email, userB.email] } } },
      });
      await prisma.organization.deleteMany({
        where: { slug: { contains: 'journey' } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [userA.email, userB.email] } },
      });
    }
    if (app) await app.close();
  });

  it('Step 1 & 2: Register user and obtain authenticated session (NO manual RolePermission seeding)', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userA)
      .expect(201);

    expect(regRes.body.data.user).toBeDefined();
    expect(regRes.body.data.organization).toBeDefined();
    orgAId = regRes.body.data.organization.id;

    // Login to get cookies
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();

    const accessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();

    userAAccessToken = accessCookie!.split(';')[0]!.split('=')[1]!;
    userARefreshToken = refreshCookie!.split(';')[0]!.split('=')[1]!;
  });

  it('Step 3, 4 & 5: Owner immediately has permissions to read & create business resources', async () => {
    // 3 & 4. Verify warehouse.read permission works on GET /api/v1/warehouses
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/warehouses')
      .set('Cookie', [`accessToken=${userAAccessToken}`])
      .set('x-organization-id', orgAId)
      .expect(200);

    expect(listRes.body.data).toBeInstanceOf(Array);

    // 5. Create a legitimate business resource (Warehouse) with warehouse.create
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [`accessToken=${userAAccessToken}`])
      .set('x-organization-id', orgAId)
      .send({
        name: 'Primary Regional Distribution Center',
        code: `WH-REG-${Date.now().toString().slice(-4)}`,
        description: 'Main automated warehouse',
      })
      .expect(201);

    expect(createRes.body.data.id).toBeDefined();
    expect(createRes.body.data.name).toBe('Primary Regional Distribution Center');
    createdWarehouseId = createRes.body.data.id;

    // Verify reading the created resource
    const readOne = await request(app.getHttpServer())
      .get(`/api/v1/warehouses/${createdWarehouseId}`)
      .set('Cookie', [`accessToken=${userAAccessToken}`])
      .set('x-organization-id', orgAId)
      .expect(200);

    expect(readOne.body.data.id).toBe(createdWarehouseId);
  });

  it('Step 6 & 7: Verify tenant isolation (Org B cannot read or mutate Org A resources)', async () => {
    // Register second tenant User B
    const regResB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userB)
      .expect(201);
    orgBId = regResB.body.data.organization.id;

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userB.email, password: userB.password })
      .expect(200);

    const cookiesB = loginResB.headers['set-cookie'] as unknown as string[];
    const userBAccessToken = cookiesB
      .find((c: string) => c.startsWith('accessToken='))!
      .split(';')[0]!
      .split('=')[1]!;

    // User B trying to access Org A's warehouse with Org A header -> Forbidden (no membership)
    await request(app.getHttpServer())
      .get(`/api/v1/warehouses/${createdWarehouseId}`)
      .set('Cookie', [`accessToken=${userBAccessToken}`])
      .set('x-organization-id', orgAId)
      .expect(403);

    // User B trying to access Org A's warehouse with Org B header -> 404 (IDOR protection)
    await request(app.getHttpServer())
      .get(`/api/v1/warehouses/${createdWarehouseId}`)
      .set('Cookie', [`accessToken=${userBAccessToken}`])
      .set('x-organization-id', orgBId)
      .expect(404);
  });

  it('Step 8: Logout clears session correctly', async () => {
    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`accessToken=${userAAccessToken}`, `refreshToken=${userARefreshToken}`])
      .expect(200);

    const cookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c: string) => c.includes('accessToken=;'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('refreshToken=;'))).toBe(true);

    // Using the invalidated refresh token must fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refreshToken=${userARefreshToken}`])
      .expect(401);
  });

  it('Step 9, 10 & 11: Login again, refresh session, and continue business operations', async () => {
    // 9. Login again
    const loginAgain = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password })
      .expect(200);

    const cookies = loginAgain.headers['set-cookie'] as unknown as string[];
    const newRefresh = cookies
      .find((c: string) => c.startsWith('refreshToken='))!
      .split(';')[0]!
      .split('=')[1]!;

    // 10. Refresh session
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refreshToken=${newRefresh}`])
      .expect(200);

    const refreshedCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const freshAccessToken = refreshedCookies
      .find((c: string) => c.startsWith('accessToken='))!
      .split(';')[0]!
      .split('=')[1]!;

    // 11. Continue using protected endpoint with the fresh token
    const listAgain = await request(app.getHttpServer())
      .get('/api/v1/warehouses')
      .set('Cookie', [`accessToken=${freshAccessToken}`])
      .set('x-organization-id', orgAId)
      .expect(200);

    expect(listAgain.body.data.some((w: { id: string }) => w.id === createdWarehouseId)).toBe(true);
  });
});
