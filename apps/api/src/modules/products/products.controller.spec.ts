import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Organization, User } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

describe('ProductsController (Unit)', () => {
  let controller: ProductsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    getBySku: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const mockOrg: Organization = {
    id: 'org-uuid-1',
    slug: 'test-org',
    name: 'Test Org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = { id: 'req-corr-123' } as RequestWithId;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getBySku: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('create() should delegate to productsService.create with tenant context', async () => {
    const dto: CreateProductDto = {
      sku: 'SKU-100',
      name: 'Product 100',
      categoryId: 'cat-uuid-1',
    };
    const expected = { id: 'prod-uuid-1', ...dto };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(mockOrg, mockUser, dto, mockReq);

    expect(service.create).toHaveBeenCalledWith(mockOrg.id, mockUser.id, dto, mockReq.id);
    expect(result).toEqual(expected);
  });

  it('findAll() should delegate to productsService.findAll with query and correlation ID', async () => {
    const query = new QueryProductDto();
    const expected = {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(mockOrg, query, mockReq);

    expect(service.findAll).toHaveBeenCalledWith(mockOrg.id, query, mockReq.id);
    expect(result).toEqual(expected);
  });

  it('findBySku() should delegate to productsService.getBySku', async () => {
    const expected = { id: 'prod-uuid-1', sku: 'SKU-100' };
    service.getBySku.mockResolvedValue(expected);

    const result = await controller.findBySku('SKU-100', mockOrg);

    expect(service.getBySku).toHaveBeenCalledWith('SKU-100', mockOrg.id);
    expect(result).toEqual(expected);
  });

  it('findOne() should delegate to productsService.findOne', async () => {
    const expected = { id: 'prod-uuid-1', name: 'Product 1' };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne('prod-uuid-1', mockOrg);

    expect(service.findOne).toHaveBeenCalledWith('prod-uuid-1', mockOrg.id);
    expect(result).toEqual(expected);
  });

  it('update() should delegate to productsService.update with actor and tenant context', async () => {
    const dto: UpdateProductDto = { name: 'New Name' };
    const expected = { id: 'prod-uuid-1', name: 'New Name' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update('prod-uuid-1', mockOrg, mockUser, dto, mockReq);

    expect(service.update).toHaveBeenCalledWith(
      'prod-uuid-1',
      mockOrg.id,
      mockUser.id,
      dto,
      mockReq.id,
    );
    expect(result).toEqual(expected);
  });

  it('delete() should delegate to productsService.delete with actor and tenant context', async () => {
    const expected = { message: 'Product deleted successfully', id: 'prod-uuid-1' };
    service.delete.mockResolvedValue(expected);

    const result = await controller.delete('prod-uuid-1', mockOrg, mockUser, mockReq);

    expect(service.delete).toHaveBeenCalledWith('prod-uuid-1', mockOrg.id, mockUser.id, mockReq.id);
    expect(result).toEqual(expected);
  });
});
