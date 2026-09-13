import { BadRequestException } from '@nestjs/common';
import { StockTransferValidator } from './transfers.validator';
import {
  StockTransferInvalidLineException,
  StockTransferSameWarehouseException,
} from './transfers.errors';
import { StockInvalidQuantityException } from '../stock/stock.errors';

describe('StockTransferValidator (Unit)', () => {
  describe('validateWarehouses', () => {
    it('accepts two different warehouse IDs', () => {
      expect(() => StockTransferValidator.validateWarehouses('wh-1', 'wh-2')).not.toThrow();
    });

    it('rejects when source and destination warehouses are identical', () => {
      expect(() => StockTransferValidator.validateWarehouses('wh-1', 'wh-1')).toThrow(
        StockTransferSameWarehouseException,
      );
    });

    it('rejects when warehouse ID is missing', () => {
      expect(() => StockTransferValidator.validateWarehouses('', 'wh-2')).toThrow(
        BadRequestException,
      );
      expect(() => StockTransferValidator.validateWarehouses('wh-1', '')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateTransferNumber', () => {
    it('accepts valid alphanumeric transfer numbers with hyphens and underscores', () => {
      expect(StockTransferValidator.validateTransferNumber('TR-2026-001')).toBe('TR-2026-001');
      expect(StockTransferValidator.validateTransferNumber('TRANSFER_99')).toBe('TRANSFER_99');
      expect(StockTransferValidator.validateTransferNumber('  TR-ABC  ')).toBe('TR-ABC');
    });

    it('rejects empty or whitespace-only transfer numbers', () => {
      expect(() => StockTransferValidator.validateTransferNumber('')).toThrow(BadRequestException);
      expect(() => StockTransferValidator.validateTransferNumber('   ')).toThrow(
        BadRequestException,
      );
    });

    it('rejects transfer numbers exceeding 50 characters', () => {
      const longNumber = 'A'.repeat(51);
      expect(() => StockTransferValidator.validateTransferNumber(longNumber)).toThrow(
        BadRequestException,
      );
    });

    it('rejects transfer numbers containing special characters', () => {
      expect(() => StockTransferValidator.validateTransferNumber('TR#001')).toThrow(
        BadRequestException,
      );
      expect(() => StockTransferValidator.validateTransferNumber('TR 001')).toThrow(
        BadRequestException,
      );
      expect(() => StockTransferValidator.validateTransferNumber('TR.001')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateLines', () => {
    it('accepts valid line items with exact decimal quantities', () => {
      const lines = [
        { productId: 'prod-1', quantity: '10.5000', notes: 'First item' },
        { productId: 'prod-2', quantity: '1', notes: null },
      ];
      const result = StockTransferValidator.validateLines(lines);
      expect(result).toHaveLength(2);
      expect(result[0]?.productId).toBe('prod-1');
      expect(result[0]?.quantity).toBe('10.5000');
      expect(result[1]?.productId).toBe('prod-2');
      expect(result[1]?.quantity).toBe('1.0000');
    });

    it('rejects empty line items array', () => {
      expect(() => StockTransferValidator.validateLines([])).toThrow(
        StockTransferInvalidLineException,
      );
    });

    it('rejects duplicate product IDs across lines', () => {
      const lines = [
        { productId: 'prod-1', quantity: '5.0000' },
        { productId: 'prod-1', quantity: '2.0000' },
      ];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockTransferInvalidLineException,
      );
    });

    it('rejects zero quantity', () => {
      const lines = [{ productId: 'prod-1', quantity: '0' }];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockTransferInvalidLineException,
      );
    });

    it('rejects zero decimal quantity "0.0000"', () => {
      const lines = [{ productId: 'prod-1', quantity: '0.0000' }];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockTransferInvalidLineException,
      );
    });

    it('rejects negative quantity', () => {
      const lines = [{ productId: 'prod-1', quantity: '-5.0000' }];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockTransferInvalidLineException,
      );
    });

    it('rejects quantity exceeding 4 decimal places of precision', () => {
      const lines = [{ productId: 'prod-1', quantity: '1.12345' }];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('rejects malformed non-numeric quantity', () => {
      const lines = [{ productId: 'prod-1', quantity: 'abc' }];
      expect(() => StockTransferValidator.validateLines(lines)).toThrow(
        StockInvalidQuantityException,
      );
    });
  });

  describe('validateCreate', () => {
    it('returns normalized validated create input', () => {
      const result = StockTransferValidator.validateCreate({
        transferNumber: 'TR-100',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        notes: 'Urgent transfer',
        lines: [{ productId: 'prod-1', quantity: '25.0000' }],
      });

      expect(result.transferNumber).toBe('TR-100');
      expect(result.sourceWarehouseId).toBe('wh-1');
      expect(result.destinationWarehouseId).toBe('wh-2');
      expect(result.notes).toBe('Urgent transfer');
      expect(result.lines).toHaveLength(1);
    });
  });
});
