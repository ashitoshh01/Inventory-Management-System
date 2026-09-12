import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import {
  CategoryNotFoundException,
  CategoryDuplicateException,
  CategoryDeleteConflictException,
} from './categories.errors';
import { QueryCategoryDto } from './dto/category.dto';

describe('CategoriesService (Unit)', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const orgId = 'org-uuid-1';
  const userId = 'user-uuid-1';
  const categoryId = 'cat-uuid-1';

  beforeEach(async () => {
    prisma = {
      category: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('create', () => {
    it('should create category and log audit event', async () => {
      prisma.category.findFirst.mockResolvedValue(null); // No duplicate
      const createdCategory = {
        id: categoryId,
        organizationId: orgId,
        name: 'Hardware',
        description: 'Tools & nuts',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create(
        orgId,
        userId,
        { name: 'Hardware', description: 'Tools & nuts' },
        'req-123',
      );

      expect(result.id).toBe(categoryId);
      expect(result.name).toBe('Hardware');
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Hardware',
          description: 'Tools & nuts',
        },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'category.created',
        entityType: 'Category',
        entityId: categoryId,
        metadata: { name: 'Hardware' },
        requestId: 'req-123',
      });
    });

    it('should reject case-insensitive duplicate in the same organization with CategoryDuplicateException', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'existing-cat',
        organizationId: orgId,
        name: 'Hardware',
      });

      await expect(service.create(orgId, userId, { name: 'hardware' })).rejects.toThrow(
        CategoryDuplicateException,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should query tenant-scoped categories with pagination and sorting', async () => {
      prisma.category.count.mockResolvedValue(1);
      prisma.category.findMany.mockResolvedValue([
        {
          id: categoryId,
          organizationId: orgId,
          name: 'Electronics',
          description: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const query = new QueryCategoryDto();
      query.page = 1;
      query.limit = 20;

      const result = await service.findAll(orgId, query, 'req-456');

      expect(result.data.length).toBe(1);
      expect(result.data[0]?.name).toBe('Electronics');
      expect(result.meta.total).toBe(1);
      expect(result.meta.requestId).toBe('req-456');
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
        }),
      );
    });

    it('should apply search filter if provided', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.category.findMany.mockResolvedValue([]);

      const query = new QueryCategoryDto();
      query.search = 'phone';

      await service.findAll(orgId, query);

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: orgId,
            name: { contains: 'phone', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return category when found within organization', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: categoryId,
        organizationId: orgId,
        name: 'Furniture',
        description: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.findOne(categoryId, orgId);
      expect(result.id).toBe(categoryId);
      expect(result.name).toBe('Furniture');
    });

    it('should throw CategoryNotFoundException if category belongs to another organization or does not exist', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(categoryId, orgId)).rejects.toThrow(CategoryNotFoundException);
    });
  });

  describe('update', () => {
    it('should update permitted fields and log audit event', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({
          id: categoryId,
          organizationId: orgId,
          name: 'Old Name',
          description: 'Old Desc',
          createdAt: new Date(),
          updatedAt: new Date(),
        }) // existing lookup
        .mockResolvedValueOnce(null); // duplicate check

      prisma.category.update.mockResolvedValue({
        id: categoryId,
        organizationId: orgId,
        name: 'New Name',
        description: 'New Desc',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.update(
        categoryId,
        orgId,
        userId,
        { name: 'New Name', description: 'New Desc' },
        'req-upd',
      );

      expect(result.name).toBe('New Name');
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { name: 'New Name', description: 'New Desc' },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'category.updated',
        entityType: 'Category',
        entityId: categoryId,
        metadata: { changedFields: ['name', 'description'] },
        requestId: 'req-upd',
      });
    });

    it('should throw CategoryDuplicateException if new name conflicts within tenant', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({
          id: categoryId,
          organizationId: orgId,
          name: 'Old Name',
        }) // existing
        .mockResolvedValueOnce({
          id: 'other-cat-uuid',
          organizationId: orgId,
          name: 'Existing Name',
        }); // duplicate found

      await expect(
        service.update(categoryId, orgId, userId, { name: 'Existing Name' }),
      ).rejects.toThrow(CategoryDuplicateException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('should throw CategoryNotFoundException if category to update is not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.update(categoryId, orgId, userId, { name: 'Name' })).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete category and log audit event', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: categoryId,
        organizationId: orgId,
        name: 'Deletable Category',
      });
      prisma.category.delete.mockResolvedValue({});

      const result = await service.delete(categoryId, orgId, userId, 'req-del');

      expect(result.id).toBe(categoryId);
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'category.deleted',
        entityType: 'Category',
        entityId: categoryId,
        metadata: { name: 'Deletable Category' },
        requestId: 'req-del',
      });
    });

    it('should throw CategoryDeleteConflictException if foreign key restriction (P2003) occurs', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: categoryId,
        organizationId: orgId,
        name: 'Referenced Category',
      });
      prisma.category.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete(categoryId, orgId, userId)).rejects.toThrow(
        CategoryDeleteConflictException,
      );
    });

    it('should throw CategoryNotFoundException if category to delete is not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.delete(categoryId, orgId, userId)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });
});
