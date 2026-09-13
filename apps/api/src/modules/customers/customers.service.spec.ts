import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from './customers.service';
import { CustomerNotFoundException, CustomerHasActiveOrdersException } from './customers.errors';
import { CustomerQueryDto } from './dto/customer.dto';

describe('CustomersService', () => {
  let service: CustomersService;

  const mockPrisma = {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    salesOrder: {
      count: jest.fn(),
    },
  };

  const mockAudit = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('create', () => {
    it('creates a customer and emits audit event', async () => {
      const mockCustomer = {
        id: 'cust-1',
        organizationId: 'org-1',
        name: 'Acme Retail',
        email: 'acme@example.com',
        phone: '1234567890',
        address: '123 Main St',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create('org-1', {
        name: '  Acme Retail  ',
        email: ' ACME@example.com ',
        phone: '1234567890',
        address: '123 Main St',
      }, 'user-1');

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          name: 'Acme Retail',
          email: 'acme@example.com',
          phone: '1234567890',
          address: '123 Main St',
          status: 'ACTIVE',
        },
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          actorUserId: 'user-1',
          action: 'customer.created',
          entityType: 'Customer',
        }),
      );
      expect(result.id).toBe('cust-1');
      expect(result.name).toBe('Acme Retail');
    });
  });

  describe('findAll', () => {
    it('returns paginated customers with correct filters', async () => {
      mockPrisma.customer.count.mockResolvedValue(1);
      mockPrisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust-1',
          organizationId: 'org-1',
          name: 'Acme',
          email: null,
          phone: null,
          address: null,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const query = new CustomerQueryDto();
      query.page = 1;
      query.limit = 10;
      query.search = 'Acme';

      const res = await service.findAll('org-1', query);

      expect(res.meta.total).toBe(1);
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.name).toBe('Acme');
    });
  });

  describe('findOne', () => {
    it('throws CustomerNotFoundException when not found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'invalid-id')).rejects.toThrow(
        CustomerNotFoundException,
      );
    });

    it('returns customer when found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.findOne('org-1', 'cust-1');
      expect(res.id).toBe('cust-1');
    });
  });

  describe('remove', () => {
    it('blocks deletion if customer has sales orders', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.salesOrder.count.mockResolvedValue(2);

      await expect(service.remove('org-1', 'cust-1')).rejects.toThrow(
        CustomerHasActiveOrdersException,
      );
    });

    it('deletes customer cleanly if no sales orders exist', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.salesOrder.count.mockResolvedValue(0);
      mockPrisma.customer.delete.mockResolvedValue({});

      await service.remove('org-1', 'cust-1', 'user-1');

      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'customer.deleted' }),
      );
    });
  });
});
