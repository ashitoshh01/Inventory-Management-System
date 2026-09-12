import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import {
  ProductNotFoundException,
  ProductDuplicateSkuException,
  InvalidCategoryReferenceException,
  ProductValidationException,
  ProductDeleteConflictException,
} from './products.errors';
import { QueryProductDto } from './dto/product.dto';

describe('ProductsService (Unit)', () => {
  let service: ProductsService;
  let prisma: {
    category: {
      findFirst: jest.Mock;
    };
    product: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let auditService: {
    logEvent: jest.Mock;
  };

  const orgId = 'org-uuid-1';
  const userId = 'user-uuid-1';
  const categoryId = 'cat-uuid-1';
  const productId = 'prod-uuid-1';

  const mockCategory = {
    id: categoryId,
    organizationId: orgId,
    name: 'Electronics',
    description: 'Gadgets and parts',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockProduct = {
    id: productId,
    organizationId: orgId,
    categoryId,
    name: 'Wireless Mouse',
    sku: 'WM-001',
    description: 'Ergonomic 2.4GHz mouse',
    unitOfMeasure: 'UNIT' as const,
    status: 'ACTIVE' as const,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    category: mockCategory,
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findFirst: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    auditService = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('should create product, normalize SKU, apply defaults, and log audit event', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(
        orgId,
        userId,
        {
          categoryId,
          name: '  Wireless Mouse  ',
          sku: '  wm-001  ',
          description: 'Ergonomic 2.4GHz mouse',
        },
        'req-999',
      );

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: categoryId, organizationId: orgId },
      });
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, sku: 'WM-001' },
      });
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          categoryId,
          name: 'Wireless Mouse',
          sku: 'WM-001',
          description: 'Ergonomic 2.4GHz mouse',
          unitOfMeasure: 'UNIT',
          status: 'ACTIVE',
        },
        include: { category: true },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'product.created',
        entityType: 'Product',
        entityId: productId,
        metadata: {
          sku: 'WM-001',
          name: 'Wireless Mouse',
          categoryId,
          unitOfMeasure: 'UNIT',
          status: 'ACTIVE',
        },
        requestId: 'req-999',
      });
      expect(result.id).toBe(productId);
      expect(result.sku).toBe('WM-001');
      expect(result.category?.name).toBe('Electronics');
    });

    it('should create product with explicit unitOfMeasure and status', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        ...mockProduct,
        unitOfMeasure: 'KG',
        status: 'INACTIVE',
      });

      const result = await service.create(orgId, userId, {
        categoryId,
        name: 'Bulk Resin',
        sku: 'RESIN-KG',
        unitOfMeasure: 'KG',
        status: 'INACTIVE',
      });

      expect(result.unitOfMeasure).toBe('KG');
      expect(result.status).toBe('INACTIVE');
    });

    it('should throw InvalidCategoryReferenceException if organizationId is missing', async () => {
      await expect(
        service.create('', userId, {
          categoryId,
          name: 'Test',
          sku: 'SKU-1',
        }),
      ).rejects.toThrow(InvalidCategoryReferenceException);
    });

    it('should throw InvalidCategoryReferenceException if categoryId is missing', async () => {
      await expect(
        service.create(orgId, userId, {
          categoryId: '',
          name: 'Test',
          sku: 'SKU-1',
        }),
      ).rejects.toThrow(InvalidCategoryReferenceException);
    });

    it('should throw InvalidCategoryReferenceException if category not found in tenant organization', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, userId, {
          categoryId: 'foreign-cat-id',
          name: 'Test',
          sku: 'SKU-1',
        }),
      ).rejects.toThrow(InvalidCategoryReferenceException);
    });

    it('should throw ProductDuplicateSkuException if SKU already exists in organization', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.product.findFirst.mockResolvedValue(mockProduct);

      await expect(
        service.create(orgId, userId, {
          categoryId,
          name: 'Another Mouse',
          sku: 'WM-001',
        }),
      ).rejects.toThrow(ProductDuplicateSkuException);
    });

    it('should catch Prisma P2003 foreign key violation and throw InvalidCategoryReferenceException', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockRejectedValue({ code: 'P2003' });

      await expect(
        service.create(orgId, userId, {
          categoryId,
          name: 'Widget',
          sku: 'WIDGET-01',
        }),
      ).rejects.toThrow(InvalidCategoryReferenceException);
    });

    it('should catch Prisma P2002 unique constraint violation and throw ProductDuplicateSkuException', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create(orgId, userId, {
          categoryId,
          name: 'Widget',
          sku: 'WIDGET-01',
        }),
      ).rejects.toThrow(ProductDuplicateSkuException);
    });

    it('should throw ProductValidationException if SKU is invalid', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await expect(
        service.create(orgId, userId, {
          categoryId,
          name: 'Widget',
          sku: 'BAD SKU WITH SPACES',
        }),
      ).rejects.toThrow(ProductValidationException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of products with metadata', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const query = new QueryProductDto();
      query.page = 1;
      query.limit = 10;

      const result = await service.findAll(orgId, query, 'req-all-1');

      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { organizationId: orgId },
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(productId);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.requestId).toBe('req-all-1');
    });

    it('should apply search, categoryId, status, and unitOfMeasure filters safely', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const query = new QueryProductDto();
      query.search = 'mouse';
      query.categoryId = categoryId;
      query.status = 'ACTIVE';
      query.unitOfMeasure = 'UNIT';
      query.sortBy = 'name';
      query.sortOrder = 'asc';

      await service.findAll(orgId, query);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: orgId,
            categoryId,
            status: 'ACTIVE',
            unitOfMeasure: 'UNIT',
            OR: [
              { name: { contains: 'mouse', mode: 'insensitive' } },
              { sku: { contains: 'mouse', mode: 'insensitive' } },
              { description: { contains: 'mouse', mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findOne & findById', () => {
    it('findOne should return formatted product if found in organization', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.findOne(productId, orgId);

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: productId, organizationId: orgId },
        include: { category: true },
      });
      expect(result.id).toBe(productId);
    });

    it('findOne should throw ProductNotFoundException if not found or cross-tenant', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing-id', orgId)).rejects.toThrow(ProductNotFoundException);
    });

    it('findById should return null if not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      const result = await service.findById('non-existent', orgId);

      expect(result).toBeNull();
    });
  });

  describe('getBySku & findBySku', () => {
    it('getBySku should normalize SKU and return formatted product if found', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.getBySku('  wm-001  ', orgId);

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, sku: 'WM-001' },
        include: { category: true },
      });
      expect(result.id).toBe(productId);
    });

    it('getBySku should throw ProductNotFoundException if SKU not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getBySku('NOT-FOUND', orgId)).rejects.toThrow(ProductNotFoundException);
    });
  });

  describe('update', () => {
    it('should update product fields and log audit event', async () => {
      prisma.product.findFirst.mockResolvedValueOnce(mockProduct); // Existing product
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        name: 'Ergonomic Mouse Pro',
      });

      const result = await service.update(
        productId,
        orgId,
        userId,
        { name: '  Ergonomic Mouse Pro  ' },
        'req-upd-1',
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { name: 'Ergonomic Mouse Pro' },
        include: { category: true },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'product.updated',
        entityType: 'Product',
        entityId: productId,
        metadata: {
          changedFields: ['name'],
        },
        requestId: 'req-upd-1',
      });
      expect(result.name).toBe('Ergonomic Mouse Pro');
    });

    it('should validate category ownership when reassigning category', async () => {
      prisma.product.findFirst.mockResolvedValueOnce(mockProduct); // Existing product
      prisma.category.findFirst.mockResolvedValueOnce(null); // Category not in org

      await expect(
        service.update(productId, orgId, userId, { categoryId: 'foreign-cat' }),
      ).rejects.toThrow(InvalidCategoryReferenceException);
    });

    it('should check duplicate SKU when updating SKU', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce(mockProduct) // Existing product
        .mockResolvedValueOnce({ id: 'other-prod', sku: 'WM-002' }); // Duplicate SKU exists

      await expect(service.update(productId, orgId, userId, { sku: 'WM-002' })).rejects.toThrow(
        ProductDuplicateSkuException,
      );
    });

    it('should throw ProductNotFoundException if updating product not in organization', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.update('missing', orgId, userId, { name: 'Test' })).rejects.toThrow(
        ProductNotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete product and log audit event', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);
      prisma.product.delete.mockResolvedValue(mockProduct);

      const result = await service.delete(productId, orgId, userId, 'req-del-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith({
        organizationId: orgId,
        actorUserId: userId,
        action: 'product.deleted',
        entityType: 'Product',
        entityId: productId,
        metadata: {
          sku: mockProduct.sku,
          name: mockProduct.name,
        },
        requestId: 'req-del-1',
      });
      expect(result.message).toBe('Product deleted successfully');
      expect(result.id).toBe(productId);
    });

    it('should throw ProductNotFoundException if product not found in organization', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.delete('missing', orgId, userId)).rejects.toThrow(
        ProductNotFoundException,
      );
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('should catch P2003 referential conflict and throw ProductDeleteConflictException', async () => {
      prisma.product.findFirst.mockResolvedValue(mockProduct);
      prisma.product.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete(productId, orgId, userId)).rejects.toThrow(
        ProductDeleteConflictException,
      );
    });
  });
});
