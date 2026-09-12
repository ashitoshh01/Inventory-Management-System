import { WarehouseStatus, WAREHOUSE_STATUS_VALUES } from '@repo/types';
import { WarehouseValidationException } from './warehouses.errors';

export class WarehouseValidator {
  public static readonly MIN_NAME_LENGTH = 2;
  public static readonly MAX_NAME_LENGTH = 100;
  public static readonly MIN_CODE_LENGTH = 2;
  public static readonly MAX_CODE_LENGTH = 50;
  public static readonly MAX_DESCRIPTION_LENGTH = 1000;
  public static readonly MAX_ADDRESS_FIELD_LENGTH = 200;
  private static readonly CODE_REGEX = /^[A-Z0-9_-]+$/;

  /**
   * Deterministically normalizes and validates a warehouse code.
   * Rules:
   * 1. Trim whitespace.
   * 2. Convert to uppercase.
   * 3. Non-empty string.
   * 4. Length between 2 and 50.
   * 5. No internal whitespace.
   * 6. Alphanumeric characters, hyphens, and underscores only.
   */
  static normalizeCode(rawCode: unknown): string {
    if (typeof rawCode !== 'string') {
      throw new WarehouseValidationException('Warehouse code must be a string');
    }

    const trimmed = rawCode.trim();
    if (trimmed.length === 0) {
      throw new WarehouseValidationException(
        'Warehouse code is required and cannot be empty or whitespace-only',
      );
    }

    if (trimmed.length < this.MIN_CODE_LENGTH || trimmed.length > this.MAX_CODE_LENGTH) {
      throw new WarehouseValidationException(
        `Warehouse code must be between ${this.MIN_CODE_LENGTH} and ${this.MAX_CODE_LENGTH} characters`,
      );
    }

    if (/\s/.test(trimmed)) {
      throw new WarehouseValidationException('Warehouse code cannot contain whitespace');
    }

    const normalized = trimmed.toUpperCase();

    if (!this.CODE_REGEX.test(normalized)) {
      throw new WarehouseValidationException(
        'Warehouse code can only contain uppercase alphanumeric characters, hyphens, and underscores',
      );
    }

    return normalized;
  }

  /**
   * Validates warehouse name.
   * Rules:
   * 1. Required string.
   * 2. Trim whitespace.
   * 3. Length between 2 and 100.
   */
  static validateName(rawName: unknown): string {
    if (typeof rawName !== 'string') {
      throw new WarehouseValidationException('Warehouse name must be a string');
    }

    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
      throw new WarehouseValidationException(
        'Warehouse name is required and cannot be empty or whitespace-only',
      );
    }

    if (trimmed.length < this.MIN_NAME_LENGTH || trimmed.length > this.MAX_NAME_LENGTH) {
      throw new WarehouseValidationException(
        `Warehouse name must be between ${this.MIN_NAME_LENGTH} and ${this.MAX_NAME_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  /**
   * Validates optional warehouse description.
   */
  static validateDescription(rawDesc?: unknown): string | null {
    if (rawDesc === undefined || rawDesc === null) {
      return null;
    }

    if (typeof rawDesc !== 'string') {
      throw new WarehouseValidationException('Warehouse description must be a string');
    }

    const trimmed = rawDesc.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new WarehouseValidationException(
        `Warehouse description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  /**
   * Validates optional address fields (addressLine1, addressLine2, city, state, postalCode, country).
   */
  static validateAddressField(fieldName: string, rawVal?: unknown): string | null {
    if (rawVal === undefined || rawVal === null) {
      return null;
    }

    if (typeof rawVal !== 'string') {
      throw new WarehouseValidationException(`${fieldName} must be a string`);
    }

    const trimmed = rawVal.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.length > this.MAX_ADDRESS_FIELD_LENGTH) {
      throw new WarehouseValidationException(
        `${fieldName} cannot exceed ${this.MAX_ADDRESS_FIELD_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  /**
   * Validates and defaults Warehouse Status.
   */
  static validateStatus(rawStatus?: unknown): WarehouseStatus {
    if (rawStatus === undefined || rawStatus === null) {
      return 'ACTIVE';
    }

    if (typeof rawStatus !== 'string') {
      throw new WarehouseValidationException('Warehouse status must be a string');
    }

    const normalizedStatus = rawStatus.trim().toUpperCase() as WarehouseStatus;
    if (!WAREHOUSE_STATUS_VALUES.includes(normalizedStatus)) {
      throw new WarehouseValidationException(
        `Invalid warehouse status "${rawStatus}". Allowed values: ${WAREHOUSE_STATUS_VALUES.join(', ')}`,
      );
    }

    return normalizedStatus;
  }
}
