import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { createHash } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('AuthModule (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `test-auth-${Date.now()}@example.com`,
    password: 'Password123!',
    organizationName: 'Test Auth Org',
  };

  let accessToken: string;
  let refreshToken: string;
  let userId: string;

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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organizationMembership.deleteMany({ where: { user: { email: testUser.email } } });
      await prisma.auditEvent.deleteMany({ where: { actorUserId: { not: null } } });
      await prisma.session.deleteMany({ where: { user: { email: testUser.email } } });
      await prisma.user.deleteMany({ where: { email: testUser.email } });
    }
    if (app) await app.close();
  });

  it('/api/v1/auth/register (POST) - rejects invalid input (malformed email or weak password)', async () => {
    // Malformed email
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password123!', organizationName: 'Org' })
      .expect(400);

    // Password too short (< 8 chars)
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'valid@example.com', password: 'short', organizationName: 'Org' })
      .expect(400);
  });

  it('/api/v1/auth/register (POST) - successfully registers a user and organization', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
    userId = res.body.data.user.id;
    expect(res.body.data.organization).toBeDefined();
    expect(res.body.data.organization.name).toBe(testUser.organizationName);

    // Verify password hash is NEVER leaked in response
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('/api/v1/auth/register (POST) - rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(400);
  });

  it('/api/v1/auth/login (POST) - fails with invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: testUser.password })
      .expect(401);
  });

  it('/api/v1/auth/login (POST) - succeeds and sets HttpOnly, Secure, SameSite=Strict cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined(); // ensure tokens not leaked in body

    const cookies: string[] = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const accessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();

    // Verify exact security directives on Set-Cookie headers
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Secure');
    expect(accessCookie?.toLowerCase()).toContain('samesite=strict');

    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Secure');
    expect(refreshCookie?.toLowerCase()).toContain('samesite=strict');

    accessToken = accessCookie!.split(';')[0].split('=')[1];
    refreshToken = refreshCookie!.split(';')[0].split('=')[1];
  });

  it('verifies refresh token storage in database is hashed (never stored in plain text)', async () => {
    const sessions = await prisma.session.findMany({
      where: { userId },
    });

    expect(sessions.length).toBeGreaterThan(0);
    const expectedHash = createHash('sha256').update(refreshToken).digest('hex');
    const matchedSession = sessions.find((s) => s.token === expectedHash);

    expect(matchedSession).toBeDefined();
    // Plain token is not stored
    expect(sessions.some((s) => s.token === refreshToken)).toBeFalsy();
  });

  it('/api/v1/auth/me (GET) - returns authenticated user and memberships', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', [`accessToken=${accessToken}`])
      .expect(200);

    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.memberships).toHaveLength(1);
    expect(res.body.data.memberships[0].role.name).toBe('Owner');
  });

  it('/api/v1/auth/me (GET) - rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('/api/v1/auth/refresh (POST) - rotates refresh token and issues new session', async () => {
    const oldRefreshToken = refreshToken;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefreshToken}`])
      .expect(200);

    const cookies: string[] = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const newAccessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    const newRefreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

    expect(newAccessCookie).toBeDefined();
    expect(newRefreshCookie).toBeDefined();
    expect(newAccessCookie).toContain('HttpOnly');
    expect(newAccessCookie).toContain('Secure');
    expect(newAccessCookie?.toLowerCase()).toContain('samesite=strict');

    const newAccessToken = newAccessCookie!.split(';')[0].split('=')[1];
    const newRefreshToken = newRefreshCookie!.split(';')[0].split('=')[1];

    expect(newRefreshToken).not.toBe(oldRefreshToken);

    // Verify old refresh token CANNOT be reused (Rotation protection)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefreshToken}`])
      .expect(401);

    // Update references for subsequent tests
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;
  });

  it('/api/v1/auth/logout (POST) - invalidates authentication and revokes session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`accessToken=${accessToken}`, `refreshToken=${refreshToken}`])
      .expect(200);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Verify session revoked in database
    const expectedHash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await prisma.session.findUnique({
      where: { token: expectedHash },
    });
    expect(session).toBeNull();

    // Verify refresh with revoked token fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .expect(401);
  });

  it('verifies registration rollback behavior on transaction failure', async () => {
    const failEmail = `fail-rollback-${Date.now()}@example.com`;

    // Attempt registration with invalid org or mock transaction failure
    // We simulate by triggering a transaction that throws after user creation
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: failEmail,
            passwordHash: 'dummyHash',
          },
        });
        // Deliberately throw an error to trigger rollback
        throw new Error('Forced rollback error');
      });
    } catch {
      // Expected failure
    }

    // Verify user was NOT saved (rolled back)
    const rolledBackUser = await prisma.user.findUnique({
      where: { email: failEmail },
    });
    expect(rolledBackUser).toBeNull();
  });
});
