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

describe('Product REST API (e2e)', () => {
  jest.setTimeout(40000);
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const ownerUserA = { email: `prod-owner-a-${timestamp}@test.com`, password: 'Password123!' };
  const ownerUserB = { email: `prod-owner-b-${timestamp}@test.com`, password: 'Password123!' };
  const viewerUserA = { email: `prod-viewer-a-${timestamp}@test.com`, password: 'Password123!' };

  let tokenA: string;
  let orgAId: string;
  let userAId: string;

  let tokenB: string;
  let orgBId: string;
  let userBId: string;

  let tokenViewerA: string;
  let viewerUserId: string;

  let catA1Id: string;
  let catA2Id: string;
  let catBId: string;

  let createdProductA1Id: string;
  let createdProductBId: string;

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
      .send({ ...ownerUserA, organizationName: `Org A Corp ${timestamp}` });
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
      .send({ ...ownerUserB, organizationName: `Org B Corp ${timestamp}` });
    orgBId = resB.body.data.organization.id;
    userBId = resB.body.data.user.id;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send(ownerUserB);
    tokenB = loginB.headers['set-cookie']
      .find((c: string) => c.startsWith('accessToken='))
      .split(';')[0]
      .split('=')[1];

    // 3. Ensure Product Permissions exist and assign to Owner role
    const productPerms = ['product.read', 'product.create', 'product.update', 'product.delete'];

    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      for (const action of productPerms) {
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

    // 4. Setup Read-Only Viewer User in Org A with ONLY product.read
    let viewerRole = await prisma.role.findFirst({ where: { name: 'ProductViewer' } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: { name: 'ProductViewer', description: 'Read-only product viewer' },
      });
    }
    const readPerm = await prisma.permission.findFirst({ where: { action: 'product.read' } });
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

    // 5. Seed categories in Org A and Org B
    const catA1 = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Hardware A1 ${timestamp}`,
        description: 'Org A Cat 1',
      },
    });
    catA1Id = catA1.id;

    const catA2 = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Electronics A2 ${timestamp}`,
        description: 'Org A Cat 2',
      },
    });
    catA2Id = catA2.id;

    const catB = await prisma.category.create({
      data: {
        organizationId: orgBId,
        name: `Hardware B1 ${timestamp}`,
        description: 'Org B Cat 1',
      },
    });
    catBId = catB.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.product.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
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

  describe('POST /api/v1/products (Create)', () => {
    it('1. should create a valid product under active organization and emit audit event', async () => {
      const customReqId = `req-create-prod-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .send({
          sku: '  bolt-100  ',
          name: '  Hex Bolt 10mm  ',
          description: 'High tensile steel bolt',
          categoryId: catA1Id,
          unitOfMeasure: 'UNIT',
          status: 'ACTIVE',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.organizationId).toBe(orgAId);
      expect(res.body.data.categoryId).toBe(catA1Id);
      expect(res.body.data.sku).toBe('BOLT-100'); // Normalized to uppercase
      expect(res.body.data.name).toBe('Hex Bolt 10mm'); // Trimmed
      expect(res.body.data.description).toBe('High tensile steel bolt');
      expect(res.body.data.unitOfMeasure).toBe('UNIT');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.category?.name).toContain('Hardware A1');
      expect(res.body.meta?.requestId).toBe(customReqId);

      createdProductA1Id = res.body.data.id;

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'product.created',
          entityId: res.body.data.id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
      expect(audit?.entityType).toBe('Product');
    });

    it('2. should reject cross-tenant category reference with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'CROSS-CAT-01',
          name: 'Cross Tenant Product',
          categoryId: catBId, // Belongs to Org B!
        })
        .expect(400);

      expect(res.body.error?.code).toBe('INVALID_CATEGORY_REFERENCE');
    });

    it('3. should reject duplicate SKU in the same organization with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'bolt-100', // Case-insensitive collision with BOLT-100
          name: 'Duplicate Bolt',
          categoryId: catA1Id,
        })
        .expect(409);

      expect(res.body.error?.code).toBe('PRODUCT_DUPLICATE_SKU');
    });

    it('4. should allow identical SKU in a DIFFERENT organization (tenancy isolation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenB}`])
        .set('x-organization-id', orgBId)
        .send({
          sku: 'BOLT-100', // Identical SKU in Org B
          name: 'Org B Bolt',
          categoryId: catBId,
        })
        .expect(201);

      expect(res.body.data.organizationId).toBe(orgBId);
      expect(res.body.data.sku).toBe('BOLT-100');
      createdProductBId = res.body.data.id;
    });

    it('5. should reject missing required fields (name, categoryId, sku) with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ sku: 'TEST-SKU' }) // Missing name and categoryId
        .expect(400);
    });

    it('6. should reject invalid SKU format (internal whitespace or special chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'INVALID SKU SPACES',
          name: 'Invalid SKU Product',
          categoryId: catA1Id,
        })
        .expect(400);
    });

    it('7. should reject unknown/protected fields in request body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'SAFE-SKU-99',
          name: 'Safe Name',
          categoryId: catA1Id,
          organizationId: 'hack-org-id', // Protected field
        })
        .expect(400);
    });

    it('8. should deny creation without product.create permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'FORBIDDEN-01',
          name: 'Forbidden Product',
          categoryId: catA1Id,
        })
        .expect(403);
    });

    it('9. should reject unauthenticated request with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('x-organization-id', orgAId)
        .send({
          sku: 'UNAUTH-01',
          name: 'Unauth Product',
          categoryId: catA1Id,
        })
        .expect(401);
    });

    it('10. should reject missing x-organization-id header with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .send({
          sku: 'NO-ORG-01',
          name: 'No Org Product',
          categoryId: catA1Id,
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/products (List & Filters)', () => {
    beforeAll(async () => {
      // Seed a few additional products in Org A for filtering and pagination tests
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'SCREW-01',
          name: 'Wood Screw 20mm',
          description: 'Steel wood screw',
          categoryId: catA1Id,
          unitOfMeasure: 'BOX',
          status: 'ACTIVE',
        });

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'WIRE-01',
          name: 'Copper Wire 10m',
          description: 'Insulated copper wire',
          categoryId: catA2Id,
          unitOfMeasure: 'M',
          status: 'INACTIVE',
        });
    });

    it('11. should list products for active organization with pagination metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);

      // Verify all products belong to Org A
      for (const p of res.body.data) {
        expect(p.organizationId).toBe(orgAId);
      }
    });

    it('12. should respect page and limit query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?page=1&limit=2')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.hasNextPage).toBe(true);
    });

    it('13. should filter products by search term safely', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?search=copper')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Copper Wire');
    });

    it('14. should safely handle SQL injection strings in search query without error or leak', async () => {
      const maliciousSearches = [`' OR '1'='1`, `"; DROP TABLE products; --`, `admin'--`, `%_%`];

      for (const query of maliciousSearches) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/products?search=${encodeURIComponent(query)}`)
          .set('Cookie', [`accessToken=${tokenA}`])
          .set('x-organization-id', orgAId)
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('15. should filter products by categoryId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products?categoryId=${catA2Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const p of res.body.data) {
        expect(p.categoryId).toBe(catA2Id);
      }
    });

    it('16. should filter products by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?status=INACTIVE')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const p of res.body.data) {
        expect(p.status).toBe('INACTIVE');
      }
    });

    it('17. should filter products by unitOfMeasure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?unitOfMeasure=M')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const p of res.body.data) {
        expect(p.unitOfMeasure).toBe('M');
      }
    });

    it('18. should sort products by allowlisted field and order', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?sortBy=sku&sortOrder=asc')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      const skus = res.body.data.map((p: { sku: string }) => p.sku);
      const sortedSkus = [...skus].sort();
      expect(skus).toEqual(sortedSkus);
    });

    it('19. should safely fallback to createdAt when invalid sortBy is supplied', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?sortBy=injected_field;DROP')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('20. should allow read-only viewer to list products', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .expect(200);
    });
  });

  describe('GET /api/v1/products/:id (Get by ID)', () => {
    it('21. should return product by ID within tenant organization', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(createdProductA1Id);
      expect(res.body.data.sku).toBe('BOLT-100');
      expect(res.body.data.category?.id).toBe(catA1Id);
    });

    it('22. should return 404 for IDOR attempt accessing foreign organization product ID', async () => {
      // User A attempts to view Org B product ID
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${createdProductBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);

      expect(res.body.error?.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('23. should return 404 for nonexistent UUID', async () => {
      const nonExistentId = 'a0000000-0000-4000-8000-000000000999';
      await request(app.getHttpServer())
        .get(`/api/v1/products/${nonExistentId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });

    it('24. should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/not-a-valid-uuid')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(400);
    });
  });

  describe('GET /api/v1/products/sku/:sku (Get by SKU)', () => {
    it('25. should find product by SKU (case-insensitive normalized)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/sku/bolt-100')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(200);

      expect(res.body.data.id).toBe(createdProductA1Id);
      expect(res.body.data.sku).toBe('BOLT-100');
    });

    it('26. should return 404 when querying SKU not existing in active organization', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/sku/NON-EXISTENT-SKU')
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/products/:id (Update)', () => {
    it('27. should update product attributes and log audit event', async () => {
      const customReqId = `req-upd-prod-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .send({
          name: 'Updated Hex Bolt 10mm Pro',
          description: 'Updated description',
          status: 'INACTIVE',
        })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Hex Bolt 10mm Pro');
      expect(res.body.data.description).toBe('Updated description');
      expect(res.body.data.status).toBe('INACTIVE');
      expect(res.body.meta?.requestId).toBe(customReqId);

      // Verify Audit Event in DB
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'product.updated',
          entityId: createdProductA1Id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
    });

    it('28. should reassign category when new category belongs to same organization', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          categoryId: catA2Id,
        })
        .expect(200);

      expect(res.body.data.categoryId).toBe(catA2Id);
      expect(res.body.data.category?.id).toBe(catA2Id);
    });

    it('29. should reject reassigning category to a foreign organization category (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          categoryId: catBId, // Belongs to Org B!
        })
        .expect(400);

      expect(res.body.error?.code).toBe('INVALID_CATEGORY_REFERENCE');
    });

    it('30. should reject updating SKU to another already existing SKU in same organization (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({
          sku: 'SCREW-01', // Already belongs to another product in Org A
        })
        .expect(409);

      expect(res.body.error?.code).toBe('PRODUCT_DUPLICATE_SKU');
    });

    it('31. should return 404 for IDOR attempt updating foreign organization product ID', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Malicious Update' })
        .expect(404);
    });

    it('32. should deny update without product.update permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .send({ name: 'Forbidden Update' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/products/:id (Delete)', () => {
    it('33. should return 404 for IDOR attempt deleting foreign organization product ID', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${createdProductBId}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });

    it('34. should deny delete without product.delete permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenViewerA}`])
        .set('x-organization-id', orgAId)
        .expect(403);
    });

    it('35. should delete product and emit audit event', async () => {
      const customReqId = `req-del-prod-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .set('x-request-id', customReqId)
        .expect(200);

      expect(res.body.data.id).toBe(createdProductA1Id);
      expect(res.body.data.message).toBe('Product deleted successfully');
      expect(res.body.meta?.requestId).toBe(customReqId);

      // Verify product is gone from DB
      const check = await prisma.product.findUnique({
        where: { id: createdProductA1Id },
      });
      expect(check).toBeNull();

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          organizationId: orgAId,
          action: 'product.deleted',
          entityId: createdProductA1Id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(userAId);
    });

    it('36. should return 404 when attempting to delete already deleted product', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${createdProductA1Id}`)
        .set('Cookie', [`accessToken=${tokenA}`])
        .set('x-organization-id', orgAId)
        .expect(404);
    });
  });
});
