import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderValidator } from './purchase-orders.validator';
import { PurchaseOrderInvalidLineException } from './purchase-orders.errors';

describe('PurchaseOrderValidator', () => {
  describe('validateOrderNumber', () => {
    it('accepts valid alphanumeric PO numbers with hyphens and underscores', () => {
      expect(PurchaseOrderValidator.validateOrderNumber('PO-2026-001')).toBe('PO-2026-001');
      expect(PurchaseOrderValidator.validateOrderNumber('PO_TEST_123')).toBe('PO_TEST_123');
      expect(PurchaseOrderValidator.validateOrderNumber('  PO-TRIM-01  ')).toBe('PO-TRIM-01');
    });

    it('rejects empty or whitespace-only PO number', () => {
      expect(() => PurchaseOrderValidator.validateOrderNumber('')).toThrow(BadRequestException);
      expect(() => PurchaseOrderValidator.validateOrderNumber('   ')).toThrow(BadRequestException);
    });

    it('rejects PO numbers exceeding maximum length', () => {
      const longNumber = 'A'.repeat(51);
      expect(() => PurchaseOrderValidator.validateOrderNumber(longNumber)).toThrow(
        BadRequestException,
      );
    });

    it('rejects PO numbers with illegal characters', () => {
      expect(() => PurchaseOrderValidator.validateOrderNumber('PO#123')).toThrow(
        BadRequestException,
      );
      expect(() => PurchaseOrderValidator.validateOrderNumber('PO 123')).toThrow(
        BadRequestException,
      );
      expect(() => PurchaseOrderValidator.validateOrderNumber('PO@123')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateSupplier', () => {
    it('accepts valid supplier name and email', () => {
      const result = PurchaseOrderValidator.validateSupplier(' Acme Corp ', ' Contact@Acme.Com ');
      expect(result.name).toBe('Acme Corp');
      expect(result.email).toBe('contact@acme.com');
    });

    it('accepts valid supplier name without email', () => {
      const result = PurchaseOrderValidator.validateSupplier('Acme Corp');
      expect(result.name).toBe('Acme Corp');
      expect(result.email).toBeNull();
    });

    it('rejects empty supplier name', () => {
      expect(() => PurchaseOrderValidator.validateSupplier('')).toThrow(BadRequestException);
      expect(() => PurchaseOrderValidator.validateSupplier('   ')).toThrow(BadRequestException);
    });

    it('rejects invalid supplier email format', () => {
      expect(() => PurchaseOrderValidator.validateSupplier('Acme Corp', 'invalid-email')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateDates', () => {
    it('defaults orderDate to current time when omitted', () => {
      const before = new Date();
      const result = PurchaseOrderValidator.validateDates();
      const after = new Date();
      expect(result.orderDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.orderDate.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.expectedDate).toBeNull();
    });

    it('accepts valid expectedDate after orderDate', () => {
      const orderDate = '2026-09-15T00:00:00.000Z';
      const expectedDate = '2026-09-20T00:00:00.000Z';
      const result = PurchaseOrderValidator.validateDates(orderDate, expectedDate);
      expect(result.orderDate.toISOString()).toBe(orderDate);
      expect(result.expectedDate?.toISOString()).toBe(expectedDate);
    });

    it('rejects expectedDate before orderDate', () => {
      const orderDate = '2026-09-20T00:00:00.000Z';
      const expectedDate = '2026-09-15T00:00:00.000Z';
      expect(() => PurchaseOrderValidator.validateDates(orderDate, expectedDate)).toThrow(
        BadRequestException,
      );
    });

    it('rejects malformed date strings', () => {
      expect(() => PurchaseOrderValidator.validateDates('not-a-date')).toThrow(BadRequestException);
      expect(() => PurchaseOrderValidator.validateDates('2026-09-01', 'malformed')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateQuantity', () => {
    it('accepts valid exact 4-decimal quantities', () => {
      expect(PurchaseOrderValidator.validateQuantity('10.0000')).toBe('10.0000');
      expect(PurchaseOrderValidator.validateQuantity('1.5')).toBe('1.5000');
      expect(PurchaseOrderValidator.validateQuantity('0.0001')).toBe('0.0001');
      expect(PurchaseOrderValidator.validateQuantity(5)).toBe('5.0000');
    });

    it('rejects quantities with more than 4 decimal places of non-zero precision', () => {
      expect(() => PurchaseOrderValidator.validateQuantity('1.00001')).toThrow(
        PurchaseOrderInvalidLineException,
      );
      expect(() => PurchaseOrderValidator.validateQuantity('0.12345')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });

    it('rejects zero quantity', () => {
      expect(() => PurchaseOrderValidator.validateQuantity('0')).toThrow(
        PurchaseOrderInvalidLineException,
      );
      expect(() => PurchaseOrderValidator.validateQuantity('0.0000')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });

    it('rejects negative quantity', () => {
      expect(() => PurchaseOrderValidator.validateQuantity('-5')).toThrow(
        PurchaseOrderInvalidLineException,
      );
      expect(() => PurchaseOrderValidator.validateQuantity('-0.0001')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });

    it('rejects non-numeric quantity', () => {
      expect(() => PurchaseOrderValidator.validateQuantity('abc')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });
  });

  describe('validateUnitPrice', () => {
    it('accepts valid non-negative unit prices', () => {
      expect(PurchaseOrderValidator.validateUnitPrice('25.5000')).toBe('25.5000');
      expect(PurchaseOrderValidator.validateUnitPrice('100')).toBe('100.0000');
      expect(PurchaseOrderValidator.validateUnitPrice('0')).toBe('0.0000');
      expect(PurchaseOrderValidator.validateUnitPrice('0.0000')).toBe('0.0000');
    });

    it('rejects unit prices with more than 4 decimal places', () => {
      expect(() => PurchaseOrderValidator.validateUnitPrice('10.12345')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });

    it('rejects negative unit price', () => {
      expect(() => PurchaseOrderValidator.validateUnitPrice('-10.0000')).toThrow(
        PurchaseOrderInvalidLineException,
      );
      expect(() => PurchaseOrderValidator.validateUnitPrice('-0.01')).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });
  });

  describe('validateAndCalculateTotals', () => {
    it('calculates authoritative line totals, subtotal, and grandTotal using exact arithmetic', () => {
      const result = PurchaseOrderValidator.validateAndCalculateTotals([
        {
          productId: 'prod-1',
          quantity: '10.0000',
          unitPrice: '25.5000',
          notes: 'First line',
        },
        {
          productId: 'prod-2',
          quantity: '2.5000',
          unitPrice: '10.0000',
          notes: null,
        },
      ]);

      expect(result.lines).toHaveLength(2);
      // Line 1: 10 * 25.5 = 255.0000
      expect(result.lines[0]?.lineTotal).toBe('255.0000');
      // Line 2: 2.5 * 10 = 25.0000
      expect(result.lines[1]?.lineTotal).toBe('25.0000');
      // Subtotal: 255 + 25 = 280.0000
      expect(result.subtotal).toBe('280.0000');
      expect(result.taxTotal).toBe('0.0000');
      expect(result.grandTotal).toBe('280.0000');
    });

    it('rejects empty line items array', () => {
      expect(() => PurchaseOrderValidator.validateAndCalculateTotals([])).toThrow(
        PurchaseOrderInvalidLineException,
      );
    });

    it('rejects lines with duplicate products', () => {
      expect(() =>
        PurchaseOrderValidator.validateAndCalculateTotals([
          { productId: 'prod-1', quantity: '5', unitPrice: '10' },
          { productId: 'prod-1', quantity: '2', unitPrice: '10' },
        ]),
      ).toThrow(PurchaseOrderInvalidLineException);
    });
  });
});
