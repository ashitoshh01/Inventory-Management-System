import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { ProductsService } from '../src/modules/products/products.service';
import {
  InvalidCategoryReferenceException,
  ProductDuplicateSkuException,
  ProductNotFoundException,
} from '../src/modules/products/products.errors';

describe('Phase 3B Product Domain & Database Integration Suite', () => {
  jest.setTimeout(30000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let productsService: ProductsService;

  const timestamp = Date.now();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let catAId: string;
  let catBId: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    productsService = appModule.get<ProductsService>(ProductsService);

    // Create 2 test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `test-org-a-${timestamp}`,
        name: `Test Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `test-org-b-${timestamp}`,
        name: `Test Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // Create test users in each organization
    const userA = await prisma.user.create({
      data: {
        email: `usera-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `userb-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userBId = userB.id;

    // Create Category in Org A and Category in Org B
    const catA = await prisma.category.create({
      data: {
        organizationId: orgAId,
        name: `Hardware A ${timestamp}`,
        description: 'Org A Category',
      },
    });
    catAId = catA.id;

    const catB = await prisma.category.create({
      data: {
        organizationId: orgBId,
        name: `Hardware B ${timestamp}`,
        description: 'Org B Category',
      },
    });
    catBId = catB.id;
  });

  afterAll(async () => {
    if (prisma) {
      const orgIds = [orgAId, orgBId].filter(Boolean);
      const userIds = [userAId, userBId].filter(Boolean);

      if (orgIds.length > 0) {
        await prisma.product.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.category.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.auditEvent.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
      }
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
      if (orgIds.length > 0) {
        await prisma.organization.deleteMany({
          where: { id: { in: orgIds } },
        });
      }
    }
    if (appModule) {
      await appModule.close();
    }
  });

  it('1. should create a valid product in Org A and log audit event', async () => {
    const product = await productsService.create(orgAId, userAId, {
      categoryId: catAId,
      name: 'Steel Bolt 10mm',
      sku: 'BOLT-10MM',
      description: 'Grade 8.8 hex bolt',
      unitOfMeasure: 'UNIT',
      status: 'ACTIVE',
    });

    expect(product).toBeDefined();
    expect(product.id).toBeDefined();
    expect(product.organizationId).toBe(orgAId);
    expect(product.categoryId).toBe(catAId);
    expect(product.sku).toBe('BOLT-10MM');
    expect(product.name).toBe('Steel Bolt 10mm');
    expect(product.unitOfMeasure).toBe('UNIT');
    expect(product.status).toBe('ACTIVE');
    expect(product.category?.name).toBe(`Hardware A ${timestamp}`);

    // Verify audit event exists in PostgreSQL
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        organizationId: orgAId,
        entityType: 'Product',
        entityId: product.id,
        action: 'product.created',
      },
    });
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.actorUserId).toBe(userAId);
  });

  it('2. should reject creating a product in Org A referencing Org B category (cross-tenant check)', async () => {
    await expect(
      productsService.create(orgAId, userAId, {
        categoryId: catBId, // Belongs to Org B!
        name: 'Malicious Cross-Tenant Product',
        sku: 'CROSS-001',
      }),
    ).rejects.toThrow(InvalidCategoryReferenceException);
  });

  it('3. should enforce composite foreign key at database engine level when attempting cross-tenant insertion directly via Prisma', async () => {
    // Attempt raw bypass directly with Prisma client
    await expect(
      prisma.product.create({
        data: {
          organizationId: orgAId, // Org A
          categoryId: catBId, // Org B Category!
          name: 'Direct DB Bypass Attempt',
          sku: 'BYPASS-001',
          unitOfMeasure: 'UNIT',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2003', // Foreign key constraint failed
    });
  });

  it('4. should reject duplicate SKU within the same organization (case-insensitive due to uppercase normalization)', async () => {
    // Attempt duplicate with uppercase
    await expect(
      productsService.create(orgAId, userAId, {
        categoryId: catAId,
        name: 'Another Bolt',
        sku: 'BOLT-10MM', // already exists in Org A
      }),
    ).rejects.toThrow(ProductDuplicateSkuException);

    // Attempt duplicate with lowercase (must be normalized to BOLT-10MM and rejected)
    await expect(
      productsService.create(orgAId, userAId, {
        categoryId: catAId,
        name: 'Another Bolt Lowercase',
        sku: 'bolt-10mm',
      }),
    ).rejects.toThrow(ProductDuplicateSkuException);
  });

  it('5. should allow the same SKU in a different organization (tenancy isolation)', async () => {
    // Org B creates a product with the same SKU 'BOLT-10MM' referencing its own Category B
    const orgBProduct = await productsService.create(orgBId, userBId, {
      categoryId: catBId,
      name: 'Org B Bolt 10mm',
      sku: 'BOLT-10MM',
      unitOfMeasure: 'BOX',
      status: 'ACTIVE',
    });

    expect(orgBProduct).toBeDefined();
    expect(orgBProduct.organizationId).toBe(orgBId);
    expect(orgBProduct.sku).toBe('BOLT-10MM');
    expect(orgBProduct.categoryId).toBe(catBId);
  });

  it('6. should find product by ID within tenant context and isolate from other tenants', async () => {
    const product = await productsService.findBySku('BOLT-10MM', orgAId);
    expect(product).toBeDefined();
    const productId = product!.id;

    // Found within Org A
    const foundInA = await productsService.findById(productId, orgAId);
    expect(foundInA).toBeDefined();
    expect(foundInA?.id).toBe(productId);

    // Attempt lookup using Org B context -> must return null
    const foundInB = await productsService.findById(productId, orgBId);
    expect(foundInB).toBeNull();
  });

  it('7. should find product by SKU within tenant context', async () => {
    const productA = await productsService.findBySku('bolt-10mm', orgAId);
    expect(productA).toBeDefined();
    expect(productA?.organizationId).toBe(orgAId);
    expect(productA?.name).toBe('Steel Bolt 10mm');

    const productB = await productsService.findBySku('BOLT-10MM', orgBId);
    expect(productB).toBeDefined();
    expect(productB?.organizationId).toBe(orgBId);
    expect(productB?.name).toBe('Org B Bolt 10mm');
  });

  it('8. should update product status and log audit event', async () => {
    const productA = await productsService.findBySku('BOLT-10MM', orgAId);
    expect(productA).toBeDefined();

    const updated = await productsService.updateStatus(
      productA!.id,
      orgAId,
      userAId,
      'INACTIVE',
      'req-status-upd',
    );

    expect(updated.status).toBe('INACTIVE');

    // Org B should not be able to update Org A's product
    await expect(
      productsService.updateStatus(productA!.id, orgBId, userBId, 'ACTIVE'),
    ).rejects.toThrow(ProductNotFoundException);

    // Check audit event
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        organizationId: orgAId,
        entityType: 'Product',
        entityId: productA!.id,
        action: 'product.updated',
      },
    });
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.metadata).toMatchObject({
      changedFields: ['status'],
      previousStatus: 'ACTIVE',
      newStatus: 'INACTIVE',
    });
  });

  it('9. should prevent deletion of a category referenced by a product (ON DELETE RESTRICT)', async () => {
    // Attempting to delete catAId when product exists in catAId must fail at database level
    await expect(
      prisma.category.delete({
        where: { id: catAId },
      }),
    ).rejects.toMatchObject({
      code: 'P2003', // Foreign key constraint violation on delete
    });
  });

  it('10. should cascade delete products when organization is deleted', async () => {
    // Create dedicated throwaway org and product to verify cascade
    const throwawayTime = Date.now();
    const throwawayOrg = await prisma.organization.create({
      data: {
        slug: `throwaway-org-${throwawayTime}`,
        name: `Throwaway Org ${throwawayTime}`,
      },
    });
    const throwawayCat = await prisma.category.create({
      data: {
        organizationId: throwawayOrg.id,
        name: 'Temp Category',
      },
    });
    const throwawayProduct = await prisma.product.create({
      data: {
        organizationId: throwawayOrg.id,
        categoryId: throwawayCat.id,
        name: 'Temp Product',
        sku: 'TEMP-SKU-999',
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
      },
    });

    expect(throwawayProduct.id).toBeDefined();

    // Deleting organization cascades to products
    await prisma.organization.delete({
      where: { id: throwawayOrg.id },
    });

    const checkProduct = await prisma.product.findUnique({
      where: { id: throwawayProduct.id },
    });
    expect(checkProduct).toBeNull();
  });
});
