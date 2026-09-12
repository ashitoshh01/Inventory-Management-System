import { QuantityUtil } from './quantity.util';

describe('QuantityUtil (Unit)', () => {
  describe('normalize() and scaling', () => {
    it('should normalize fractional quantities to 4 decimal places', () => {
      expect(QuantityUtil.normalize('1.5')).toBe('1.5000');
      expect(QuantityUtil.normalize(1.5)).toBe('1.5000');
      expect(QuantityUtil.normalize('0.25')).toBe('0.2500');
      expect(QuantityUtil.normalize('10')).toBe('10.0000');
    });

    it('should handle small fractional values up to 4 decimal places', () => {
      expect(QuantityUtil.normalize('0.0001')).toBe('0.0001');
      expect(QuantityUtil.toScaledInteger('0.0001')).toBe(1n);
    });
  });

  describe('add() and subtract()', () => {
    it('should add quantities accurately without float precision error', () => {
      expect(QuantityUtil.add('0.1', '0.2')).toBe('0.3000');
      expect(QuantityUtil.add('1.2500', '2.7500')).toBe('4.0000');
    });

    it('should subtract quantities accurately', () => {
      expect(QuantityUtil.subtract('5.0000', '1.2500')).toBe('3.7500');
      expect(QuantityUtil.subtract('0.3', '0.1')).toBe('0.2000');
    });
  });

  describe('compare(), isPositive(), isZero()', () => {
    it('should compare quantities correctly', () => {
      expect(QuantityUtil.compare('1.5', '2.0')).toBe(-1);
      expect(QuantityUtil.compare('2.0', '1.5')).toBe(1);
      expect(QuantityUtil.compare('1.5000', '1.5')).toBe(0);
    });

    it('should identify positive and zero quantities', () => {
      expect(QuantityUtil.isPositive('0.0001')).toBe(true);
      expect(QuantityUtil.isPositive('0')).toBe(false);
      expect(QuantityUtil.isZero('0.0000')).toBe(true);
      expect(QuantityUtil.isZero('0')).toBe(true);
      expect(QuantityUtil.isZero('1')).toBe(false);
    });
  });
});
