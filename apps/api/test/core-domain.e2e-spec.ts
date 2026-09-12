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

describe('Core Domain Foundation (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `core-domain-${Date.now()}@example.com`,
    password: 'Password123!',
    organizationName: 'Core Domain Org',
  };

  let accessToken: string;
  let orgId: string;

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

    // Register test user and org
    const regRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);

    orgId = regRes.body.data.organization.id;

    // Login to obtain accessToken
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    const cookies: string[] = loginRes.headers['set-cookie'];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    accessToken = accessCookie!.split(';')[0].split('=')[1];
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organizationMembership.deleteMany({
        where: { user: { email: testUser.email } },
      });
      await prisma.auditEvent.deleteMany({ where: { actorUserId: { not: null } } });
      await prisma.session.deleteMany({ where: { user: { email: testUser.email } } });
      await prisma.user.deleteMany({ where: { email: testUser.email } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (app) await app.close();
  });

  describe('API Envelope & Correlation ID Propagation', () => {
    it('should format successful responses into standard data envelope with meta.requestId', async () => {
      const customRequestId = 'req-custom-uuid-12345';
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', [`accessToken=${accessToken}`])
        .set('x-request-id', customRequestId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.requestId).toBe(customRequestId);
      expect(res.headers['x-request-id']).toBe(customRequestId);
    });

    it('should format error responses into standard error envelope with error.requestId', async () => {
      const customRequestId = 'req-error-uuid-98765';
      const res = await request(app.getHttpServer())
        .get('/api/v1/invalid-route-nonexistent')
        .set('x-request-id', customRequestId)
        .expect(404);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.requestId).toBe(customRequestId);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('Validation & Boundary Enforcement', () => {
    it('should reject unknown/whitelisted DTO properties with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          injectedUnknownField: 'malicious',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('property injectedUnknownField should not exist');
    });

    it('should reject invalid route parameters gracefully without exposing internal errors', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations/malformed-id-not-uuid')
        .set('Cookie', [`accessToken=${accessToken}`])
        .set('x-organization-id', orgId)
        .expect(403); // Cross-org mismatch or forbidden

      expect(res.body.error).toBeDefined();
      expect(res.body.error.requestId).toBeDefined();
      // Never expose Prisma or database stack trace in response
      expect(JSON.stringify(res.body)).not.toContain('prisma');
      expect(JSON.stringify(res.body)).not.toContain('stack');
    });
  });

  describe('Tenant Scoping & IDOR Prevention', () => {
    it('should deny access if x-organization-id does not match user active organization', async () => {
      const foreignOrgId = '00000000-0000-0000-0000-000000000001';
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${foreignOrgId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .set('x-organization-id', foreignOrgId)
        .expect(403);
    });

    it('should deny cross-tenant parameter manipulation (header != route param)', async () => {
      const randomOrgId = '00000000-0000-0000-0000-000000000002';
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${randomOrgId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .set('x-organization-id', orgId) // Legitimate org header, but accessing different org route
        .expect(403);
    });
  });
});
