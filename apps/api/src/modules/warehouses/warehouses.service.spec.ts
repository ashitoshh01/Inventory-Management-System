import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import {
  WarehouseNotFoundException,
  WarehouseDuplicateNameException,
  WarehouseDuplicateCodeException,
  WarehouseDeleteConflictException,
} from './warehouses.errors';
import { WarehouseQueryParams } from '@repo/types';

describe('WarehousesService (Unit)', () => {
  let service: WarehousesService;
  let prisma: {
    warehouse: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
    $executeRaw?: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const orgA = 'org-tenant-a-1111';
  const orgB = 'org-tenant-b-2222';
  const actorUser = 'user-admin-1234';

  const mockWarehouse = {
    id: 'wh-uuid-1',
    organizationId: orgA,
    name: 'Central Hub',
    code: 'WH-CENTRAL',
    description: 'Main distribution',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    status: 'ACTIVE',
    isDefault: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  describe('create', () => {
    it('should create warehouse and mark as default if first warehouse for organization', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);
      prisma.warehouse.count.mockResolvedValue(0);
      prisma.warehouse.create.mockResolvedValue(mockWarehouse);

      const result = await service.create(
        orgA,
        actorUser,
        {
          name: 'Central Hub',
          code: 'wh-central',
          city: 'Mumbai',
        },
        'req-1',
      );

      expect(result.id).toBe('wh-uuid-1');
      expect(result.code).toBe('WH-CENTRAL');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.warehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgA,
            name: 'Central Hub',
            code: 'WH-CENTRAL',
            isDefault: true,
          }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'warehouse.created',
          entityType: 'Warehouse',
          entityId: 'wh-uuid-1',
        }),
      );
    });

    it('should reset other defaults when creating a new default warehouse', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);
      prisma.warehouse.count.mockResolvedValue(2);
      prisma.warehouse.create.mockResolvedValue({
        ...mockWarehouse,
        id: 'wh-uuid-2',
        code: 'WH-WEST',
        name: 'West Depot',
        isDefault: true,
      });

      const result = await service.create(orgA, actorUser, {
        name: 'West Depot',
        code: 'WH-WEST',
        isDefault: true,
      });

      expect(result.id).toBe('wh-uuid-2');
      expect(prisma.warehouse.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgA, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should reject creation on duplicate name within same organization', async () => {
      prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse);

      await expect(
        service.create(orgA, actorUser, {
          name: 'central hub',
          code: 'WH-NEW',
        }),
      ).rejects.toThrow(WarehouseDuplicateNameException);
    });

    it('should reject creation on duplicate code within same organization', async () => {
      prisma.warehouse.findFirst
        .mockResolvedValueOnce(null) // name check passes
        .mockResolvedValueOnce(mockWarehouse); // code check fails

      await expect(
        service.create(orgA, actorUser, {
          name: 'Different Name',
          code: 'WH-CENTRAL',
        }),
      ).rejects.toThrow(WarehouseDuplicateCodeException);
    });

    it('should allow same name and code across different organizations (tenant isolation)', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null); // Not found in Org B
      prisma.warehouse.count.mockResolvedValue(0);
      prisma.warehouse.create.mockResolvedValue({
        ...mockWarehouse,
        organizationId: orgB,
      });

      const result = await service.create(orgB, actorUser, {
        name: 'Central Hub',
        code: 'WH-CENTRAL',
      });

      expect(result.organizationId).toBe(orgB);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: orgB,
          name: { equals: 'Central Hub', mode: 'insensitive' },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated list scoped to organizationId', async () => {
      prisma.warehouse.count.mockResolvedValue(1);
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);

      const query: WarehouseQueryParams = {
        page: 1,
        limit: 10,
        search: 'Hub',
      };

      const result = await service.findAll(orgA, query);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgA,
            OR: expect.arrayContaining([{ name: { contains: 'Hub', mode: 'insensitive' } }]),
          }),
        }),
      );
    });
  });

  describe('findOne & findById', () => {
    it('should return warehouse if belongs to organization', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      const result = await service.findOne('wh-uuid-1', orgA);
      expect(result.id).toBe('wh-uuid-1');
      expect(result.organizationId).toBe(orgA);
    });

    it('should alias findById to findOne', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      const result = await service.findById('wh-uuid-1', orgA);
      expect(result.id).toBe('wh-uuid-1');
      expect(result.organizationId).toBe(orgA);
    });

    it('should throw WarehouseNotFoundException when looking up another tenant warehouse (IDOR)', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.findOne('wh-uuid-1', orgB)).rejects.toThrow(WarehouseNotFoundException);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'wh-uuid-1',
          organizationId: orgB,
        },
      });
    });
  });

  describe('findByCode', () => {
    it('should find warehouse by code within tenant', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      const result = await service.findByCode('wh-central', orgA);
      expect(result.code).toBe('WH-CENTRAL');
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'WH-CENTRAL',
          organizationId: orgA,
        },
      });
    });
  });

  describe('update', () => {
    it('should update warehouse details and log audit event', async () => {
      prisma.warehouse.findFirst.mockResolvedValueOnce(mockWarehouse); // existing lookup
      prisma.warehouse.update.mockResolvedValue({
        ...mockWarehouse,
        description: 'Updated description',
      });

      const result = await service.update(
        'wh-uuid-1',
        orgA,
        actorUser,
        { description: 'Updated description' },
        'req-upd',
      );

      expect(result.description).toBe('Updated description');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'warehouse.updated',
          entityId: 'wh-uuid-1',
        }),
      );
    });

    it('should throw WarehouseNotFoundException on updating non-existent or cross-tenant warehouse', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.update('wh-uuid-1', orgB, actorUser, { name: 'New Name' }),
      ).rejects.toThrow(WarehouseNotFoundException);
    });

    it('should reject update if new name duplicates another warehouse in organization', async () => {
      prisma.warehouse.findFirst
        .mockResolvedValueOnce(mockWarehouse) // existing lookup
        .mockResolvedValueOnce({ id: 'wh-uuid-2', name: 'Existing Depot' }); // collision

      await expect(
        service.update('wh-uuid-1', orgA, actorUser, { name: 'Existing Depot' }),
      ).rejects.toThrow(WarehouseDuplicateNameException);
    });
  });

  describe('delete', () => {
    it('should reject deleting a default warehouse', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({
        ...mockWarehouse,
        isDefault: true,
      });

      await expect(service.delete('wh-uuid-1', orgA, actorUser)).rejects.toThrow(
        WarehouseDeleteConflictException,
      );
      expect(prisma.warehouse.delete).not.toHaveBeenCalled();
    });

    it('should delete non-default warehouse and log audit event', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({
        ...mockWarehouse,
        isDefault: false,
      });
      prisma.warehouse.delete.mockResolvedValue(mockWarehouse);

      await service.delete('wh-uuid-1', orgA, actorUser, 'req-del');

      expect(prisma.warehouse.delete).toHaveBeenCalledWith({
        where: { id: 'wh-uuid-1' },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'warehouse.deleted',
          entityId: 'wh-uuid-1',
        }),
      );
    });

    it('should throw WarehouseNotFoundException when deleting cross-tenant warehouse', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.delete('wh-uuid-1', orgB, actorUser)).rejects.toThrow(
        WarehouseNotFoundException,
      );
    });
  });
});
