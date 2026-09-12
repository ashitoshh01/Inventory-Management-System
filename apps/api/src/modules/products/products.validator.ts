import {
  UnitOfMeasure,
  UNIT_OF_MEASURE_VALUES,
  ProductStatus,
  PRODUCT_STATUS_VALUES,
} from '@repo/types';
import { ProductValidationException } from './products.errors';

export class ProductValidator {
  public static readonly MAX_SKU_LENGTH = 50;
  public static readonly MAX_NAME_LENGTH = 200;
  public static readonly MAX_DESCRIPTION_LENGTH = 1000;
  private static readonly SKU_REGEX = /^[A-Z0-9._-]+$/;

  /**
   * Deterministically normalizes and validates a SKU.
   * Rules:
   * 1. Trim whitespace.
   * 2. Convert to uppercase.
   * 3. Non-empty string.
   * 4. Length <= 50.
   * 5. No internal whitespace.
   * 6. Only alphanumeric, hyphen, underscore, period.
   */
  static normalizeSku(rawSku: unknown): string {
    if (typeof rawSku !== 'string') {
      throw new ProductValidationException('SKU must be a string');
    }

    const trimmed = rawSku.trim();
    if (trimmed.length === 0) {
      throw new ProductValidationException(
        'SKU is required and cannot be empty or whitespace-only',
      );
    }

    if (trimmed.length > this.MAX_SKU_LENGTH) {
      throw new ProductValidationException(
        `SKU cannot exceed ${this.MAX_SKU_LENGTH} characters (provided length: ${trimmed.length})`,
      );
    }

    if (/\s/.test(trimmed)) {
      throw new ProductValidationException('SKU cannot contain internal whitespace');
    }

    const normalized = trimmed.toUpperCase();

    if (!this.SKU_REGEX.test(normalized)) {
      throw new ProductValidationException(
        'SKU can only contain alphanumeric characters, hyphens, underscores, and periods',
      );
    }

    return normalized;
  }

  /**
   * Validates product name.
   * Rules:
   * 1. Required string.
   * 2. Trim whitespace.
   * 3. Non-empty.
   * 4. Length <= 200.
   */
  static validateName(rawName: unknown): string {
    if (typeof rawName !== 'string') {
      throw new ProductValidationException('Product name must be a string');
    }

    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
      throw new ProductValidationException(
        'Product name is required and cannot be empty or whitespace-only',
      );
    }

    if (trimmed.length > this.MAX_NAME_LENGTH) {
      throw new ProductValidationException(
        `Product name cannot exceed ${this.MAX_NAME_LENGTH} characters (provided length: ${trimmed.length})`,
      );
    }

    return trimmed;
  }

  /**
   * Validates optional product description.
   * Rules:
   * 1. Optional.
   * 2. If provided, string, trim, length <= 1000.
   */
  static validateDescription(rawDesc?: unknown): string | null {
    if (rawDesc === undefined || rawDesc === null) {
      return null;
    }

    if (typeof rawDesc !== 'string') {
      throw new ProductValidationException('Product description must be a string');
    }

    const trimmed = rawDesc.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new ProductValidationException(
        `Product description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  /**
   * Validates and defaults Unit of Measure.
   */
  static validateUnitOfMeasure(rawUom?: unknown): UnitOfMeasure {
    if (rawUom === undefined || rawUom === null) {
      return 'UNIT';
    }

    if (typeof rawUom !== 'string') {
      throw new ProductValidationException('Unit of measure must be a string');
    }

    const normalizedUom = rawUom.trim().toUpperCase() as UnitOfMeasure;
    if (!UNIT_OF_MEASURE_VALUES.includes(normalizedUom)) {
      throw new ProductValidationException(
        `Invalid unit of measure "${rawUom}". Allowed values: ${UNIT_OF_MEASURE_VALUES.join(', ')}`,
      );
    }

    return normalizedUom;
  }

  /**
   * Validates and defaults Product Status.
   */
  static validateStatus(rawStatus?: unknown): ProductStatus {
    if (rawStatus === undefined || rawStatus === null) {
      return 'ACTIVE';
    }

    if (typeof rawStatus !== 'string') {
      throw new ProductValidationException('Product status must be a string');
    }

    const normalizedStatus = rawStatus.trim().toUpperCase() as ProductStatus;
    if (!PRODUCT_STATUS_VALUES.includes(normalizedStatus)) {
      throw new ProductValidationException(
        `Invalid product status "${rawStatus}". Allowed values: ${PRODUCT_STATUS_VALUES.join(', ')}`,
      );
    }

    return normalizedStatus;
  }
}
