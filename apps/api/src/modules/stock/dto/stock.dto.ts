import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  Matches,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StockLedgerEntryType, STOCK_LEDGER_ENTRY_TYPE_VALUES } from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';

export const ALLOWED_STOCK_BALANCE_SORT_FIELDS = [
  'quantity',
  'createdAt',
  'updatedAt',
  'productId',
  'warehouseId',
] as const;
export type AllowedStockBalanceSortField = (typeof ALLOWED_STOCK_BALANCE_SORT_FIELDS)[number];

export const ALLOWED_STOCK_LEDGER_SORT_FIELDS = [
  'createdAt',
  'quantityDelta',
  'quantityBefore',
  'quantityAfter',
  'type',
] as const;
export type AllowedStockLedgerSortField = (typeof ALLOWED_STOCK_LEDGER_SORT_FIELDS)[number];

/**
 * Custom decorator ensuring an exact decimal string representation with at most 4 decimal places
 * and strictly non-zero value.
 */
export function IsExactDecimalQuantity(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isExactDecimalQuantity',
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          const trimmed = value.trim();
          if (!trimmed) {
            return false;
          }
          // Exact decimal format: optional leading '-', integer part, optional fractional part with 1-4 digits
          const decimalRegex = /^-?\d+(\.\d{1,4})?$/;
          if (!decimalRegex.test(trimmed)) {
            return false;
          }
          // Ensure non-zero
          const num = Number(trimmed);
          if (isNaN(num) || num === 0) {
            return false;
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a non-zero exact decimal string with at most 4 decimal places (e.g. "10.0000" or "-5.2500")`;
        },
      },
    });
  };
}

export class CreateStockMutationDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Warehouse ID is required' })
  warehouseId!: string;

  @IsIn(STOCK_LEDGER_ENTRY_TYPE_VALUES, {
    message: `Type must be one of: ${STOCK_LEDGER_ENTRY_TYPE_VALUES.join(', ')}`,
  })
  @IsNotEmpty({ message: 'Type is required' })
  type!: StockLedgerEntryType;

  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    if (typeof obj?.quantityDelta !== 'string') {
      return null;
    }
    return obj.quantityDelta;
  })
  @IsString({ message: 'quantityDelta must be a string' })
  @IsNotEmpty({ message: 'quantityDelta is required' })
  @IsExactDecimalQuantity({
    message:
      'quantityDelta must be a non-zero exact decimal string with at most 4 decimal places (e.g. "10.0000" or "-5.2500")',
  })
  quantityDelta!: string;

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Idempotency key can only contain alphanumeric characters, underscores, and hyphens',
  })
  idempotencyKey?: string;

  @IsOptional()
  @IsString({ message: 'Reference type must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Reference type cannot exceed 50 characters' })
  referenceType?: string;

  @IsOptional()
  @IsString({ message: 'Reference ID must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Reference ID cannot exceed 100 characters' })
  referenceId?: string;

  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, unknown>;
}

export class QueryStockBalanceDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Product ID filter must be a valid UUIDv4' })
  productId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID filter must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsIn(ALLOWED_STOCK_BALANCE_SORT_FIELDS, {
    message: `Sort field must be one of: ${ALLOWED_STOCK_BALANCE_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: AllowedStockBalanceSortField = undefined;

  getSafeSortBy(): AllowedStockBalanceSortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_STOCK_BALANCE_SORT_FIELDS],
      'createdAt',
    ) as AllowedStockBalanceSortField;
  }
}

export class QueryStockLedgerDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Product ID filter must be a valid UUIDv4' })
  productId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID filter must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsIn(STOCK_LEDGER_ENTRY_TYPE_VALUES, {
    message: `Type filter must be one of: ${STOCK_LEDGER_ENTRY_TYPE_VALUES.join(', ')}`,
  })
  type?: StockLedgerEntryType;

  @IsOptional()
  @IsIn(ALLOWED_STOCK_LEDGER_SORT_FIELDS, {
    message: `Sort field must be one of: ${ALLOWED_STOCK_LEDGER_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: AllowedStockLedgerSortField = undefined;

  getSafeSortBy(): AllowedStockLedgerSortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_STOCK_LEDGER_SORT_FIELDS],
      'createdAt',
    ) as AllowedStockLedgerSortField;
  }
}
