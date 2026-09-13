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
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  SalesOrderStatus,
  SALES_ORDER_STATUS_VALUES,
  ALLOWED_SALES_ORDER_SORT_FIELDS,
  AllowedSalesOrderSortField,
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

export class CreateSalesOrderLineDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsExactDecimalQuantity()
  @IsNotEmpty({ message: 'Quantity is required' })
  quantity!: string;

  @IsExactDecimalMoney()
  @IsNotEmpty({ message: 'Unit price is required' })
  unitPrice!: string;

  @IsOptional()
  @IsString({ message: 'Line item notes must be a string' })
  @MaxLength(500, { message: 'Line item notes cannot exceed 500 characters' })
  notes?: string;
}

export class CreateSalesOrderDto {
  @IsString({ message: 'Sales order number must be a string' })
  @IsNotEmpty({ message: 'Sales order number is required' })
  @MaxLength(50, { message: 'Sales order number cannot exceed 50 characters' })
  salesOrderNumber!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Customer ID must be a valid UUIDv4' })
  customerId?: string;

  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(200, { message: 'Customer name cannot exceed 200 characters' })
  customerName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid customer email address format' })
  @MaxLength(255, { message: 'Customer email cannot exceed 255 characters' })
  customerEmail?: string;

  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Warehouse ID is required' })
  warehouseId!: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Order date must be a valid ISO 8601 date string' })
  orderDate?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Expected date must be a valid ISO 8601 date string' })
  expectedDate?: string;

  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @MaxLength(10, { message: 'Currency cannot exceed 10 characters' })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  idempotencyKey?: string;

  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, { message: 'Sales order must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderLineDto)
  lines!: CreateSalesOrderLineDto[];
}

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsUUID('4', { message: 'Customer ID must be a valid UUIDv4' })
  customerId?: string;

  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name cannot be empty' })
  @MaxLength(200, { message: 'Customer name cannot exceed 200 characters' })
  customerName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid customer email address format' })
  @MaxLength(255, { message: 'Customer email cannot exceed 255 characters' })
  customerEmail?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Order date must be a valid ISO 8601 date string' })
  orderDate?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Expected date must be a valid ISO 8601 date string' })
  expectedDate?: string;

  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @MaxLength(10, { message: 'Currency cannot exceed 10 characters' })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, { message: 'Sales order must contain at least one line item if lines are updated' })
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderLineDto)
  lines?: CreateSalesOrderLineDto[];
}

export class CancelSalesOrderDto {
  @IsString({ message: 'Cancellation reason must be a string' })
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @MaxLength(500, { message: 'Cancellation reason cannot exceed 500 characters' })
  reason!: string;
}

export class SalesOrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsIn(SALES_ORDER_STATUS_VALUES, {
    message: `Status must be one of: ${SALES_ORDER_STATUS_VALUES.join(', ')}`,
  })
  status?: SalesOrderStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Customer ID must be a valid UUIDv4' })
  customerId?: string;

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(100, { message: 'Search query cannot exceed 100 characters' })
  search?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Start date must be a valid ISO 8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'End date must be a valid ISO 8601 date string' })
  endDate?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    validateSortField(
      value as string | undefined,
      [...ALLOWED_SALES_ORDER_SORT_FIELDS],
      'createdAt',
    ),
  )
  override sortBy: AllowedSalesOrderSortField = 'createdAt';

  getSafeSortBy(): AllowedSalesOrderSortField {
    return this.sortBy;
  }
}
