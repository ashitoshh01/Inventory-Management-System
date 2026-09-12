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

describe('Category Domain Foundation (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `cat-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `cat-owner-b-${timestamp}@test.com`, password: 'Password123!' };
  const viewerUserA = { email: `cat-viewer-a-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;

  let tokenB: string;
  let orgBId: string;
  let userBId: string;

  let tokenViewerA: string;
  let viewerUserId: string;

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
      .send({ ...ownerUserA, organizationName: 'Org A Corp' });
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
      .send({ ...ownerUserB, organizationName: 'Org B Corp' });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Setup Category Permissions and assign to Owner role
    const categoryPerms = [
      'category.read',
      'category.create',
      'category.update',
      'category.delete',
    ];

    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of categoryPerms) {
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY category.read
    let viewerRole = await prisma.role.findFirst({ where: { name: 'Viewer' } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: { name: 'Viewer', description: 'Read-only role' },
      });
    }
    const readPerm = await prisma.permission.findFirst({ where: { action: 'category.read' } });
    if (readPerm) {
      const exists = await prisma.rolePermission.findFirst({
        where: { roleId: viewerRole.id, permissionId: readPerm.id },
      });
      if (!exists) {
        await prisma.rolePermission.create({
          data: { roleId: viewerRole.id, permissionId: readPerm.id },
        });
      }
    }

    const regViewer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...viewerUserA, organizationName: 'Temp Viewer Org' });
    viewerUserId = regViewer.body.data.user.id;

    // Add viewer to Org A with Viewer role
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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.category.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.organizationMembership.deleteMany({
        where: { userId: { in: [userAId, userBId, viewerUserId] } },
      });
      await prisma.auditEvent.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.session.deleteMany({
        where: { userId: { in: [userAId, userBId, viewerUserId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId, viewerUserId] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
    }
    if (app) await app.close();
  });

  describe('POST /api/v1/categories (Create)', () => {
    it('1. should create a valid category under active organization and return API envelope', async () => {
      const customReqId = `req-create-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .send({
          name: '  Electronics  ',
          description: 'Electronic devices and accessories',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.organizationId).toBe(orgAId);
      expect(res.body.data.name).toBe('Electronics'); // whitespace trimmed
      expect(res.body.data.description).toBe('Electronic devices and accessories');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.requestId).toBe(customReqId);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'category.created',
          entityId: res.body.data.id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
      expect(audit?.entityType).toBe('Category');
    });

    it('2. should reject duplicate category name within the same organization with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'electronics', // Case-insensitive duplicate of 'Electronics'
        })
        .expect(409);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CATEGORY_DUPLICATE');
      expect(res.body.error.message).toContain('already exists');
    });

    it('3. should permit identical category name in a DIFFERENT organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .send({
          name: 'Electronics',
        })
        .expect(201);

      expect(res.body.data.organizationId).toBe(orgBId);
      expect(res.body.data.name).toBe('Electronics');
    });

    it('4. should deny category creation without category.create permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Forbidden Hardware',
        })
        .expect(403);
    });

    it('5. should reject attempts to inject organizationId or unknown properties (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Injected Org Category',
          organizationId: orgBId, // Malicious tenant override attempt
        })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('property organizationId should not exist');
    });

    it('6. should reject empty or whitespace-only name (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: '     ',
        })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /api/v1/categories (List & Pagination)', () => {
    beforeAll(async () => {
      // Create additional categories in Org A
      await prisma.category.create({
        data: { organizationId: orgAId, name: 'Appliances', description: 'Home appliances' },
      });
      await prisma.category.create({
        data: { organizationId: orgAId, name: 'Furniture', description: 'Office desks and chairs' },
      });
    });

    it('7. should list categories strictly scoped to active organization with pagination meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories?page=1&limit=10')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      // Ensure all items belong to Org A
      for (const item of res.body.data) {
        expect(item.organizationId).toBe(orgAId);
      }
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
      expect(res.body.meta.totalPages).toBeDefined();
    });

    it('8. should support search filtering strictly within tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories?search=furn')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Furniture');
    });

    it('9. should safely fallback to default sort when given arbitrary column name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories?sortBy=malicious_sql_column&sortOrder=asc')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      // No 500 error or database crash occurred
    });

    it('10. should allow viewer with category.read permission to list categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/categories/:id (Get Single)', () => {
    let catAId: string;
    let catBId: string;

    beforeAll(async () => {
      const catA = await prisma.category.findFirst({ where: { organizationId: orgAId } });
      catAId = catA!.id;
      const catB = await prisma.category.findFirst({ where: { organizationId: orgBId } });
      catBId = catB!.id;
    });

    it('11. should fetch single category within organization', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${catAId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(catAId);
      expect(res.body.data.organizationId).toBe(orgAId);
    });

    it('12. should return 404 NOT_FOUND when Org A user attempts to access Org B category (IDOR Prevention)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${catBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
      // Never expose that catB exists in another tenant
    });

    it('13. should return 404 for nonexistent UUID category', async () => {
      const nonExistentId = 'a0000000-0000-4000-8000-000000000999';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${nonExistentId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('14. should return 400 Bad Request for malformed non-UUID category ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/not-a-valid-uuid')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(JSON.stringify(res.body)).not.toContain('prisma');
    });
  });

  describe('PATCH /api/v1/categories/:id (Update)', () => {
    let catAId: string;
    let catBId: string;

    beforeAll(async () => {
      const catA = await prisma.category.create({
        data: { organizationId: orgAId, name: 'Updatable Category', description: 'Initial' },
      });
      catAId = catA.id;
      const catB = await prisma.category.findFirst({ where: { organizationId: orgBId } });
      catBId = catB!.id;
    });

    it('15. should update category name and description and log audit event', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${catAId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Renamed Category',
          description: 'Updated description',
        })
        .expect(200);

      expect(res.body.data.name).toBe('Renamed Category');
      expect(res.body.data.description).toBe('Updated description');

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'category.updated',
          entityId: catAId,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
    });

    it('16. should reject rename to an existing category name within same organization (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${catAId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'electronics', // Conflicts with existing 'Electronics' in Org A
        })
        .expect(409);

      expect(res.body.error.code).toBe('CATEGORY_DUPLICATE');
    });

    it('17. should prevent cross-tenant update (Org A updating Org B category returns 404)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${catBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Hacked Name',
        })
        .expect(404);

      // Verify Org B category was not modified
      const unchanged = await prisma.category.findUnique({ where: { id: catBId } });
      expect(unchanged?.name).not.toBe('Hacked Name');
    });

    it('18. should deny update without category.update permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${catAId}`)
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('19. should reject attempts to mutate protected fields (e.g. organizationId, id)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${catAId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          organizationId: orgBId,
        })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('DELETE /api/v1/categories/:id (Delete)', () => {
    let catToDeleteId: string;
    let catBId: string;

    beforeEach(async () => {
      const cat = await prisma.category.create({
        data: { organizationId: orgAId, name: `Deletable-${Date.now()}` },
      });
      catToDeleteId = cat.id;

      const catB = await prisma.category.findFirst({ where: { organizationId: orgBId } });
      catBId = catB!.id;
    });

    it('20. should delete category and log audit event', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${catToDeleteId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(catToDeleteId);

      // Verify record is deleted from database
      const check = await prisma.category.findUnique({ where: { id: catToDeleteId } });
      expect(check).toBeNull();

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'category.deleted',
          entityId: catToDeleteId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('21. should prevent cross-tenant deletion (Org A deleting Org B category returns 404)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${catBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      // Verify Org B category still exists
      const check = await prisma.category.findUnique({ where: { id: catBId } });
      expect(check).not.toBeNull();
    });

    it('22. should deny deletion without category.delete permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${catToDeleteId}`)
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .expect(403);
    });
  });

  describe('Tenant Boundary & Membership Security', () => {
    it('23. should deny access when modifying x-organization-id to an unauthorized organization (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgBId) // User A has no membership in Org B
        .expect(403);
    });

    it('24. should deny access if membership is suspended (isActive: false)', async () => {
      // Temporarily deactivate membership for Owner A
      await prisma.organizationMembership.updateMany({
        where: { userId: userAId, organizationId: orgAId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(403);

      // Restore membership
      await prisma.organizationMembership.updateMany({
        where: { userId: userAId, organizationId: orgAId },
        data: { isActive: true },
      });
    });

    it('25. should reject request missing x-organization-id header (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Cookie', [`accessToken=${tokenA}`])
        .expect(400);
    });
  });
});
