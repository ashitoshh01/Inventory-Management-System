import { expect, test, describe } from 'vitest';
import { validateBulkProducts } from './bulk-validation';

describe('CSV Bulk Validation', () => {
  test('Valid row passes validation', () => {
    const rows = [{
      sku: 'VALID-1',
      name: 'Valid Product',
      costPrice: '10',
      salePrice: '20',
      unit: 'pcs'
    }];
    const result = validateBulkProducts(rows);
    expect(result[0].isValid).toBe(true);
    expect(result[0].errors).toHaveLength(0);
  });

  test('Invalid row fails validation', () => {
    const rows = [{
      sku: '', // missing SKU
      name: 'Invalid Product',
      costPrice: 'invalid-number',
      salePrice: '-5', // negative price
      unit: 'pcs'
    }];
    const result = validateBulkProducts(rows);
    expect(result[0].isValid).toBe(false);
    expect(result[0].errors.some(e => e.includes('sku'))).toBe(true);
    expect(result[0].errors.some(e => e.includes('salePrice'))).toBe(true);
  });

  test('Duplicate SKUs within same file', () => {
    const rows = [
      {
        sku: 'DUP-1',
        name: 'Product 1',
        costPrice: '10',
        salePrice: '20',
        unit: 'pcs'
      },
      {
        sku: 'DUP-1', // duplicate
        name: 'Product 2',
        costPrice: '15',
        salePrice: '25',
        unit: 'pcs'
      }
    ];
    const result = validateBulkProducts(rows);
    expect(result[0].isValid).toBe(true);
    expect(result[1].isValid).toBe(false);
    expect(result[1].errors).toContain('sku: Duplicate SKU within the import file');
  });
});
