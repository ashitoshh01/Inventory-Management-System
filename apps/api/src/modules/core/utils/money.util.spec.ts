import { MoneyUtil } from './money.util';

describe('MoneyUtil (Unit)', () => {
  describe('toMinorUnits()', () => {
    it('should convert standard decimal string to minor units without float error', () => {
      expect(MoneyUtil.toMinorUnits('125.50')).toBe(12550n);
      expect(MoneyUtil.toMinorUnits('19.99')).toBe(1999n);
      expect(MoneyUtil.toMinorUnits('0.05')).toBe(5n);
      expect(MoneyUtil.toMinorUnits('100')).toBe(10000n);
    });

    it('should convert numeric values properly', () => {
      expect(MoneyUtil.toMinorUnits(125.5)).toBe(12550n);
      expect(MoneyUtil.toMinorUnits(0)).toBe(0n);
    });

    it('should handle negative numbers', () => {
      expect(MoneyUtil.toMinorUnits('-45.20')).toBe(-4520n);
      expect(MoneyUtil.toMinorUnits(-10.5)).toBe(-1050n);
    });

    it('should throw error on invalid amounts', () => {
      expect(() => MoneyUtil.toMinorUnits('abc')).toThrow();
      expect(() => MoneyUtil.toMinorUnits('')).toThrow();
    });
  });

  describe('fromMinorUnits() and toDecimalString()', () => {
    it('should convert minor units to major float and decimal string accurately', () => {
      expect(MoneyUtil.toDecimalString(12550n)).toBe('125.50');
      expect(MoneyUtil.fromMinorUnits(12550n)).toBe(125.5);

      expect(MoneyUtil.toDecimalString(5n)).toBe('0.05');
      expect(MoneyUtil.fromMinorUnits(5n)).toBe(0.05);

      expect(MoneyUtil.toDecimalString(-4520n)).toBe('-45.20');
      expect(MoneyUtil.fromMinorUnits(-4520n)).toBe(-45.2);
    });
  });

  describe('format()', () => {
    it('should format money in INR currency format', () => {
      const formatted = MoneyUtil.format(12550n, 'INR', 'en-IN');
      expect(formatted).toContain('125.50');
    });
  });
});
