import * as path from 'path';

export const IMPORTS_STORAGE_DIR = path.resolve(process.cwd(), 'storage/imports');

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_IMPORT_ROWS = 10000;

export const ALLOWED_IMPORT_EXTENSIONS = ['.csv'];

export const ALLOWED_IMPORT_MIME_TYPES = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'text/x-csv',
];

export const PRODUCT_IMPORT_REQUIRED_HEADERS = ['sku', 'name'];
export const PRODUCT_IMPORT_OPTIONAL_HEADERS = [
  'category',
  'description',
  'unitofmeasure',
  'unitcost',
  'unitprice',
  'status',
];

export const STOCK_IMPORT_REQUIRED_HEADERS = ['sku', 'warehousecode', 'quantitydelta'];
export const STOCK_IMPORT_OPTIONAL_HEADERS = ['type', 'reason'];
