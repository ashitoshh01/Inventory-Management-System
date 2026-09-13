import { PrismaService } from '@repo/database';
import { SalesOrdersValidator } from './sales-orders.validator';
import {
  SalesOrderCustomerNotFoundException,
  SalesOrderLineValidationException,
  SalesOrderProductNotFoundException,
  SalesOrderWarehouseNotFoundException,
} from './sales-orders.errors';
import { CreateSalesOrderDto } from './dto/sales-order.dto';

describe('SalesOrdersValidator', () => {
  const mockPrisma = {
    warehouse: {
      findFirst: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCreate', () => {
    const validDto: CreateSalesOrderDto = {
      salesOrderNumber: 'SO-001',
      customerName: 'Customer A',
      warehouseId: 'wh-1',
      lines: [
        { productId: 'prod-1', quantity: '2.5000', unitPrice: '10.0000' },
        { productId: 'prod-2', quantity: '1.0000', unitPrice: '15.5000' },
      ],
    };

    it('successfully validates and calculates totals', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        name: 'Main WH',
        status: 'ACTIVE',
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget', status: 'ACTIVE' },
        { id: 'prod-2', name: 'Gadget', status: 'ACTIVE' },
      ]);

      const res = await SalesOrdersValidator.validateCreate(
        mockPrisma as unknown as PrismaService,
        'org-1',
        validDto,
      );

      // line 1: 2.5000 * 10.0000 = 25.0000
      // line 2: 1.0000 * 15.5000 = 15.5000
      // subtotal = 40.5000, grandTotal = 40.5000
      expect(res.subtotal).toBe('40.5000');
      expect(res.taxTotal).toBe('0.0000');
      expect(res.grandTotal).toBe('40.5000');
      expect(res.lines).toHaveLength(2);
      expect(res.lines[0]?.lineTotal).toBe('25.0000');
      expect(res.lines[1]?.lineTotal).toBe('15.5000');
    });

    it('throws when warehouse is not found', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        SalesOrdersValidator.validateCreate(
          mockPrisma as unknown as PrismaService,
          'org-1',
          validDto,
        ),
      ).rejects.toThrow(SalesOrderWarehouseNotFoundException);
    });

    it('throws when customer is not found', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        name: 'Main WH',
        status: 'ACTIVE',
      });
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        SalesOrdersValidator.validateCreate(
          mockPrisma as unknown as PrismaService,
          'org-1',
          { ...validDto, customerId: 'cust-99' },
        ),
      ).rejects.toThrow(SalesOrderCustomerNotFoundException);
    });

    it('throws when product is not found', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        name: 'Main WH',
        status: 'ACTIVE',
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget', status: 'ACTIVE' },
      ]); // prod-2 missing

      await expect(
        SalesOrdersValidator.validateCreate(
          mockPrisma as unknown as PrismaService,
          'org-1',
          validDto,
        ),
      ).rejects.toThrow(SalesOrderProductNotFoundException);
    });

    it('throws when duplicate products are in lines', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        name: 'Main WH',
        status: 'ACTIVE',
      });

      const duplicateDto: CreateSalesOrderDto = {
        ...validDto,
        lines: [
          { productId: 'prod-1', quantity: '1.0000', unitPrice: '10.0000' },
          { productId: 'prod-1', quantity: '2.0000', unitPrice: '10.0000' },
        ],
      };

      await expect(
        SalesOrdersValidator.validateCreate(
          mockPrisma as unknown as PrismaService,
          'org-1',
          duplicateDto,
        ),
      ).rejects.toThrow(SalesOrderLineValidationException);
    });
  });
});
