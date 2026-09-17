import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehouseDto } from './dto/warehouse.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Organization, User } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

describe('WarehousesController (Unit)', () => {
  let controller: WarehousesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    findByCode: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const mockOrg: Organization = {
    id: 'org-uuid-test',
    slug: 'test-org',
    name: 'Test Org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-uuid-test',
    email: 'test@example.com',
    passwordHash: 'hash',
    isActive: true,
    isPlatformAdmin: false,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = { id: 'req-corr-999' } as RequestWithId;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [{ provide: WarehousesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WarehousesController>(WarehousesController);
  });

  it('create() should delegate to warehousesService.create with tenant context', async () => {
    const dto: CreateWarehouseDto = {
      name: 'Main Hub',
      code: 'WH-MAIN',
      city: 'Mumbai',
    };

    const expectedResult = {
      id: 'wh-123',
      organizationId: mockOrg.id,
      ...dto,
    };
    service.create.mockResolvedValue(expectedResult);

    const result = await controller.create(mockOrg, mockUser, dto, mockReq);

    expect(service.create).toHaveBeenCalledWith(mockOrg.id, mockUser.id, dto, mockReq.id);
    expect(result).toBe(expectedResult);
  });

  it('findAll() should delegate to warehousesService.findAll with query parameters and correlation ID', async () => {
    const query: QueryWarehouseDto = {
      page: 1,
      limit: 10,
      search: 'main',
      getSkip: () => 0,
      getTake: () => 10,
      getSafeSortBy: () => 'createdAt',
    };

    const expectedResult = {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    service.findAll.mockResolvedValue(expectedResult);

    const result = await controller.findAll(mockOrg, query, mockReq);

    expect(service.findAll).toHaveBeenCalledWith(mockOrg.id, query, mockReq.id);
    expect(result).toBe(expectedResult);
  });

  it('findByCode() should delegate to warehousesService.findByCode with tenant scope', async () => {
    const code = 'WH-MAIN';
    const expectedResult = { id: 'wh-123', code, organizationId: mockOrg.id };
    service.findByCode.mockResolvedValue(expectedResult);

    const result = await controller.findByCode(code, mockOrg);

    expect(service.findByCode).toHaveBeenCalledWith(code, mockOrg.id);
    expect(result).toBe(expectedResult);
  });

  it('findOne() should delegate to warehousesService.findOne with tenant scope', async () => {
    const warehouseId = 'wh-uuid-456';
    const expectedResult = { id: warehouseId, organizationId: mockOrg.id };
    service.findOne.mockResolvedValue(expectedResult);

    const result = await controller.findOne(warehouseId, mockOrg);

    expect(service.findOne).toHaveBeenCalledWith(warehouseId, mockOrg.id);
    expect(result).toBe(expectedResult);
  });

  it('update() should delegate to warehousesService.update with tenant and user context', async () => {
    const warehouseId = 'wh-uuid-456';
    const dto: UpdateWarehouseDto = {
      name: 'Updated Hub',
    };
    const expectedResult = { id: warehouseId, name: 'Updated Hub' };
    service.update.mockResolvedValue(expectedResult);

    const result = await controller.update(warehouseId, mockOrg, mockUser, dto, mockReq);

    expect(service.update).toHaveBeenCalledWith(
      warehouseId,
      mockOrg.id,
      mockUser.id,
      dto,
      mockReq.id,
    );
    expect(result).toBe(expectedResult);
  });

  it('delete() should delegate to warehousesService.delete with tenant and user context', async () => {
    const warehouseId = 'wh-uuid-456';
    service.delete.mockResolvedValue(undefined);

    await controller.delete(warehouseId, mockOrg, mockUser, mockReq);

    expect(service.delete).toHaveBeenCalledWith(warehouseId, mockOrg.id, mockUser.id, mockReq.id);
  });
});
