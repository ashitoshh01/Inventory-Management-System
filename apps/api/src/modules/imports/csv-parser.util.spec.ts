import { CsvParserUtil } from './csv-parser.util';

describe('CsvParserUtil', () => {
  describe('stripBom', () => {
    it('strips UTF-8 BOM if present', () => {
      const content = '\uFEFFsku,name\nPROD-1,Widget';
      expect(CsvParserUtil.stripBom(content)).toBe('sku,name\nPROD-1,Widget');
    });

    it('returns untouched content if no BOM is present', () => {
      const content = 'sku,name\nPROD-1,Widget';
      expect(CsvParserUtil.stripBom(content)).toBe('sku,name\nPROD-1,Widget');
    });
  });

  describe('normalizeHeader', () => {
    it('normalizes headers to lowercase stripped alphanumeric', () => {
      expect(CsvParserUtil.normalizeHeader('Product SKU')).toBe('productsku');
      expect(CsvParserUtil.normalizeHeader('Quantity Delta')).toBe('quantitydelta');
      expect(CsvParserUtil.normalizeHeader('Warehouse_Code')).toBe('warehousecode');
      expect(CsvParserUtil.normalizeHeader(' Unit-of-Measure ')).toBe('unitofmeasure');
    });
  });

  describe('sanitizeFormula', () => {
    it('prepends single quote to values starting with formula characters', () => {
      expect(CsvParserUtil.sanitizeFormula('=1+2')).toBe("'=1+2");
      expect(CsvParserUtil.sanitizeFormula('+cmd|')).toBe("'+cmd|");
      expect(CsvParserUtil.sanitizeFormula('-100')).toBe("'-100");
      expect(CsvParserUtil.sanitizeFormula('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)");
      expect(CsvParserUtil.sanitizeFormula('\tTabInjected')).toBe("'\tTabInjected");
    });

    it('leaves safe values untouched', () => {
      expect(CsvParserUtil.sanitizeFormula('PROD-100')).toBe('PROD-100');
      expect(CsvParserUtil.sanitizeFormula('Regular Name')).toBe('Regular Name');
      expect(CsvParserUtil.sanitizeFormula(123)).toBe('123');
      expect(CsvParserUtil.sanitizeFormula(null)).toBe('');
    });
  });

  describe('escapeCsvCell', () => {
    it('escapes cells containing commas, quotes, and newlines according to RFC 4180', () => {
      expect(CsvParserUtil.escapeCsvCell('Simple')).toBe('Simple');
      expect(CsvParserUtil.escapeCsvCell('Hello, World')).toBe('"Hello, World"');
      expect(CsvParserUtil.escapeCsvCell('Say "Hi"')).toBe('"Say ""Hi"""');
      expect(CsvParserUtil.escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
    });
  });

  describe('parse', () => {
    it('correctly parses RFC 4180 CSV with standard delimiters and CRLF', () => {
      const csv = 'SKU,Name,Category\r\nPROD-1,Widget,Electronics\r\nPROD-2,Gadget,Tools\r\n';
      const result = CsvParserUtil.parse(csv);

      expect(result.headers).toEqual(['SKU', 'Name', 'Category']);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]).toEqual({
        rowNumber: 2,
        data: {
          sku: 'PROD-1',
          name: 'Widget',
          category: 'Electronics',
        },
      });
      expect(result.rows[1]).toEqual({
        rowNumber: 3,
        data: {
          sku: 'PROD-2',
          name: 'Gadget',
          category: 'Tools',
        },
      });
    });

    it('correctly handles quoted fields containing commas, quotes, and embedded newlines', () => {
      const csv = `sku,name,description\nPROD-1,"Widget, Premium","Line 1\nLine 2"\nPROD-2,"Drill ""Pro""",Normal`;
      const result = CsvParserUtil.parse(csv);

      expect(result.totalRows).toBe(2);
      expect(result.rows[0]?.data).toEqual({
        sku: 'PROD-1',
        name: 'Widget, Premium',
        description: 'Line 1\nLine 2',
      });
      expect(result.rows[1]?.data).toEqual({
        sku: 'PROD-2',
        name: 'Drill "Pro"',
        description: 'Normal',
      });
    });

    it('ignores empty trailing lines', () => {
      const csv = 'sku,name\nPROD-1,Widget\n\n   \n';
      const result = CsvParserUtil.parse(csv);
      expect(result.totalRows).toBe(1);
      expect(result.rows[0]?.data['sku']).toBe('PROD-1');
    });

    it('handles empty input gracefully', () => {
      const result = CsvParserUtil.parse('');
      expect(result.totalRows).toBe(0);
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });
});
