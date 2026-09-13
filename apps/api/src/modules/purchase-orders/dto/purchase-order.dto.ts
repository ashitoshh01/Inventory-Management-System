import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsEmail,
  IsISO8601,
  IsBoolean,
  Length,
  Matches,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  PurchaseOrderStatus,
  PURCHASE_ORDER_STATUS_VALUES,
  ALLOWED_PURCHASE_ORDER_SORT_FIELDS,
  AllowedPurchaseOrderSortField,
} from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';
import { QuantityUtil } from '../../core/utils/quantity.util';

/**
 * Custom decorator ensuring an exact positive decimal string representation
 * with at most 4 decimal places and value strictly > 0.
 */
export function IsExactDecimalQuantity(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isExactDecimalQuantity',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'Quantity must be an exact positive decimal string with at most 4 decimal places',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (!trimmed) return false;
          // Exact positive decimal format: strictly digits, optional dot with 1-4 digits
          const decimalRegex = /^\d+(\.\d{1,4})?$/;
          if (!decimalRegex.test(trimmed)) return false;
          try {
            return QuantityUtil.isPositive(trimmed, 4);
          } catch {
            return false;
          }
        },
      },
    });
  };
}

/**
 * Custom decorator ensuring an exact non-negative decimal string representation
 * with at most 4 decimal places and value >= 0.
 */
export function IsExactDecimalMoney(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isExactDecimalMoney',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message:
          'Unit price must be an exact non-negative decimal string with at most 4 decimal places',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (!trimmed) return false;
          // Exact non-negative decimal format: strictly digits, optional dot with 1-4 digits
          const decimalRegex = /^\d+(\.\d{1,4})?$/;
          if (!decimalRegex.test(trimmed)) return false;
          try {
            const scaled = QuantityUtil.toScaledInteger(trimmed, 4);
            return scaled >= 0n;
          } catch {
            return false;
          }
        },
      },
    });
  };
}

export class CreatePurchaseOrderLineDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsString({ message: 'Quantity must be a string' })
  @IsNotEmpty({ message: 'Quantity is required' })
  @IsExactDecimalQuantity()
  quantity!: string;

  @IsString({ message: 'Unit price must be a string' })
  @IsNotEmpty({ message: 'Unit price is required' })
  @IsExactDecimalMoney()
  unitPrice!: string;

  @IsOptional()
  @IsString({ message: 'Line notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Line notes cannot exceed 2000 characters' })
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsString({ message: 'Purchase order number must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Purchase order number is required' })
  @MaxLength(50, { message: 'Purchase order number cannot exceed 50 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Purchase order number can only contain letters, numbers, hyphens, and underscores',
  })
  purchaseOrderNumber!: string;

  @IsString({ message: 'Supplier name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Supplier name is required' })
  @MaxLength(255, { message: 'Supplier name cannot exceed 255 characters' })
  supplierName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Supplier email must be a valid email address' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(255, { message: 'Supplier email cannot exceed 255 characters' })
  supplierEmail?: string;

  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Warehouse ID is required' })
  warehouseId!: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Order date must be a valid ISO 8601 date string' })
  orderDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Expected date must be a valid ISO 8601 date string' })
  expectedDate?: string;

  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Length(3, 3, { message: 'Currency must be a 3-character ISO code (e.g., INR, USD)' })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, { message: 'Purchase order must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Idempotency key can only contain alphanumeric characters, underscores, and hyphens',
  })
  idempotencyKey?: string;
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString({ message: 'Supplier name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Supplier name cannot be empty when provided' })
  @MaxLength(255, { message: 'Supplier name cannot exceed 255 characters' })
  supplierName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Supplier email must be a valid email address' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(255, { message: 'Supplier email cannot exceed 255 characters' })
  supplierEmail?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Order date must be a valid ISO 8601 date string' })
  orderDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Expected date must be a valid ISO 8601 date string' })
  expectedDate?: string;

  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Length(3, 3, { message: 'Currency must be a 3-character ISO code (e.g., INR, USD)' })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, {
    message: 'Purchase order must contain at least one line item when updating lines',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines?: CreatePurchaseOrderLineDto[];
}

export class QueryPurchaseOrderDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsIn(PURCHASE_ORDER_STATUS_VALUES, {
    message: `Status must be one of: ${PURCHASE_ORDER_STATUS_VALUES.join(', ')}`,
  })
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID filter must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  supplierName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  purchaseOrderNumber?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOverdue?: boolean | string;

  @IsOptional()
  @IsIn(['OUTSTANDING', 'RECEIVED'], {
    message: 'receivingState must be either OUTSTANDING or RECEIVED',
  })
  receivingState?: 'OUTSTANDING' | 'RECEIVED';

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;

  @IsOptional()
  @IsIn(ALLOWED_PURCHASE_ORDER_SORT_FIELDS, {
    message: `Sort field must be one of: ${ALLOWED_PURCHASE_ORDER_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: AllowedPurchaseOrderSortField = undefined;

  public getSafeSortBy(): AllowedPurchaseOrderSortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_PURCHASE_ORDER_SORT_FIELDS],
      'createdAt',
    ) as AllowedPurchaseOrderSortField;
  }
}

export class ReceivePurchaseOrderItemDto {
  @IsUUID('4', { message: 'Purchase order line ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Purchase order line ID is required' })
  purchaseOrderLineId!: string;

  @IsExactDecimalQuantity({
    message:
      'Receipt quantity must be an exact positive decimal string with at most 4 decimal places',
  })
  quantity!: string;
}

export class ReceivePurchaseOrderDto {
  @IsArray({ message: 'Lines must be an array of receipt line items' })
  @ArrayMinSize(1, { message: 'At least one line item must be received' })
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  lines!: ReceivePurchaseOrderItemDto[];

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes must not exceed 1000 characters' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string | null;
}
