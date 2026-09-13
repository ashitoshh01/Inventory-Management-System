import * as path from 'path';
import {
  MAX_IMPORT_FILE_SIZE,
  ALLOWED_IMPORT_EXTENSIONS,
  ALLOWED_IMPORT_MIME_TYPES,
  PRODUCT_IMPORT_REQUIRED_HEADERS,
  STOCK_IMPORT_REQUIRED_HEADERS,
} from './imports.constants';
import {
  ImportInvalidFileException,
  ImportEmptyFileException,
  ImportInvalidHeadersException,
  ImportExceededRowLimitException,
} from './imports.errors';
import { ProductValidator } from '../products/products.validator';
import { WarehouseValidator } from '../warehouses/warehouses.validator';
import { StockQuantityValidator } from '../stock/stock.quantity';
import { UNIT_OF_MEASURE_VALUES, UnitOfMeasure, PRODUCT_STATUS_VALUES, ProductStatus } from '@repo/types';
import type { ImportJobType, ImportRowErrorDto } from '@repo/types';

export class ImportsValidator {
  /**
   * Validates uploaded file container (size, extension, mime type).
   */
  public static validateUploadedFile(file?: {
    originalname: string;
    size: number;
    mimetype: string;
    buffer?: Buffer;
  }): void {
    if (!file || !file.originalname) {
      throw new ImportInvalidFileException('No import file was provided.');
    }

    if (file.size === 0) {
      throw new ImportEmptyFileException('Uploaded file is 0 bytes (empty file).');
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      throw new ImportInvalidFileException(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} MB.`,
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
      throw new ImportInvalidFileException(
        `Unsupported file extension "${ext}". Only .csv files are supported.`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    const isAllowedMime = ALLOWED_IMPORT_MIME_TYPES.some((allowed) => mime.includes(allowed));
    if (!isAllowedMime && mime !== 'application/octet-stream') {
      throw new ImportInvalidFileException(
        `Unsupported MIME type "${file.mimetype}". Expected a valid CSV file.`,
      );
    }
  }

  /**
   * Validates required headers for import type.
   */
  public static validateHeaders(
    type: ImportJobType,
    normalizedHeaders: string[],
    rawHeaders: string[],
  ): void {
    const required =
      type === 'PRODUCT' ? PRODUCT_IMPORT_REQUIRED_HEADERS : STOCK_IMPORT_REQUIRED_HEADERS;

    const missing = required.filter((h) => !normalizedHeaders.includes(h));
    if (missing.length > 0) {
      throw new ImportInvalidHeadersException(
        `Missing required columns for ${type} import: ${missing.join(', ')}. Provided columns: ${rawHeaders.join(', ')}.`,
        missing,
      );
    }
  }

  /**
   * Validates a single product row. Returns array of errors (empty if valid).
   */
  public static validateProductRow(
    rowNumber: number,
    data: Record<string, string>,
  ): ImportRowErrorDto[] {
    const errors: ImportRowErrorDto[] = [];

    // SKU
    const rawSku = data['sku'];
    if (!rawSku || rawSku.trim() === '') {
      errors.push({
        row: rowNumber,
        column: 'sku',
        value: rawSku,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Product SKU is required.',
      });
    } else {
      try {
        ProductValidator.normalizeSku(rawSku);
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'sku',
          value: rawSku,
          code: 'INVALID_SKU',
          message: (err as Error).message,
        });
      }
    }

    // Name
    const rawName = data['name'];
    if (!rawName || rawName.trim() === '') {
      errors.push({
        row: rowNumber,
        column: 'name',
        value: rawName,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Product name is required.',
      });
    } else {
      try {
        ProductValidator.validateName(rawName);
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'name',
          value: rawName,
          code: 'INVALID_NAME',
          message: (err as Error).message,
        });
      }
    }

    // Unit of Measure
    const rawUom = data['unitofmeasure'];
    if (rawUom && rawUom.trim() !== '') {
      const upperUom = rawUom.trim().toUpperCase() as UnitOfMeasure;
      if (!UNIT_OF_MEASURE_VALUES.includes(upperUom)) {
        errors.push({
          row: rowNumber,
          column: 'unitOfMeasure',
          value: rawUom,
          code: 'INVALID_UNIT_OF_MEASURE',
          message: `Invalid unit of measure "${rawUom}". Allowed values: ${UNIT_OF_MEASURE_VALUES.join(', ')}.`,
        });
      }
    }

    // Unit Cost
    const rawCost = data['unitcost'];
    if (rawCost && rawCost.trim() !== '') {
      try {
        const norm = StockQuantityValidator.validatePrecision(rawCost);
        if (norm.startsWith('-')) {
          errors.push({
            row: rowNumber,
            column: 'unitCost',
            value: rawCost,
            code: 'INVALID_UNIT_COST',
            message: 'Unit cost cannot be negative.',
          });
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'unitCost',
          value: rawCost,
          code: 'INVALID_UNIT_COST',
          message: `Invalid unit cost: ${(err as Error).message}`,
        });
      }
    }

    // Unit Price
    const rawPrice = data['unitprice'];
    if (rawPrice && rawPrice.trim() !== '') {
      try {
        const norm = StockQuantityValidator.validatePrecision(rawPrice);
        if (norm.startsWith('-')) {
          errors.push({
            row: rowNumber,
            column: 'unitPrice',
            value: rawPrice,
            code: 'INVALID_UNIT_PRICE',
            message: 'Unit price cannot be negative.',
          });
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'unitPrice',
          value: rawPrice,
          code: 'INVALID_UNIT_PRICE',
          message: `Invalid unit price: ${(err as Error).message}`,
        });
      }
    }

    // Status
    const rawStatus = data['status'];
    if (rawStatus && rawStatus.trim() !== '') {
      const upperStatus = rawStatus.trim().toUpperCase() as ProductStatus;
      if (!PRODUCT_STATUS_VALUES.includes(upperStatus)) {
        errors.push({
          row: rowNumber,
          column: 'status',
          value: rawStatus,
          code: 'INVALID_STATUS',
          message: `Invalid product status "${rawStatus}". Allowed values: ${PRODUCT_STATUS_VALUES.join(', ')}.`,
        });
      }
    }

    return errors;
  }

  /**
   * Validates a single stock row. Returns array of errors (empty if valid).
   */
  public static validateStockRow(
    rowNumber: number,
    data: Record<string, string>,
  ): ImportRowErrorDto[] {
    const errors: ImportRowErrorDto[] = [];

    // SKU
    const rawSku = data['sku'];
    if (!rawSku || rawSku.trim() === '') {
      errors.push({
        row: rowNumber,
        column: 'sku',
        value: rawSku,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Product SKU is required.',
      });
    }

    // Warehouse Code
    const rawWhCode = data['warehousecode'];
    if (!rawWhCode || rawWhCode.trim() === '') {
      errors.push({
        row: rowNumber,
        column: 'warehouseCode',
        value: rawWhCode,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Warehouse code is required.',
      });
    } else {
      try {
        WarehouseValidator.normalizeCode(rawWhCode);
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'warehouseCode',
          value: rawWhCode,
          code: 'INVALID_WAREHOUSE_CODE',
          message: (err as Error).message,
        });
      }
    }

    // Quantity Delta
    const rawDelta = data['quantitydelta'];
    if (!rawDelta || rawDelta.trim() === '') {
      errors.push({
        row: rowNumber,
        column: 'quantityDelta',
        value: rawDelta,
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Quantity delta is required.',
      });
    } else {
      try {
        StockQuantityValidator.validateNonZeroDelta(rawDelta);
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'quantityDelta',
          value: rawDelta,
          code: 'INVALID_QUANTITY',
          message: (err as Error).message,
        });
      }
    }

    // Type
    const rawType = (data['type'] || 'ADJUSTMENT').trim().toUpperCase();
    const allowedTypes = ['OPENING', 'RECEIPT', 'ISSUE', 'ADJUSTMENT'];
    if (!allowedTypes.includes(rawType)) {
      errors.push({
        row: rowNumber,
        column: 'type',
        value: data['type'],
        code: 'INVALID_MUTATION_TYPE',
        message: `Invalid mutation type "${data['type']}". Allowed values: ${allowedTypes.join(', ')}.`,
      });
    } else if (rawDelta && rawDelta.trim() !== '') {
      // Semantic delta sign validation
      try {
        StockQuantityValidator.validateMutationDelta(rawType as any, rawDelta);
      } catch (err) {
        errors.push({
          row: rowNumber,
          column: 'quantityDelta',
          value: rawDelta,
          code: 'INVALID_MUTATION_DELTA_SIGN',
          message: (err as Error).message,
        });
      }
    }

    return errors;
  }
}
