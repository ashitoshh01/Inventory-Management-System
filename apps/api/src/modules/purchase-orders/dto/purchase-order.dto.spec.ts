import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
} from './purchase-order.dto';

describe('PurchaseOrderDto (Unit)', () => {
  describe('CreatePurchaseOrderDto', () => {
    const validPayload = {
      purchaseOrderNumber: 'PO-2026-001',
      supplierName: 'Acme Industrial',
      supplierEmail: 'vendor@acme.com',
      warehouseId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      currency: 'INR',
      lines: [
        {
          productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          quantity: '10.5000',
          unitPrice: '120.0000',
          notes: 'Standard batch',
        },
      ],
    };

    it('passes validation with completely valid payload', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when purchaseOrderNumber is missing or invalid', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        purchaseOrderNumber: 'Invalid Number with Spaces!',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'purchaseOrderNumber')).toBe(true);
    });

    it('fails when warehouseId is not a valid UUIDv4', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        warehouseId: 'not-a-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'warehouseId')).toBe(true);
    });

    it('fails when lines array is empty', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        lines: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'lines')).toBe(true);
    });

    it('fails when quantity has more than 4 decimal places', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        lines: [
          {
            productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            quantity: '10.12345',
            unitPrice: '100.0000',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const lineErrors = errors.find((e) => e.property === 'lines');
      expect(lineErrors).toBeDefined();
    });

    it('fails when quantity is zero or negative', async () => {
      const dtoZero = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        lines: [
          {
            productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            quantity: '0.0000',
            unitPrice: '100.0000',
          },
        ],
      });
      const errorsZero = await validate(dtoZero);
      expect(errorsZero.length).toBeGreaterThan(0);

      const dtoNegative = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        lines: [
          {
            productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            quantity: '-5.0000',
            unitPrice: '100.0000',
          },
        ],
      });
      const errorsNegative = await validate(dtoNegative);
      expect(errorsNegative.length).toBeGreaterThan(0);
    });

    it('fails when unitPrice is negative', async () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        ...validPayload,
        lines: [
          {
            productId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            quantity: '5.0000',
            unitPrice: '-10.0000',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdatePurchaseOrderDto', () => {
    it('passes validation when updating partial permitted fields', async () => {
      const dto = plainToInstance(UpdatePurchaseOrderDto, {
        supplierName: 'Updated Supplier Ltd',
        notes: 'Updated note',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails if invalid warehouseId format is provided', async () => {
      const dto = plainToInstance(UpdatePurchaseOrderDto, {
        warehouseId: 'invalid-id',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'warehouseId')).toBe(true);
    });
  });

  describe('QueryPurchaseOrderDto', () => {
    it('defaults safeSortBy to createdAt when sortBy is omitted', () => {
      const dto = new QueryPurchaseOrderDto();
      expect(dto.getSafeSortBy()).toBe('createdAt');
    });

    it('allows valid sort fields', () => {
      const dto = new QueryPurchaseOrderDto();
      dto.sortBy = 'grandTotal';
      expect(dto.getSafeSortBy()).toBe('grandTotal');
    });

    it('reverts unrecognized sort fields to default createdAt', () => {
      const dto = new QueryPurchaseOrderDto();
      (dto as unknown as { sortBy: string }).sortBy = 'nonExistentField';
      expect(dto.getSafeSortBy()).toBe('createdAt');
    });
  });
});
