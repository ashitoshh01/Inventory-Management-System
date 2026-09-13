import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrdersController, SalesController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { CreateSalesOrderDto } from './dto/sales-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('SalesOrdersController', () => {
  let controller: SalesOrdersController;
  let salesController: SalesController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    submit: jest.fn(),
    approve: jest.fn(),
    confirm: jest.fn(),
    fulfill: jest.fn(),
    cancel: jest.fn(),
    getMetrics: jest.fn(),
    getAuditTrail: jest.fn(),
  };

  const mockOrg = {
    id: 'org-1',
    name: 'Acme Org',
    slug: 'acme',
  };

  const mockUser = {
    id: 'user-1',
    email: 'admin@test.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesOrdersController, SalesController],
      providers: [{ provide: SalesOrdersService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SalesOrdersController>(SalesOrdersController);
    salesController = module.get<SalesController>(SalesController);
  });

  it('delegates create to service', async () => {
    const dto: CreateSalesOrderDto = {
      salesOrderNumber: 'SO-1',
      customerName: 'Cust',
      warehouseId: 'wh-1',
      lines: [{ productId: 'p-1', quantity: '1.0000', unitPrice: '10.0000' }],
    };
    mockService.create.mockResolvedValue({ order: { id: 'so-1' }, isIdempotentReplay: false });

    const res = await controller.create(mockOrg as any, dto, mockUser as any, 'key-1');
    expect(mockService.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'key-1');
    expect(res.order.id).toBe('so-1');
  });

  it('delegates fulfill to service', async () => {
    mockService.fulfill.mockResolvedValue({ order: { id: 'so-1', status: 'FULFILLED' }, isIdempotentReplay: false });

    const res = await controller.fulfill(mockOrg as any, 'so-1', mockUser as any, 'idem-key');
    expect(mockService.fulfill).toHaveBeenCalledWith('org-1', 'so-1', 'user-1', 'idem-key');
    expect(res.order.status).toBe('FULFILLED');
  });

  it('delegates confirm to service on SalesController', async () => {
    mockService.confirm.mockResolvedValue({ id: 'so-1', status: 'APPROVED' });

    const res = await salesController.confirm(mockOrg as any, 'so-1', mockUser as any);
    expect(mockService.confirm).toHaveBeenCalledWith('org-1', 'so-1', 'user-1');
    expect(res.status).toBe('APPROVED');
  });
});
