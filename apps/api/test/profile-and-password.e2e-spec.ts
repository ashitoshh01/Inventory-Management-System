import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import * as argon2 from 'argon2';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

describe('Profile, Password Change & First Login (e2e)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  let prisma: PrismaService;

  const initialPassword = 'InitialPassword123!';
  const newPassword = 'NewSecurePassword456!';
  const timestamp = Date.now();

  const userA = {
    email: `profile-user-a-${timestamp}@example.com`,
    password: initialPassword,
  };

  const userB = {
    email: `profile-user-b-${timestamp}@example.com`,
    password: initialPassword,
  };

  const adminUser = {
    email: `profile-admin-${timestamp}@example.com`,
    password: initialPassword,
  };

  let userAToken: string;
  let adminToken: string;
  let userAId: string;
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

    const passwordHash = await argon2.hash(initialPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create Organization
    const org = await prisma.organization.create({
      data: {
        name: `Profile Test Org ${timestamp}`,
        slug: `profile-test-org-${timestamp}`,
      },
    });
    orgId = org.id;

    // Get Owner role
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });

    // Create userA (standard user)
    const createdUserA = await prisma.user.create({
      data: {
        email: userA.email,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
    });
    userAId = createdUserA.id;

    await prisma.organizationMembership.create({
      data: {
        userId: userAId,
        organizationId: orgId,
        roleId: ownerRole!.id,
      },
    });

    // Create userB (for conflict test)
    await prisma.user.create({
      data: {
        email: userB.email,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
    });

    // Create adminUser
    await prisma.user.create({
      data: {
        email: adminUser.email,
        passwordHash,
        isActive: true,
        isPlatformAdmin: true,
        mustChangePassword: false,
      },
    });

    // Login as userA to get access token
    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: userA.password })
      .expect(200);

    const cookiesA: string[] = loginResA.headers['set-cookie'];
    const accessCookieA = cookiesA.find((c: string) => c.startsWith('accessToken='));
    userAToken = accessCookieA!.split(';')[0].split('=')[1];

    // Login as adminUser to get admin token
    const loginResAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: adminUser.password })
      .expect(200);

    const cookiesAdmin: string[] = loginResAdmin.headers['set-cookie'];
    const accessCookieAdmin = cookiesAdmin.find((c: string) => c.startsWith('accessToken='));
    adminToken = accessCookieAdmin!.split(';')[0].split('=')[1];
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organizationMembership.deleteMany({
        where: { user: { email: { contains: `-${timestamp}@example.com` } } },
      });
      await prisma.session.deleteMany({
        where: { user: { email: { contains: `-${timestamp}@example.com` } } },
      });
      await prisma.auditEvent.deleteMany({
        where: { actorUserId: { in: [userAId] } },
      });
      await prisma.user.deleteMany({
        where: { email: { contains: `-${timestamp}@example.com` } },
      });
      if (orgId) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
      }
    }
    if (app) await app.close();
  });

  describe('GET /api/v1/profile/me', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/profile/me').expect(401);
    });

    it('returns authenticated user profile data with memberships', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Cookie', [`accessToken=${userAToken}`])
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.user.id).toBe(userAId);
      expect(res.body.data.user.email).toBe(userA.email);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.mustChangePassword).toBe(false);
      expect(res.body.data.memberships).toHaveLength(1);
      expect(res.body.data.activeOrganization?.id).toBe(orgId);
    });
  });

  describe('PATCH /api/v1/profile', () => {
    it('updates user email successfully and does not leak password hash', async () => {
      const updatedEmail = `updated-${timestamp}@example.com`;

      const res = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({ email: updatedEmail })
        .expect(200);

      expect(res.body.data.user.email).toBe(updatedEmail);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Verify database reflects the change
      const dbUser = await prisma.user.findUnique({ where: { id: userAId } });
      expect(dbUser?.email).toBe(updatedEmail);

      // Revert email back for subsequent tests
      await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({ email: userA.email })
        .expect(200);
    });

    it('rejects invalid email format with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({ email: 'not-a-valid-email' })
        .expect(400);
    });

    it('rejects duplicate email already taken by userB with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({ email: userB.email })
        .expect(409);
    });

    it('rejects non-whitelisted fields (role, isPlatformAdmin, isActive) with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          email: userA.email,
          isPlatformAdmin: true,
          isActive: false,
          role: 'Admin',
        })
        .expect(400);

      // Ensure platform admin status was NOT modified
      const dbUser = await prisma.user.findUnique({ where: { id: userAId } });
      expect(dbUser?.isPlatformAdmin).toBe(false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('rejects wrong current password with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          currentPassword: 'IncorrectPassword!',
          newPassword: newPassword,
          confirmPassword: newPassword,
        })
        .expect(400);
    });

    it('rejects mismatched new password confirmation with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          currentPassword: initialPassword,
          newPassword: newPassword,
          confirmPassword: 'MismatchPassword123!',
        })
        .expect(400);
    });

    it('rejects new password under 8 characters with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          currentPassword: initialPassword,
          newPassword: 'short',
          confirmPassword: 'short',
        })
        .expect(400);
    });

    it('rejects new password that matches the current password with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          currentPassword: initialPassword,
          newPassword: initialPassword,
          confirmPassword: initialPassword,
        })
        .expect(400);
    });

    it('successfully changes password, clears mustChangePassword, and sets fresh cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${userAToken}`])
        .send({
          currentPassword: initialPassword,
          newPassword: newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.user.email).toBe(userA.email);
      expect(res.body.data.user.mustChangePassword).toBe(false);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      const cookies: string[] = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const newAccessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
      expect(newAccessCookie).toBeDefined();

      // Verify old password no longer works
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: initialPassword })
        .expect(401);

      // Verify new password works
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: newPassword })
        .expect(200);

      expect(loginRes.body.data.user.email).toBe(userA.email);

      // Update userAToken for subsequent tests
      const updatedCookies: string[] = loginRes.headers['set-cookie'];
      userAToken = updatedCookies
        .find((c: string) => c.startsWith('accessToken='))!
        .split(';')[0]
        .split('=')[1];
    });
  });

  describe('Admin User Creation & Mandatory First-Login Enforcement', () => {
    const tempUserEmail = `admin-provisioned-${timestamp}@example.com`;
    const tempPassword = 'TemporaryPassword123!';
    const userChosenPassword = 'UserChosenPermanent123!';
    let tempUserToken: string;

    it('admin provisions new user and receives mustChangePassword = true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('Cookie', [`accessToken=${adminToken}`])
        .send({
          email: tempUserEmail,
          password: tempPassword,
          organizationId: orgId,
        })
        .expect(201);

      expect(res.body.data.email).toBe(tempUserEmail);
      expect(res.body.data.mustChangePassword).toBe(true);
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('provisioned user logs in and response indicates mustChangePassword: true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: tempUserEmail, password: tempPassword })
        .expect(200);

      expect(res.body.data.user.mustChangePassword).toBe(true);

      const cookies: string[] = res.headers['set-cookie'];
      tempUserToken = cookies
        .find((c: string) => c.startsWith('accessToken='))!
        .split(';')[0]
        .split('=')[1];
    });

    it('server-side enforcement: user with mustChangePassword = true is BLOCKED from application APIs with 403', async () => {
      // Trying to access products is blocked
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Cookie', [`accessToken=${tempUserToken}`])
        .set('x-organization-id', orgId)
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('server-side enforcement: /auth/me remains accessible to load user state', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', [`accessToken=${tempUserToken}`])
        .expect(200);

      expect(res.body.data.user.mustChangePassword).toBe(true);
    });

    it('user completes first-login password change via /api/v1/auth/change-password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', [`accessToken=${tempUserToken}`])
        .send({
          currentPassword: tempPassword,
          newPassword: userChosenPassword,
          confirmPassword: userChosenPassword,
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.user.mustChangePassword).toBe(false);

      const cookies: string[] = res.headers['set-cookie'];
      tempUserToken = cookies
        .find((c: string) => c.startsWith('accessToken='))!
        .split(';')[0]
        .split('=')[1];
    });

    it('after password change, user can access application APIs without 403 restriction', async () => {
      // Accessing products is now permitted (or returns 200 with list)
      await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Cookie', [`accessToken=${tempUserToken}`])
        .set('x-organization-id', orgId)
        .expect(200);

      // Subsequent login shows mustChangePassword is false
      const nextLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: tempUserEmail, password: userChosenPassword })
        .expect(200);

      expect(nextLogin.body.data.user.mustChangePassword).toBe(false);
    });
  });
});
