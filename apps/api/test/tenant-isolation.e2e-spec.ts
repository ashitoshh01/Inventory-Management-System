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

describe('Tenant Isolation (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: `usera-${Date.now()}@test.com`, password: 'Password123!' };
  const userB = { email: `userb-${Date.now()}@test.com`, password: 'Password123!' };

  let userAToken: string;
  let orgAId: string;
  let orgBId: string;

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

    // Setup User A & Org A
    const resA = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ ...userA, organizationName: 'Org A' });
    orgAId = resA.body.data.organization.id;
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send(userA);
    userAToken = loginA.headers['set-cookie'].find((c: string) => c.startsWith('accessToken=')).split(';')[0].split('=')[1];

    // Setup User B & Org B
    const resB = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ ...userB, organizationName: 'Org B' });
    orgBId = resB.body.data.organization.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organizationMembership.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
      await prisma.auditEvent.deleteMany({});
      await prisma.session.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
      await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    }
    if (app) await app.close();
  });

  it('User A can access Org A', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Cookie', [`accessToken=${userAToken}`])
      .set('x-organization-id', orgAId)
      .expect(200);
  });

  it('User A cannot access Org B (Tenant Isolation / IDOR Prevention)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}`)
      .set('Cookie', [`accessToken=${userAToken}`])
      .set('x-organization-id', orgBId)
      .expect(403);
  });

  it('User A is rejected if x-organization-id is missing', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Cookie', [`accessToken=${userAToken}`])
      .expect(400);
  });

  it('Suspended membership cannot access organization', async () => {
    await prisma.organizationMembership.updateMany({
      where: { user: { email: userA.email }, organizationId: orgAId },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Cookie', [`accessToken=${userAToken}`])
      .set('x-organization-id', orgAId)
      .expect(403);

    // Restore for cleanup
    await prisma.organizationMembership.updateMany({
      where: { user: { email: userA.email }, organizationId: orgAId },
      data: { isActive: true },
    });
  });

  it('Nonexistent organization cannot bypass authorization', async () => {
    const nonexistentOrgId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${nonexistentOrgId}`)
      .set('Cookie', [`accessToken=${userAToken}`])
      .set('x-organization-id', nonexistentOrgId)
      .expect(403);
  });
});
