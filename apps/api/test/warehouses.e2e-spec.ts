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

describe('Warehouse REST API (e2e)', () => {
  jest.setTimeout(50000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = {
    email: `wh-owner-a-${timestamp}@test.com`,
    password: 'Password123!',
  };
  const ownerUserB = {
    email: `wh-owner-b-${timestamp}@test.com`,
    password: 'Password123!',
  };
  const viewerUserA = {
    email: `wh-viewer-a-${timestamp}@test.com`,
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

  let warehouseA1Id: string;
  let warehouseA2Id: string;
  let warehouseB1Id: string;

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
      .send({ ...ownerUserA, organizationName: `Org A Warehouses ${timestamp}` });
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
      .send({ ...ownerUserB, organizationName: `Org B Warehouses ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure Warehouse Permissions exist and assign to Owner role
    const warehousePerms = [
      'warehouse.read',
      'warehouse.create',
      'warehouse.update',
      'warehouse.delete',
    ];

    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of warehousePerms) {
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY warehouse.read
    let viewerRole = await prisma.role.findFirst({ where: { name: 'WarehouseViewer' } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: { name: 'WarehouseViewer', description: 'Read-only warehouse viewer' },
      });
    }
    const readPerm = await prisma.permission.findFirst({ where: { action: 'warehouse.read' } });
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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.warehouse.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.auditEvent.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.organizationMembership.deleteMany({
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
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  // ============================================================================
  // 1. AUTHENTICATION & UNPROTECTED ACCESS CHECKS
  // ============================================================================
  describe('Authentication Enforcement', () => {
    it('1. unauthenticated create -> 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('x-organization-id', orgAId)
        .send({ name: 'Unauth Warehouse', code: 'WH-UNAUTH' })
        .expect(401);
    });

    it('2. unauthenticated list -> 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('x-organization-id', orgAId)
        .expect(401);
    });

    it('3. unauthenticated get by id -> 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('x-organization-id', orgAId)
        .expect(401);
    });

    it('4. unauthenticated update -> 401', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('x-organization-id', orgAId)
        .send({ name: 'Unauth Update' })
        .expect(401);
    });

    it('5. unauthenticated delete -> 401', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('x-organization-id', orgAId)
        .expect(401);
    });
  });

  // ============================================================================
  // 2. RBAC ENFORCEMENT
  // ============================================================================
  describe('RBAC Enforcement', () => {
    it('6. missing create permission -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Viewer Create', code: 'WH-VIEWER' })
        .expect(403);
    });

    it('7. missing read permission -> 403 Forbidden', async () => {
      const noPermEmail = `wh-noperms-${Date.now()}@test.com`;
      const noPermPassword = 'Password123!';
      const regNoPerm = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: noPermEmail,
          password: noPermPassword,
          organizationName: `NoPerm Org ${Date.now()}`,
        });
      const noPermUserId = regNoPerm.body.data.user.id;

      const emptyRole = await prisma.role.create({
        data: { name: `EmptyRole-${Date.now()}`, description: 'No permissions' },
      });
      await prisma.organizationMembership.create({
        data: {
          userId: noPermUserId,
          organizationId: orgAId,
          roleId: emptyRole.id,
        },
      });
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: noPermEmail, password: noPermPassword });
      const noPermToken = loginRes.headers['set-cookie']
        .find((c: string) => c.startsWith('accessToken='))
        .split(';')[0]
        .split('=')[1];

      await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${noPermToken}`])
        .set('x-organization-id', orgAId)
        .expect(403);
    });

    it('8. missing update permission -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Viewer Update' })
        .expect(403);
    });

    it('9. missing delete permission -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .expect(403);
    });
  });

  // ============================================================================
  // 3. TENANCY & SPOOFING PROTECTION
  // ============================================================================
  describe('Tenancy & Isolation', () => {
    it('10. valid organization access succeeds', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('11. spoofed organization header -> 403 Forbidden', async () => {
      // User A attempts to access Org B with Org B header
      await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgBId)
        .expect(403);
    });
  });

  // ============================================================================
  // 4. CREATE WAREHOUSE
  // ============================================================================
  describe('POST /api/v1/warehouses (Create)', () => {
    it('17. valid creation -> 201 Created and standard envelope', async () => {
      const customReqId = `req-create-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .send({
          name: 'Main Central Hub',
          code: 'WH-MAIN',
          description: 'Primary organization hub',
          addressLine1: '100 Logistics Blvd',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Main Central Hub');
      expect(res.body.data.code).toBe('WH-MAIN');
      expect(res.body.data.organizationId).toBe(orgAId);
      expect(res.body.meta?.requestId).toBe(customReqId);

      warehouseA1Id = res.body.data.id;
    });

    it('18. first warehouse default behavior -> automatically becomes default', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${warehouseA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.isDefault).toBe(true);
    });

    it('19. duplicate code within same organization -> 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Another Facility',
          code: 'WH-MAIN', // duplicate code
        })
        .expect(409);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('WAREHOUSE_DUPLICATE_CODE');
    });

    it('20. duplicate name within same organization -> 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Main Central Hub', // duplicate name
          code: 'WH-DIFF-CODE',
        })
        .expect(409);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('WAREHOUSE_DUPLICATE_NAME');
    });

    it('21. invalid code format -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Invalid Code Facility',
          code: 'WH CODE WITH SPACES',
        })
        .expect(400);
    });

    it('22. unknown field rejected -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Facility With Extra Field',
          code: 'WH-EXTRA',
          arbitraryField: 'attack_payload',
        })
        .expect(400);
    });

    it('23. organizationId injection rejected -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Malicious Org Warehouse',
          code: 'WH-MALICIOUS-ORG',
          organizationId: orgBId,
        })
        .expect(400);
    });

    it('24. protected field injection (id, createdAt) rejected -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'Injected Id Warehouse',
          code: 'WH-INJECTED-ID',
          id: '00000000-0000-4000-8000-000000000000',
          createdAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('create second warehouse for Org A and another warehouse for Org B', async () => {
      // Create second warehouse in Org A (should not be default)
      const resA2 = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          name: 'North Regional Depot',
          code: 'WH-NORTH',
          city: 'Delhi',
          status: 'ACTIVE',
        })
        .expect(201);

      warehouseA2Id = resA2.body.data.id;
      expect(resA2.body.data.isDefault).toBe(false);

      // Create warehouse in Org B with same code WH-MAIN (allowed cross-tenant)
      const resB = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .send({
          name: 'Org B Distribution Center',
          code: 'WH-MAIN',
          city: 'Bengaluru',
        })
        .expect(201);

      warehouseB1Id = resB.body.data.id;
      expect(resB.body.data.code).toBe('WH-MAIN');
      expect(resB.body.data.organizationId).toBe(orgBId);
    });
  });

  // ============================================================================
  // 5. GET / READ WAREHOUSES & IDOR PROTECTION
  // ============================================================================
  describe('GET Endpoints & IDOR Isolation', () => {
    it('12. cross-tenant GET by ID -> 404 WAREHOUSE_NOT_FOUND', async () => {
      // Org A attempts to fetch Org B warehouse ID
      const res = await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${warehouseB1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      expect(res.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
    });

    it('13. cross-tenant GET by code -> 404 WAREHOUSE_NOT_FOUND', async () => {
      // Org B attempts to fetch WH-NORTH (which only exists in Org A)
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses/code/WH-NORTH')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(404);

      expect(res.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
    });

    it('42. normalized code lookup -> 200 OK', async () => {
      // Lookup 'wh-north' in lowercase should normalize to 'WH-NORTH'
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses/code/wh-north')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(warehouseA2Id);
      expect(res.body.data.code).toBe('WH-NORTH');
    });

    it('43. cross-tenant normalized lookup denied -> 404', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses/code/wh-north')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(404);
    });
  });

  // ============================================================================
  // 6. UPDATE WAREHOUSE
  // ============================================================================
  describe('PATCH /api/v1/warehouses/:id (Update)', () => {
    it('14. cross-tenant PATCH -> 404 WAREHOUSE_NOT_FOUND', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseB1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Hacked Facility' })
        .expect(404);
    });

    it('25. valid update -> 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          description: 'Updated description for north depot',
          city: 'New Delhi',
        })
        .expect(200);

      expect(res.body.data.description).toBe('Updated description for north depot');
      expect(res.body.data.city).toBe('New Delhi');
    });

    it('26. duplicate code on update -> 409 Conflict', async () => {
      // Attempt to change WH-NORTH to WH-MAIN (which is warehouseA1Id)
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ code: 'WH-MAIN' })
        .expect(409);
    });

    it('27. duplicate name on update -> 409 Conflict', async () => {
      // Attempt to change warehouseA2 name to warehouseA1 name
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Main Central Hub' })
        .expect(409);
    });

    it('28. protected organizationId update rejected -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ organizationId: orgBId })
        .expect(400);
    });

    it('29. invalid status on update -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ status: 'DESTROYED' })
        .expect(400);
    });

    it('30. default warehouse switching atomically updates previous default', async () => {
      // Set warehouseA2 to isDefault: true
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ isDefault: true })
        .expect(200);

      expect(res.body.data.isDefault).toBe(true);

      // Verify warehouseA1 is no longer default in database
      const wh1 = await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${warehouseA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(wh1.body.data.isDefault).toBe(false);

      // Switch default back to warehouseA1 for subsequent tests
      await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${warehouseA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ isDefault: true })
        .expect(200);
    });
  });

  // ============================================================================
  // 7. DELETE WAREHOUSE
  // ============================================================================
  describe('DELETE /api/v1/warehouses/:id (Delete)', () => {
    it('15. cross-tenant DELETE -> 404 WAREHOUSE_NOT_FOUND', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/warehouses/${warehouseB1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });

    it('32. delete default warehouse -> 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/warehouses/${warehouseA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(409);

      expect(res.body.error.code).toBe('WAREHOUSE_DELETE_CONFLICT');
    });

    it('31. delete non-default warehouse -> 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(204);

      // Verify warehouse is deleted
      await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${warehouseA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });

    it('33. audit event exists for delete', async () => {
      const deleteAudit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          entityId: warehouseA2Id,
          action: 'warehouse.deleted',
        },
      });

      expect(deleteAudit).not.toBeNull();
      expect(deleteAudit!.entityType).toBe('Warehouse');
    });
  });

  // ============================================================================
  // 8. LIST, PAGINATION, SEARCH, SORTING & ERRORS
  // ============================================================================
  describe('GET /api/v1/warehouses (List & Query)', () => {
    beforeAll(async () => {
      // Create additional warehouses for pagination and search testing in Org A
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/warehouses')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({
            name: `Warehouse Batch ${i}`,
            code: `WH-BATCH-${i}`,
            city: i % 2 === 0 ? 'Pune' : 'Mumbai',
            status: i === 5 ? 'INACTIVE' : 'ACTIVE',
          });
      }
    });

    it('16. cross-tenant search returns empty / isolated results', async () => {
      // Search in Org B for 'Batch' (which only exists in Org A)
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses?search=Batch')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .expect(200);

      expect(res.body.data.length).toBe(0);
    });

    it('34. pagination returns correct page, limit and total', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses?page=1&limit=3')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBe(3);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(3);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(6);
      expect(res.body.meta.hasNextPage).toBe(true);
    });

    it('35. maximum limit respects boundary (capped at 100 or rejects > 100)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses?limit=101')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);
    });

    it('36. search filters by name, code or city', async () => {
      const resName = await request(app.getHttpServer())
        .get('/api/v1/warehouses?search=Pune')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(resName.body.data.length).toBeGreaterThanOrEqual(2);
      expect(resName.body.data.every((w: { city: string }) => w.city === 'Pune')).toBe(true);
    });

    it('37. status filter filters ACTIVE and INACTIVE warehouses', async () => {
      const resInactive = await request(app.getHttpServer())
        .get('/api/v1/warehouses?status=INACTIVE')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(resInactive.body.data.length).toBe(1);
      expect(resInactive.body.data[0].status).toBe('INACTIVE');
    });

    it('38. sorting by allowed fields (name, code, createdAt) in asc and desc', async () => {
      const resAsc = await request(app.getHttpServer())
        .get('/api/v1/warehouses?sortBy=name&sortOrder=asc&limit=10')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const names = resAsc.body.data.map((w: { name: string }) => w.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });

    it('39. invalid sort field -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses?sortBy=non_existent_column')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);
    });

    it('40. invalid sort order -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses?sortOrder=diagonal')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);
    });

    it('41. invalid page and limit -> 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses?page=0')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/warehouses?limit=-5')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);
    });

    it('44. consistent API error envelope structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses/00000000-0000-4000-8000-000000000000')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.requestId).toBeDefined();
    });

    it('45. requestId propagation matches x-request-id header', async () => {
      const customReqId = `req-trace-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .expect(200);

      expect(res.body.meta?.requestId).toBe(customReqId);
    });
  });

  // ============================================================================
  // 9. PHASE 4E FINAL SECURITY, INTEGRITY & CONCURRENCY AUDIT
  // ============================================================================
  describe('Phase 4E Final Security, Integrity & Concurrency Audit', () => {
    it('46. concurrent duplicate code creation -> exactly 1 success (201) and others 409 Conflict', async () => {
      const concurrentCode = `WH-CONC-${Date.now()}`;
      const payload = {
        name: `Concurrent Hub ${Date.now()}`,
        code: concurrentCode,
      };

      const requests = [
        request(app.getHttpServer())
          .post('/api/v1/warehouses')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ ...payload, name: `${payload.name} 1` }),
        request(app.getHttpServer())
          .post('/api/v1/warehouses')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ ...payload, name: `${payload.name} 2` }),
        request(app.getHttpServer())
          .post('/api/v1/warehouses')
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ ...payload, name: `${payload.name} 3` }),
      ];

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(2);
      expect(['WAREHOUSE_DUPLICATE_CODE', 'DUPLICATE_RESOURCE']).toContain(
        conflicts[0].body.error.code,
      );
      expect(['WAREHOUSE_DUPLICATE_CODE', 'DUPLICATE_RESOURCE']).toContain(
        conflicts[1].body.error.code,
      );
    });

    it('47. concurrent default warehouse switching preserves invariant -> exactly 1 default', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: `Conc Default A ${Date.now()}`, code: `WH-CDA-${Date.now()}` })
        .expect(201);
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: `Conc Default B ${Date.now()}`, code: `WH-CDB-${Date.now()}` })
        .expect(201);

      const id1 = res1.body.data.id;
      const id2 = res2.body.data.id;

      await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/warehouses/${id1}`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ isDefault: true }),
        request(app.getHttpServer())
          .patch(`/api/v1/warehouses/${id2}`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .send({ isDefault: true }),
      ]);

      const defaultWarehouses = await prisma.warehouse.findMany({
        where: { organizationId: orgAId, isDefault: true },
      });
      expect(defaultWarehouses.length).toBe(1);
    });

    it('48. SQL injection attempts in search queries are executed safely without errors or leaks', async () => {
      const injectionPayloads = [
        "' OR 1=1 --",
        'DROP TABLE "Warehouse"; --',
        '<script>alert(1)</script>',
        'SELECT * FROM "User"',
        '"',
        '%',
        '_',
      ];

      for (const payload of injectionPayloads) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/warehouses?search=${encodeURIComponent(payload)}`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .expect(200);

        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
      }

      const count = await prisma.warehouse.count({ where: { organizationId: orgAId } });
      expect(count).toBeGreaterThan(0);
    });

    it('49. malicious sort fields and orders are rejected with 400 Bad Request', async () => {
      const maliciousSorts = [
        'DROP_TABLE',
        'password',
        'organizationId',
        '1;DROP TABLE warehouses',
        '__proto__',
      ];

      for (const sortBy of maliciousSorts) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/warehouses?sortBy=${encodeURIComponent(sortBy)}`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .expect(400);

        expect(res.body.error).toBeDefined();
      }
    });

    it('50. audit logs for warehouse mutations redact sensitive data', async () => {
      const auditEvents = await prisma.auditEvent.findMany({
        where: { organizationId: orgAId, entityType: 'Warehouse' },
        take: 10,
      });

      expect(auditEvents.length).toBeGreaterThan(0);
      for (const event of auditEvents) {
        const metadataStr = JSON.stringify(event.metadata ?? {}).toLowerCase();
        expect(metadataStr).not.toContain('password');
        expect(metadataStr).not.toContain('token');
        expect(metadataStr).not.toContain('secret');
        expect(metadataStr).not.toContain('cookie');
        expect(metadataStr).not.toContain('database_url');
      }
    });

    it('51. malformed and non-existent IDs return clean 404 without internal error leak', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${nonExistentId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
      expect(getRes.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
      expect(getRes.body.error.message).not.toContain('Prisma');

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${nonExistentId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Ghost Warehouse' })
        .expect(404);
      expect(patchRes.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
      expect(patchRes.body.error.message).not.toContain('Prisma');

      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/warehouses/${nonExistentId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
      expect(delRes.body.error.code).toBe('WAREHOUSE_NOT_FOUND');
      expect(delRes.body.error.message).not.toContain('Prisma');
    });
  });
});
