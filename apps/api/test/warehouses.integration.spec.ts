import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import {
  WarehouseNotFoundException,
  WarehouseDuplicateCodeException,
  WarehouseDeleteConflictException,
} from '../src/modules/warehouses/warehouses.errors';

describe('Phase 4A Warehouse Domain & Database Integration Suite', () => {
  jest.setTimeout(30000);

  let appModule: TestingModule;
  let prisma: PrismaService;
  let warehousesService: WarehousesService;

  const timestamp = Date.now();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = appModule.get<PrismaService>(PrismaService);
    warehousesService = appModule.get<WarehousesService>(WarehousesService);

    // Create 2 test organizations
    const orgA = await prisma.organization.create({
      data: {
        slug: `wh-org-a-${timestamp}`,
        name: `Warehouse Org A ${timestamp}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        slug: `wh-org-b-${timestamp}`,
        name: `Warehouse Org B ${timestamp}`,
      },
    });
    orgBId = orgB.id;

    // Create test users in each organization
    const userA = await prisma.user.create({
      data: {
        email: `wh-user-a-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `wh-user-b-${timestamp}@test.com`,
        passwordHash: 'dummyhash123',
      },
    });
    userBId = userB.id;
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
        where: {
          user: {
            email: { in: [`wh-user-a-${timestamp}@test.com`, `wh-user-b-${timestamp}@test.com`] },
          },
        },
      });
      await prisma.session.deleteMany({
        where: {
          user: {
            email: { in: [`wh-user-a-${timestamp}@test.com`, `wh-user-b-${timestamp}@test.com`] },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: { in: [`wh-user-a-${timestamp}@test.com`, `wh-user-b-${timestamp}@test.com`] },
        },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
      await prisma.$disconnect();
    }
  });

  describe('Database Invariants & Constraints (Real PostgreSQL)', () => {
    it('1. Warehouse can be created for valid organization in real database', async () => {
      const warehouse = await warehousesService.create(orgAId, userAId, {
        name: 'Main Distribution Hub',
        code: 'WH-MAIN',
        description: 'Primary facility',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        isDefault: true,
      });

      expect(warehouse).toBeDefined();
      expect(warehouse.id).toBeDefined();
      expect(warehouse.organizationId).toBe(orgAId);
      expect(warehouse.code).toBe('WH-MAIN');
      expect(warehouse.name).toBe('Main Distribution Hub');
      expect(warehouse.isDefault).toBe(true);

      // Verify row exists directly in PostgreSQL
      const dbRow = await prisma.warehouse.findUnique({
        where: { id: warehouse.id },
      });
      expect(dbRow).not.toBeNull();
      expect(dbRow!.code).toBe('WH-MAIN');
    });

    it('2. Warehouse cannot reference nonexistent organization (FK constraint violation)', async () => {
      const nonExistentOrgId = '00000000-0000-4000-8000-000000000000';

      await expect(
        prisma.warehouse.create({
          data: {
            organizationId: nonExistentOrgId,
            name: 'Orphan Warehouse',
            code: 'WH-ORPHAN',
          },
        }),
      ).rejects.toThrow();
    });

    it('3. Warehouse code must be unique within the same organization (database unique constraint)', async () => {
      // Attempt to create duplicate code in Org A via service
      await expect(
        warehousesService.create(orgAId, userAId, {
          name: 'Secondary Facility',
          code: 'WH-MAIN', // duplicate of test 1
        }),
      ).rejects.toThrow(WarehouseDuplicateCodeException);

      // Attempt raw duplicate create in PostgreSQL to verify db constraint
      await expect(
        prisma.warehouse.create({
          data: {
            organizationId: orgAId,
            name: 'Raw Duplicate',
            code: 'WH-MAIN',
          },
        }),
      ).rejects.toThrow();
    });

    it('4. Same warehouse code can exist in different organizations (tenant scoping)', async () => {
      // Org B can create a warehouse with WH-MAIN
      const warehouseB = await warehousesService.create(orgBId, userBId, {
        name: 'Org B Main Warehouse',
        code: 'WH-MAIN',
        isDefault: true,
      });

      expect(warehouseB).toBeDefined();
      expect(warehouseB.organizationId).toBe(orgBId);
      expect(warehouseB.code).toBe('WH-MAIN');

      // Both rows exist concurrently in PostgreSQL
      const whA = await prisma.warehouse.findFirst({
        where: { organizationId: orgAId, code: 'WH-MAIN' },
      });
      const whB = await prisma.warehouse.findFirst({
        where: { organizationId: orgBId, code: 'WH-MAIN' },
      });

      expect(whA).not.toBeNull();
      expect(whB).not.toBeNull();
      expect(whA!.id).not.toEqual(whB!.id);
    });

    it('5. Equivalent normalized codes cannot bypass uniqueness', async () => {
      // " wh-main " normalizes to "WH-MAIN"
      await expect(
        warehousesService.create(orgAId, userAId, {
          name: 'Whitespace Variant',
          code: '  wh-main  ',
        }),
      ).rejects.toThrow(WarehouseDuplicateCodeException);
    });

    it('6. Organization scoping works for queries', async () => {
      const orgAResults = await warehousesService.findAll(orgAId);
      const orgBResults = await warehousesService.findAll(orgBId);

      expect(orgAResults.data.every((w) => w.organizationId === orgAId)).toBe(true);
      expect(orgBResults.data.every((w) => w.organizationId === orgBId)).toBe(true);
    });

    it('7. Tenant-safe lookup behavior (cross-tenant access rejected)', async () => {
      const whA = await prisma.warehouse.findFirst({
        where: { organizationId: orgAId, code: 'WH-MAIN' },
      });

      // Querying Org A's warehouse using Org B's context throws NotFound (IDOR protected)
      await expect(warehousesService.findById(whA!.id, orgBId)).rejects.toThrow(
        WarehouseNotFoundException,
      );

      await expect(warehousesService.findOne(whA!.id, orgBId)).rejects.toThrow(
        WarehouseNotFoundException,
      );

      // Querying with Org A succeeds
      const result = await warehousesService.findById(whA!.id, orgAId);
      expect(result.id).toBe(whA!.id);
    });

    it('8. Organization deletion cascades and removes child warehouses', async () => {
      // Create temporary organization and warehouse
      const tempOrg = await prisma.organization.create({
        data: {
          slug: `wh-temp-org-${Date.now()}`,
          name: 'Temp Org for Cascade Test',
        },
      });

      const tempWarehouse = await prisma.warehouse.create({
        data: {
          organizationId: tempOrg.id,
          name: 'Temp Cascade Warehouse',
          code: 'WH-CASCADE',
        },
      });

      // Delete parent organization
      await prisma.organization.delete({
        where: { id: tempOrg.id },
      });

      // Child warehouse should have been cascade deleted
      const deletedWarehouse = await prisma.warehouse.findUnique({
        where: { id: tempWarehouse.id },
      });
      expect(deletedWarehouse).toBeNull();
    });

    it('9. Database constraints reject invalid relationships and support future stock composite keys', async () => {
      // Warehouse schema enforces @@unique([organizationId, id])
      // Test querying by compound tenant key
      const whA = await prisma.warehouse.findFirst({
        where: { organizationId: orgAId, code: 'WH-MAIN' },
      });

      const compoundLookup = await prisma.warehouse.findUnique({
        where: {
          organizationId_id: {
            organizationId: orgAId,
            id: whA!.id,
          },
        },
      });

      expect(compoundLookup).not.toBeNull();
      expect(compoundLookup!.id).toBe(whA!.id);
    });

    it('10. Relevant indexes and constraints exist in PostgreSQL', async () => {
      // Query PostgreSQL system catalogs to verify indexes on Warehouse
      const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'Warehouse'
      `;

      const indexDefs = indexes.map((idx) => idx.indexdef);

      // Verify composite uniqueness on (organizationId, code)
      expect(indexDefs.some((def) => def.includes('organizationId') && def.includes('code'))).toBe(
        true,
      );

      // Verify composite uniqueness on (organizationId, id)
      expect(indexDefs.some((def) => def.includes('organizationId') && def.includes('id'))).toBe(
        true,
      );

      // Verify composite uniqueness on (organizationId, name)
      expect(indexDefs.some((def) => def.includes('organizationId') && def.includes('name'))).toBe(
        true,
      );

      // Verify index on (organizationId, status)
      expect(
        indexDefs.some((def) => def.includes('organizationId') && def.includes('status')),
      ).toBe(true);
    });
  });

  describe('Service Invariants & Audit Trail', () => {
    it('should prevent deleting the default warehouse', async () => {
      const whA = await prisma.warehouse.findFirst({
        where: { organizationId: orgAId, isDefault: true },
      });

      await expect(warehousesService.delete(whA!.id, orgAId, userAId)).rejects.toThrow(
        WarehouseDeleteConflictException,
      );
    });

    it('should create audit log entries for warehouse mutations', async () => {
      const auditRecords = await prisma.auditEvent.findMany({
        where: {
          organizationId: orgAId,
          entityType: 'Warehouse',
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords.some((a) => a.action === 'warehouse.created')).toBe(true);
    });
  });
});
