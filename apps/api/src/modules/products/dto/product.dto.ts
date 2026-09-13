import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  UnitOfMeasure,
  UNIT_OF_MEASURE_VALUES,
  ProductStatus,
  PRODUCT_STATUS_VALUES,
} from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';

export const ALLOWED_PRODUCT_SORT_FIELDS = [
  'name',
  'sku',
  'createdAt',
  'updatedAt',
  'status',
  'unitOfMeasure',
] as const;
export type AllowedProductSortField = (typeof ALLOWED_PRODUCT_SORT_FIELDS)[number];

export class CreateProductDto {
  @IsString({ message: 'SKU must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'SKU is required and cannot be empty' })
  @MaxLength(50, { message: 'SKU cannot exceed 50 characters' })
  sku!: string;

  @IsString({ message: 'Product name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Product name is required and cannot be empty' })
  @MaxLength(200, { message: 'Product name cannot exceed 200 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Product description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'Product description cannot exceed 1000 characters' })
  description?: string;

  @IsUUID('4', { message: 'Category ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId!: string;

  @IsOptional()
  @IsIn(UNIT_OF_MEASURE_VALUES, {
    message: `Unit of measure must be one of: ${UNIT_OF_MEASURE_VALUES.join(', ')}`,
  })
  unitOfMeasure?: UnitOfMeasure;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES, {
    message: `Product status must be one of: ${PRODUCT_STATUS_VALUES.join(', ')}`,
  })
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Unit cost must be a valid decimal number with up to 4 decimal places',
  })
  unitCost?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Unit price must be a valid decimal number with up to 4 decimal places',
  })
  unitPrice?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString({ message: 'SKU must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'SKU cannot be empty when provided' })
  @MaxLength(50, { message: 'SKU cannot exceed 50 characters' })
  sku?: string;

  @IsOptional()
  @IsString({ message: 'Product name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Product name cannot be empty when provided' })
  @MaxLength(200, { message: 'Product name cannot exceed 200 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Product description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'Product description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUIDv4' })
  categoryId?: string;

  @IsOptional()
  @IsIn(UNIT_OF_MEASURE_VALUES, {
    message: `Unit of measure must be one of: ${UNIT_OF_MEASURE_VALUES.join(', ')}`,
  })
  unitOfMeasure?: UnitOfMeasure;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES, {
    message: `Product status must be one of: ${PRODUCT_STATUS_VALUES.join(', ')}`,
  })
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Unit cost must be a valid decimal number with up to 4 decimal places',
  })
  unitCost?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Unit price must be a valid decimal number with up to 4 decimal places',
  })
  unitPrice?: string;
}

export class QueryProductDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Category ID filter must be a valid UUIDv4' })
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES, {
    message: `Product status filter must be one of: ${PRODUCT_STATUS_VALUES.join(', ')}`,
  })
  status?: ProductStatus;

  @IsOptional()
  @IsIn(UNIT_OF_MEASURE_VALUES, {
    message: `Unit of measure filter must be one of: ${UNIT_OF_MEASURE_VALUES.join(', ')}`,
  })
  unitOfMeasure?: UnitOfMeasure;

  getSafeSortBy(): AllowedProductSortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_PRODUCT_SORT_FIELDS],
      'createdAt',
    ) as AllowedProductSortField;
  }
}
