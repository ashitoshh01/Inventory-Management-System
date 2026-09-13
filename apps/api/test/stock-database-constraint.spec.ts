import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { Prisma } from '@prisma/client';

describe('StockBalance Database Check Constraint Invariant', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrgId: string;
  let testProductId: string;
  let testWarehouseId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Setup test tenant, warehouse, product
    const org = await prisma.organization.create({
      data: {
        name: `Constraint Test Org ${Date.now()}`,
        slug: `constraint-org-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    const wh = await prisma.warehouse.create({
      data: {
        organizationId: testOrgId,
        name: 'Constraint WH',
        code: `CWH-${Date.now().toString().slice(-4)}`,
      },
    });
    testWarehouseId = wh.id;

    const cat = await prisma.category.create({
      data: {
        organizationId: testOrgId,
        name: 'Constraint Category',
      },
    });

    const prod = await prisma.product.create({
      data: {
        organizationId: testOrgId,
        categoryId: cat.id,
        name: 'Constraint Product',
        sku: `CSKU-${Date.now().toString().slice(-4)}`,
      },
    });
    testProductId = prod.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.stockBalance.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.product.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.category.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.warehouse.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.organization.deleteMany({ where: { id: testOrgId } });
    }
    if (app) await app.close();
  });

  it('allows zero and positive balance insertion and mutation', async () => {
    const balance = await prisma.stockBalance.create({
      data: {
        organizationId: testOrgId,
        productId: testProductId,
        warehouseId: testWarehouseId,
        quantity: new Prisma.Decimal('10.5000'),
      },
    });

    expect(balance.quantity.toString()).toBe('10.5');

    // Update to zero
    const updated = await prisma.stockBalance.update({
      where: { id: balance.id },
      data: { quantity: new Prisma.Decimal('0.0000') },
    });
    expect(updated.quantity.toString()).toBe('0');
  });

  it('rejects negative quantity at the PostgreSQL database level via CHECK constraint', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE "StockBalance"
        SET "quantity" = -1.0000
        WHERE "organizationId" = ${testOrgId}
          AND "productId" = ${testProductId}
          AND "warehouseId" = ${testWarehouseId};
      `,
    ).rejects.toThrow();
  });
});
