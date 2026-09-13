import { ImportsValidator } from './imports.validator';
import {
  ImportInvalidFileException,
  ImportEmptyFileException,
  ImportInvalidHeadersException,
} from './imports.errors';

describe('ImportsValidator', () => {
  describe('validateUploadedFile', () => {
    it('throws if file is missing', () => {
      expect(() => ImportsValidator.validateUploadedFile(undefined)).toThrow(
        ImportInvalidFileException,
      );
    });

    it('throws if file is empty (0 bytes)', () => {
      expect(() =>
        ImportsValidator.validateUploadedFile({
          originalname: 'test.csv',
          size: 0,
          mimetype: 'text/csv',
        }),
      ).toThrow(ImportEmptyFileException);
    });

    it('throws if file exceeds 10MB', () => {
      expect(() =>
        ImportsValidator.validateUploadedFile({
          originalname: 'huge.csv',
          size: 11 * 1024 * 1024,
          mimetype: 'text/csv',
        }),
      ).toThrow(ImportInvalidFileException);
    });

    it('throws if extension is not .csv', () => {
      expect(() =>
        ImportsValidator.validateUploadedFile({
          originalname: 'data.json',
          size: 100,
          mimetype: 'application/json',
        }),
      ).toThrow(ImportInvalidFileException);
    });

    it('passes for valid CSV upload', () => {
      expect(() =>
        ImportsValidator.validateUploadedFile({
          originalname: 'products.csv',
          size: 2048,
          mimetype: 'text/csv',
        }),
      ).not.toThrow();
    });
  });

  describe('validateHeaders', () => {
    it('throws ImportInvalidHeadersException if required product headers are missing', () => {
      expect(() =>
        ImportsValidator.validateHeaders('PRODUCT', ['name', 'category'], ['Name', 'Category']),
      ).toThrow(ImportInvalidHeadersException);
    });

    it('passes when required product headers (sku, name) are present', () => {
      expect(() =>
        ImportsValidator.validateHeaders('PRODUCT', ['sku', 'name', 'category'], ['SKU', 'Name', 'Category']),
      ).not.toThrow();
    });

    it('throws ImportInvalidHeadersException if required stock headers are missing', () => {
      expect(() =>
        ImportsValidator.validateHeaders('STOCK', ['sku'], ['SKU']),
      ).toThrow(ImportInvalidHeadersException);
    });

    it('passes when required stock headers (sku, warehousecode, quantitydelta) are present', () => {
      expect(() =>
        ImportsValidator.validateHeaders(
          'STOCK',
          ['sku', 'warehousecode', 'quantitydelta'],
          ['SKU', 'Warehouse Code', 'Quantity Delta'],
        ),
      ).not.toThrow();
    });
  });

  describe('validateProductRow', () => {
    it('validates a valid product row with all fields', () => {
      const errors = ImportsValidator.validateProductRow(2, {
        sku: 'PROD-101',
        name: 'Hammer',
        category: 'Tools',
        unitofmeasure: 'UNIT',
        unitcost: '10.5000',
        unitprice: '25.0000',
        status: 'ACTIVE',
      });
      expect(errors).toHaveLength(0);
    });

    it('reports missing SKU and Name', () => {
      const errors = ImportsValidator.validateProductRow(2, {
        sku: '',
        name: '   ',
      });
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.column)).toEqual(['sku', 'name']);
    });

    it('reports invalid unit of measure', () => {
      const errors = ImportsValidator.validateProductRow(2, {
        sku: 'PROD-1',
        name: 'Item',
        unitofmeasure: 'UNKNOWN_UOM',
      });
      expect(errors.some((e) => e.code === 'INVALID_UNIT_OF_MEASURE')).toBe(true);
    });

    it('reports negative prices or costs', () => {
      const errors = ImportsValidator.validateProductRow(2, {
        sku: 'PROD-1',
        name: 'Item',
        unitcost: '-5.00',
        unitprice: '-10.00',
      });
      expect(errors.some((e) => e.column === 'unitCost')).toBe(true);
      expect(errors.some((e) => e.column === 'unitPrice')).toBe(true);
    });
  });

  describe('validateStockRow', () => {
    it('validates a valid stock adjustment row', () => {
      const errors = ImportsValidator.validateStockRow(2, {
        sku: 'PROD-101',
        warehousecode: 'WH-MAIN',
        quantitydelta: '50.0000',
        type: 'ADJUSTMENT',
      });
      expect(errors).toHaveLength(0);
    });

    it('reports missing required fields', () => {
      const errors = ImportsValidator.validateStockRow(2, {
        sku: '',
        warehousecode: '',
        quantitydelta: '',
      });
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it('validates mutation delta sign semantics (OPENING must be positive, ISSUE negative)', () => {
      const openingNegative = ImportsValidator.validateStockRow(2, {
        sku: 'PROD-1',
        warehousecode: 'WH-1',
        quantitydelta: '-10',
        type: 'OPENING',
      });
      expect(openingNegative.some((e) => e.code === 'INVALID_MUTATION_DELTA_SIGN')).toBe(true);

      const issuePositive = ImportsValidator.validateStockRow(2, {
        sku: 'PROD-1',
        warehousecode: 'WH-1',
        quantitydelta: '10',
        type: 'ISSUE',
      });
      expect(issuePositive.some((e) => e.code === 'INVALID_MUTATION_DELTA_SIGN')).toBe(true);
    });
  });
});
