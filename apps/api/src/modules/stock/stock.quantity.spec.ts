import { Prisma } from '@repo/database';
import { StockQuantityValidator } from './stock.quantity';
import { StockInvalidQuantityException } from './stock.errors';

describe('StockQuantityValidator (Unit)', () => {
  describe('validatePrecision', () => {
    it('accepts valid quantities with up to 4 decimal places', () => {
      expect(StockQuantityValidator.validatePrecision('0')).toBe('0.0000');
      expect(StockQuantityValidator.validatePrecision(0)).toBe('0.0000');
      expect(StockQuantityValidator.validatePrecision('1')).toBe('1.0000');
      expect(StockQuantityValidator.validatePrecision('1.25')).toBe('1.2500');
      expect(StockQuantityValidator.validatePrecision('0.0001')).toBe('0.0001');
      expect(StockQuantityValidator.validatePrecision('12345.6789')).toBe('12345.6789');
      expect(StockQuantityValidator.validatePrecision(new Prisma.Decimal('12345.6789'))).toBe(
        '12345.6789',
      );
    });

    it('accepts trailing zeroes beyond 4 decimal places as equivalent', () => {
      expect(StockQuantityValidator.validatePrecision('1.50000')).toBe('1.5000');
    });

    it('rejects quantities exceeding 4 decimal places of precision', () => {
      expect(() => StockQuantityValidator.validatePrecision('0.00001')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validatePrecision('1.12345')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validatePrecision('-0.00005')).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('rejects invalid non-numeric strings', () => {
      expect(() => StockQuantityValidator.validatePrecision('abc')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validatePrecision('')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validatePrecision(NaN)).toThrow(
        StockInvalidQuantityException,
      );
    });
  });

  describe('validateNonZeroDelta', () => {
    it('accepts positive and negative deltas', () => {
      expect(() => StockQuantityValidator.validateNonZeroDelta('10.0000')).not.toThrow();
      expect(() => StockQuantityValidator.validateNonZeroDelta('-5.2500')).not.toThrow();
      expect(() => StockQuantityValidator.validateNonZeroDelta('0.0001')).not.toThrow();
      expect(() => StockQuantityValidator.validateNonZeroDelta('-0.0001')).not.toThrow();
    });

    it('rejects zero delta', () => {
      expect(() => StockQuantityValidator.validateNonZeroDelta('0')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateNonZeroDelta('0.0000')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateNonZeroDelta(0)).toThrow(
        StockInvalidQuantityException,
      );
    });
  });

  describe('validateLedgerMath', () => {
    it('accepts consistent ledger arithmetic (before + delta = after)', () => {
      // Opening
      expect(() => StockQuantityValidator.validateLedgerMath('0', '100', '100')).not.toThrow();
      // Receipt
      expect(() => StockQuantityValidator.validateLedgerMath('100', '50', '150')).not.toThrow();
      // Issue
      expect(() => StockQuantityValidator.validateLedgerMath('150', '-20', '130')).not.toThrow();
      // Fractional adjustment
      expect(() =>
        StockQuantityValidator.validateLedgerMath('1.2500', '0.7500', '2.0000'),
      ).not.toThrow();
    });

    it('rejects inconsistent ledger arithmetic', () => {
      expect(() => StockQuantityValidator.validateLedgerMath('100', '50', '140')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateLedgerMath('150', '-20', '140')).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('rejects zero delta within ledger math check', () => {
      expect(() => StockQuantityValidator.validateLedgerMath('100', '0', '100')).toThrow(
        StockInvalidQuantityException,
      );
    });
  });

  describe('validateMutationDelta', () => {
    it('validates OPENING requires strictly positive delta', () => {
      expect(StockQuantityValidator.validateMutationDelta('OPENING', '50.0000')).toBe('50.0000');
      expect(() => StockQuantityValidator.validateMutationDelta('OPENING', '0')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateMutationDelta('OPENING', '-10.0000')).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('validates RECEIPT requires strictly positive delta', () => {
      expect(StockQuantityValidator.validateMutationDelta('RECEIPT', '25.0000')).toBe('25.0000');
      expect(() => StockQuantityValidator.validateMutationDelta('RECEIPT', '0')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateMutationDelta('RECEIPT', '-5.0000')).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('validates ISSUE requires strictly negative delta', () => {
      expect(StockQuantityValidator.validateMutationDelta('ISSUE', '-30.0000')).toBe('-30.0000');
      expect(() => StockQuantityValidator.validateMutationDelta('ISSUE', '0')).toThrow(
        StockInvalidQuantityException,
      );
      expect(() => StockQuantityValidator.validateMutationDelta('ISSUE', '10.0000')).toThrow(
        StockInvalidQuantityException,
      );
    });

    it('validates ADJUSTMENT allows positive or negative delta but rejects zero', () => {
      expect(StockQuantityValidator.validateMutationDelta('ADJUSTMENT', '5.0000')).toBe('5.0000');
      expect(StockQuantityValidator.validateMutationDelta('ADJUSTMENT', '-5.0000')).toBe('-5.0000');
      expect(() => StockQuantityValidator.validateMutationDelta('ADJUSTMENT', '0')).toThrow(
        StockInvalidQuantityException,
      );
    });
  });

  describe('calculateNewQuantity and assertNonNegative', () => {
    it('calculates new quantities accurately with exact 4-decimal precision', () => {
      expect(StockQuantityValidator.calculateNewQuantity('100.0000', '25.5000')).toBe('125.5000');
      expect(StockQuantityValidator.calculateNewQuantity('100.0000', '-30.2500')).toBe('69.7500');
    });

    it('asserts non-negative quantities successfully for zero or positive values', () => {
      expect(() => StockQuantityValidator.assertNonNegative('0.0000')).not.toThrow();
      expect(() => StockQuantityValidator.assertNonNegative('100.0000')).not.toThrow();
    });

    it('rejects negative quantities with StockInsufficientQuantityException', () => {
      expect(() => StockQuantityValidator.assertNonNegative('-0.0001')).toThrow(
        /insufficient stock/i,
      );
      expect(() => StockQuantityValidator.assertNonNegative('-10.0000')).toThrow(
        /insufficient stock/i,
      );
    });
  });
});
