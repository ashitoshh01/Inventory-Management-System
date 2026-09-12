import { WarehouseValidator } from './warehouses.validator';
import { WarehouseValidationException } from './warehouses.errors';

describe('WarehouseValidator (Unit)', () => {
  describe('normalizeCode', () => {
    it('should trim and uppercase valid warehouse code', () => {
      expect(WarehouseValidator.normalizeCode('  wh-central  ')).toBe('WH-CENTRAL');
      expect(WarehouseValidator.normalizeCode('wh_east_01')).toBe('WH_EAST_01');
      expect(WarehouseValidator.normalizeCode('BOM-WH-02')).toBe('BOM-WH-02');
    });

    it('should reject non-string code', () => {
      expect(() => WarehouseValidator.normalizeCode(null)).toThrow(WarehouseValidationException);
      expect(() => WarehouseValidator.normalizeCode(undefined)).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.normalizeCode(12345)).toThrow(WarehouseValidationException);
      expect(() => WarehouseValidator.normalizeCode({})).toThrow(WarehouseValidationException);
    });

    it('should reject empty or whitespace-only code', () => {
      expect(() => WarehouseValidator.normalizeCode('')).toThrow(WarehouseValidationException);
      expect(() => WarehouseValidator.normalizeCode('   ')).toThrow(WarehouseValidationException);
    });

    it('should reject code shorter than MIN_CODE_LENGTH (2)', () => {
      expect(() => WarehouseValidator.normalizeCode('A')).toThrow(WarehouseValidationException);
    });

    it('should reject code exceeding MAX_CODE_LENGTH (50)', () => {
      const longCode = 'A'.repeat(51);
      expect(() => WarehouseValidator.normalizeCode(longCode)).toThrow(
        WarehouseValidationException,
      );
      expect(WarehouseValidator.normalizeCode('A'.repeat(50))).toHaveLength(50);
    });

    it('should reject code with internal whitespace', () => {
      expect(() => WarehouseValidator.normalizeCode('WH 100')).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.normalizeCode('WH\t100')).toThrow(
        WarehouseValidationException,
      );
    });

    it('should reject code with invalid characters', () => {
      expect(() => WarehouseValidator.normalizeCode('WH@100')).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.normalizeCode('WH#100')).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.normalizeCode('WH.100')).toThrow(
        WarehouseValidationException,
      );
    });
  });

  describe('validateName', () => {
    it('should trim and accept valid names', () => {
      expect(WarehouseValidator.validateName('  Central Hub  ')).toBe('Central Hub');
      expect(WarehouseValidator.validateName('West Coast Distribution Center')).toBe(
        'West Coast Distribution Center',
      );
    });

    it('should reject non-string name', () => {
      expect(() => WarehouseValidator.validateName(null)).toThrow(WarehouseValidationException);
      expect(() => WarehouseValidator.validateName(undefined)).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.validateName(123)).toThrow(WarehouseValidationException);
    });

    it('should reject empty or whitespace-only name', () => {
      expect(() => WarehouseValidator.validateName('')).toThrow(WarehouseValidationException);
      expect(() => WarehouseValidator.validateName('   ')).toThrow(WarehouseValidationException);
    });

    it('should reject name shorter than MIN_NAME_LENGTH (2)', () => {
      expect(() => WarehouseValidator.validateName('A')).toThrow(WarehouseValidationException);
    });

    it('should reject name exceeding MAX_NAME_LENGTH (100)', () => {
      const longName = 'W'.repeat(101);
      expect(() => WarehouseValidator.validateName(longName)).toThrow(WarehouseValidationException);
      expect(WarehouseValidator.validateName('W'.repeat(100))).toHaveLength(100);
    });
  });

  describe('validateDescription', () => {
    it('should return null for undefined, null, or empty string', () => {
      expect(WarehouseValidator.validateDescription(undefined)).toBeNull();
      expect(WarehouseValidator.validateDescription(null)).toBeNull();
      expect(WarehouseValidator.validateDescription('')).toBeNull();
      expect(WarehouseValidator.validateDescription('   ')).toBeNull();
    });

    it('should trim and accept valid description', () => {
      expect(WarehouseValidator.validateDescription('  Primary storage  ')).toBe('Primary storage');
    });

    it('should reject non-string description', () => {
      expect(() => WarehouseValidator.validateDescription(1234)).toThrow(
        WarehouseValidationException,
      );
    });

    it('should reject description exceeding 1000 characters', () => {
      expect(() => WarehouseValidator.validateDescription('X'.repeat(1001))).toThrow(
        WarehouseValidationException,
      );
    });
  });

  describe('validateAddressField', () => {
    it('should return null for undefined, null, or empty string', () => {
      expect(WarehouseValidator.validateAddressField('City', undefined)).toBeNull();
      expect(WarehouseValidator.validateAddressField('City', null)).toBeNull();
      expect(WarehouseValidator.validateAddressField('City', '')).toBeNull();
    });

    it('should trim valid address field', () => {
      expect(WarehouseValidator.validateAddressField('City', '  Mumbai  ')).toBe('Mumbai');
    });

    it('should reject non-string address field', () => {
      expect(() => WarehouseValidator.validateAddressField('City', 123)).toThrow(
        WarehouseValidationException,
      );
    });

    it('should reject address field exceeding MAX_ADDRESS_FIELD_LENGTH (200)', () => {
      expect(() => WarehouseValidator.validateAddressField('City', 'C'.repeat(201))).toThrow(
        WarehouseValidationException,
      );
    });
  });

  describe('validateStatus', () => {
    it('should default to ACTIVE when null or undefined', () => {
      expect(WarehouseValidator.validateStatus(undefined)).toBe('ACTIVE');
      expect(WarehouseValidator.validateStatus(null)).toBe('ACTIVE');
    });

    it('should accept valid statuses case-insensitively', () => {
      expect(WarehouseValidator.validateStatus('ACTIVE')).toBe('ACTIVE');
      expect(WarehouseValidator.validateStatus('active')).toBe('ACTIVE');
      expect(WarehouseValidator.validateStatus('INACTIVE')).toBe('INACTIVE');
      expect(WarehouseValidator.validateStatus('inactive')).toBe('INACTIVE');
    });

    it('should reject invalid status', () => {
      expect(() => WarehouseValidator.validateStatus('DELETED')).toThrow(
        WarehouseValidationException,
      );
      expect(() => WarehouseValidator.validateStatus('ARCHIVED')).toThrow(
        WarehouseValidationException,
      );
    });
  });
});
