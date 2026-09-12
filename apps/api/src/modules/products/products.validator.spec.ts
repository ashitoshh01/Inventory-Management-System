import { ProductValidator } from './products.validator';
import { ProductValidationException } from './products.errors';

describe('ProductValidator (Unit)', () => {
  describe('normalizeSku', () => {
    it('should trim and uppercase valid SKU', () => {
      expect(ProductValidator.normalizeSku('  sku-100  ')).toBe('SKU-100');
      expect(ProductValidator.normalizeSku('prod_item.01')).toBe('PROD_ITEM.01');
      expect(ProductValidator.normalizeSku('WIDGET-99')).toBe('WIDGET-99');
    });

    it('should reject non-string SKU', () => {
      expect(() => ProductValidator.normalizeSku(null)).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku(undefined)).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku(12345)).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku({})).toThrow(ProductValidationException);
    });

    it('should reject empty or whitespace-only SKU', () => {
      expect(() => ProductValidator.normalizeSku('')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('   ')).toThrow(ProductValidationException);
    });

    it('should reject SKU exceeding 50 characters', () => {
      const longSku = 'A'.repeat(51);
      expect(() => ProductValidator.normalizeSku(longSku)).toThrow(ProductValidationException);
      expect(ProductValidator.normalizeSku('A'.repeat(50))).toHaveLength(50);
    });

    it('should reject SKU with internal whitespace', () => {
      expect(() => ProductValidator.normalizeSku('SKU 100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU\t100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU\n100')).toThrow(ProductValidationException);
    });

    it('should reject SKU with invalid characters', () => {
      expect(() => ProductValidator.normalizeSku('SKU@100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU#100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU$100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU/100')).toThrow(ProductValidationException);
      expect(() => ProductValidator.normalizeSku('SKU!100')).toThrow(ProductValidationException);
    });
  });

  describe('validateName', () => {
    it('should trim and accept valid names', () => {
      expect(ProductValidator.validateName('  Widget A  ')).toBe('Widget A');
      expect(ProductValidator.validateName('Stainless Steel Screw 3mm')).toBe(
        'Stainless Steel Screw 3mm',
      );
    });

    it('should reject non-string name', () => {
      expect(() => ProductValidator.validateName(null)).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateName(undefined)).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateName(1234)).toThrow(ProductValidationException);
    });

    it('should reject empty or whitespace-only name', () => {
      expect(() => ProductValidator.validateName('')).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateName('   ')).toThrow(ProductValidationException);
    });

    it('should reject name exceeding 200 characters', () => {
      const longName = 'A'.repeat(201);
      expect(() => ProductValidator.validateName(longName)).toThrow(ProductValidationException);
      expect(ProductValidator.validateName('A'.repeat(200))).toHaveLength(200);
    });
  });

  describe('validateDescription', () => {
    it('should return null if undefined, null, or empty string', () => {
      expect(ProductValidator.validateDescription(undefined)).toBeNull();
      expect(ProductValidator.validateDescription(null)).toBeNull();
      expect(ProductValidator.validateDescription('')).toBeNull();
      expect(ProductValidator.validateDescription('   ')).toBeNull();
    });

    it('should trim and accept valid description', () => {
      expect(ProductValidator.validateDescription('  A fine widget  ')).toBe('A fine widget');
    });

    it('should reject non-string description', () => {
      expect(() => ProductValidator.validateDescription(12345)).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateDescription({})).toThrow(ProductValidationException);
    });

    it('should reject description exceeding 1000 characters', () => {
      const longDesc = 'D'.repeat(1001);
      expect(() => ProductValidator.validateDescription(longDesc)).toThrow(
        ProductValidationException,
      );
      expect(ProductValidator.validateDescription('D'.repeat(1000))).toHaveLength(1000);
    });
  });

  describe('validateUnitOfMeasure', () => {
    it('should default to UNIT when undefined or null', () => {
      expect(ProductValidator.validateUnitOfMeasure(undefined)).toBe('UNIT');
      expect(ProductValidator.validateUnitOfMeasure(null)).toBe('UNIT');
    });

    it('should normalize and accept all valid UOM enums', () => {
      expect(ProductValidator.validateUnitOfMeasure('unit')).toBe('UNIT');
      expect(ProductValidator.validateUnitOfMeasure('kg')).toBe('KG');
      expect(ProductValidator.validateUnitOfMeasure('G')).toBe('G');
      expect(ProductValidator.validateUnitOfMeasure('l')).toBe('L');
      expect(ProductValidator.validateUnitOfMeasure('ML')).toBe('ML');
      expect(ProductValidator.validateUnitOfMeasure('m')).toBe('M');
      expect(ProductValidator.validateUnitOfMeasure('cm')).toBe('CM');
      expect(ProductValidator.validateUnitOfMeasure('box')).toBe('BOX');
      expect(ProductValidator.validateUnitOfMeasure('PACK')).toBe('PACK');
    });

    it('should reject non-string UOM', () => {
      expect(() => ProductValidator.validateUnitOfMeasure(123)).toThrow(ProductValidationException);
    });

    it('should reject invalid UOM string', () => {
      expect(() => ProductValidator.validateUnitOfMeasure('TON')).toThrow(
        ProductValidationException,
      );
      expect(() => ProductValidator.validateUnitOfMeasure('PIECE')).toThrow(
        ProductValidationException,
      );
      expect(() => ProductValidator.validateUnitOfMeasure('GALLON')).toThrow(
        ProductValidationException,
      );
    });
  });

  describe('validateStatus', () => {
    it('should default to ACTIVE when undefined or null', () => {
      expect(ProductValidator.validateStatus(undefined)).toBe('ACTIVE');
      expect(ProductValidator.validateStatus(null)).toBe('ACTIVE');
    });

    it('should normalize and accept ACTIVE and INACTIVE', () => {
      expect(ProductValidator.validateStatus('active')).toBe('ACTIVE');
      expect(ProductValidator.validateStatus('ACTIVE')).toBe('ACTIVE');
      expect(ProductValidator.validateStatus('inactive')).toBe('INACTIVE');
      expect(ProductValidator.validateStatus('INACTIVE')).toBe('INACTIVE');
    });

    it('should reject non-string status', () => {
      expect(() => ProductValidator.validateStatus(123)).toThrow(ProductValidationException);
    });

    it('should reject invalid status string', () => {
      expect(() => ProductValidator.validateStatus('ARCHIVED')).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateStatus('DELETED')).toThrow(ProductValidationException);
      expect(() => ProductValidator.validateStatus('PENDING')).toThrow(ProductValidationException);
    });
  });
});
