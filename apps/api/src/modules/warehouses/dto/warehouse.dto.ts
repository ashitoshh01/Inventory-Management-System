import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  WarehouseStatus,
  WAREHOUSE_STATUS_VALUES,
  ALLOWED_WAREHOUSE_SORT_FIELDS,
  AllowedWarehouseSortField,
} from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';

export class CreateWarehouseDto {
  @IsString({ message: 'Warehouse name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Warehouse name is required and cannot be empty' })
  @MinLength(2, { message: 'Warehouse name must be between 2 and 100 characters' })
  @MaxLength(100, { message: 'Warehouse name must be between 2 and 100 characters' })
  name!: string;

  @IsString({ message: 'Warehouse code must be a string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsNotEmpty({ message: 'Warehouse code is required and cannot be empty' })
  @MinLength(2, { message: 'Warehouse code must be between 2 and 50 characters' })
  @MaxLength(50, { message: 'Warehouse code must be between 2 and 50 characters' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Warehouse code can only contain uppercase alphanumeric characters, hyphens, and underscores',
  })
  code!: string;

  @IsOptional()
  @IsString({ message: 'Warehouse description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'Warehouse description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Address line 1 must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Address line 1 cannot exceed 200 characters' })
  addressLine1?: string;

  @IsOptional()
  @IsString({ message: 'Address line 2 must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Address line 2 cannot exceed 200 characters' })
  addressLine2?: string;

  @IsOptional()
  @IsString({ message: 'City must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'City cannot exceed 200 characters' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'State must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'State cannot exceed 200 characters' })
  state?: string;

  @IsOptional()
  @IsString({ message: 'Postal code must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Postal code cannot exceed 200 characters' })
  postalCode?: string;

  @IsOptional()
  @IsString({ message: 'Country must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Country cannot exceed 200 characters' })
  country?: string;

  @IsOptional()
  @IsIn(WAREHOUSE_STATUS_VALUES, {
    message: `Warehouse status must be one of: ${WAREHOUSE_STATUS_VALUES.join(', ')}`,
  })
  status?: WarehouseStatus;

  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString({ message: 'Warehouse name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Warehouse name cannot be empty when provided' })
  @MinLength(2, { message: 'Warehouse name must be between 2 and 100 characters' })
  @MaxLength(100, { message: 'Warehouse name must be between 2 and 100 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Warehouse code must be a string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsNotEmpty({ message: 'Warehouse code cannot be empty when provided' })
  @MinLength(2, { message: 'Warehouse code must be between 2 and 50 characters' })
  @MaxLength(50, { message: 'Warehouse code must be between 2 and 50 characters' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Warehouse code can only contain uppercase alphanumeric characters, hyphens, and underscores',
  })
  code?: string;

  @IsOptional()
  @IsString({ message: 'Warehouse description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'Warehouse description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Address line 1 must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Address line 1 cannot exceed 200 characters' })
  addressLine1?: string;

  @IsOptional()
  @IsString({ message: 'Address line 2 must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Address line 2 cannot exceed 200 characters' })
  addressLine2?: string;

  @IsOptional()
  @IsString({ message: 'City must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'City cannot exceed 200 characters' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'State must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'State cannot exceed 200 characters' })
  state?: string;

  @IsOptional()
  @IsString({ message: 'Postal code must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Postal code cannot exceed 200 characters' })
  postalCode?: string;

  @IsOptional()
  @IsString({ message: 'Country must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200, { message: 'Country cannot exceed 200 characters' })
  country?: string;

  @IsOptional()
  @IsIn(WAREHOUSE_STATUS_VALUES, {
    message: `Warehouse status must be one of: ${WAREHOUSE_STATUS_VALUES.join(', ')}`,
  })
  status?: WarehouseStatus;

  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}

export class QueryWarehouseDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsIn(WAREHOUSE_STATUS_VALUES, {
    message: `Warehouse status filter must be one of: ${WAREHOUSE_STATUS_VALUES.join(', ')}`,
  })
  status?: WarehouseStatus;

  @IsOptional()
  @IsIn(ALLOWED_WAREHOUSE_SORT_FIELDS, {
    message: `Sort field must be one of: ${ALLOWED_WAREHOUSE_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: AllowedWarehouseSortField = undefined;

  getSafeSortBy(): AllowedWarehouseSortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_WAREHOUSE_SORT_FIELDS],
      'createdAt',
    ) as AllowedWarehouseSortField;
  }
}
