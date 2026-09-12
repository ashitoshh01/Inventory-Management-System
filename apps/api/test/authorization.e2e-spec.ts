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

describe('Authorization (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const owner = { email: `owner-${Date.now()}@test.com`, password: 'Password123!' };

  let ownerToken: string;
  let orgId: string;

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

    // Setup Owner & Org
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...owner, organizationName: 'Authz Org' });
    orgId = res.body.data.organization.id;
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send(owner);
    ownerToken = login.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // Seed permissions for Owner role
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      const perms = ['organization.read', 'organization.manage', 'member.read', 'member.manage'];
      for (const action of perms) {
        let perm = await prisma.permission.findFirst({ where: { action } });
        if (!perm) perm = await prisma.permission.create({ data: { action, description: action } });
        const exists = await prisma.rolePermission.findFirst({
          where: { roleId: ownerRole.id, permissionId: perm.id },
        });
        if (!exists)
          await prisma.rolePermission.create({
            data: { roleId: ownerRole.id, permissionId: perm.id },
          });
      }
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organizationMembership.deleteMany({ where: { user: { email: owner.email } } });
      await prisma.auditEvent.deleteMany({});
      await prisma.session.deleteMany({ where: { user: { email: owner.email } } });
      await prisma.user.deleteMany({ where: { email: owner.email } });
    }
    if (app) await app.close();
  });

  it('Owner can update organization with manage permission', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}`)
      .set('Cookie', [`accessToken=${ownerToken}`])
      .set('x-organization-id', orgId)
      .send({ name: 'Updated Org Name' })
      .expect(200);
  });

  it('Member without manage permission is denied', async () => {
    // Create a read-only role
    let memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
    if (!memberRole)
      memberRole = await prisma.role.create({ data: { name: 'Member', description: 'Read Only' } });
    const readPerm = await prisma.permission.findFirst({ where: { action: 'organization.read' } });
    if (readPerm) {
      const exists = await prisma.rolePermission.findFirst({
        where: { roleId: memberRole.id, permissionId: readPerm.id },
      });
      if (!exists)
        await prisma.rolePermission.create({
          data: { roleId: memberRole.id, permissionId: readPerm.id },
        });
    }

    // Create member user
    const member = { email: `member-${Date.now()}@test.com`, password: 'Password123!' };
    const memberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...member, organizationName: 'Temp Org' });
    const memberUserId = memberRes.body.data.user.id;

    // Add to Org as read-only member
    await prisma.organizationMembership.create({
      data: { userId: memberUserId, organizationId: orgId, roleId: memberRole.id },
    });

    const memberLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send(member);
    const memberToken = memberLogin.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // Member can read
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}`)
      .set('Cookie', [`accessToken=${memberToken}`])
      .set('x-organization-id', orgId)
      .expect(200);

    // Member CANNOT update
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}`)
      .set('Cookie', [`accessToken=${memberToken}`])
      .set('x-organization-id', orgId)
      .send({ name: 'Hacked Org' })
      .expect(403);

    // Changing organization header to member's own org cannot bypass permissions for another org
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}`)
      .set('Cookie', [`accessToken=${memberToken}`])
      .set('x-organization-id', memberRes.body.data.organization.id) // Their own org header targeting orgId
      .send({ name: 'Cross-Org Bypass Attempt' })
      .expect(403);

    // Cleanup member
    await prisma.organizationMembership.deleteMany({ where: { userId: memberUserId } });
    await prisma.session.deleteMany({ where: { userId: memberUserId } });
    await prisma.user.deleteMany({ where: { email: member.email } });
  });

  it('verifies audit events are generated correctly and sensitive values are redacted', async () => {
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        OR: [{ organizationId: orgId }, { actorUserId: { not: null } }],
      },
    });

    expect(auditEvents.length).toBeGreaterThan(0);

    // Verify all audit events have redacted sensitive keys
    const sensitiveTerms = [
      'password',
      'secret',
      'token',
      'database_url',
      'authorization',
      'cookie',
    ];
    for (const event of auditEvents) {
      if (event.metadata && typeof event.metadata === 'object') {
        const str = JSON.stringify(event.metadata).toLowerCase();
        for (const term of sensitiveTerms) {
          if (str.includes(term)) {
            // It should be redacted, never containing a plain secret like Password123!
            expect(str).not.toContain('password123!');
          }
        }
      }
    }
  });
});
