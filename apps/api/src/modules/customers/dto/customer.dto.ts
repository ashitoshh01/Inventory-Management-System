import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  CustomerStatus,
  CUSTOMER_STATUS_VALUES,
  ALLOWED_CUSTOMER_SORT_FIELDS,
  AllowedCustomerSortField,
} from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';

export class CreateCustomerDto {
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(200, { message: 'Customer name cannot exceed 200 characters' })
  name!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid customer email address format' })
  @MaxLength(255, { message: 'Customer email cannot exceed 255 characters' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(50, { message: 'Phone cannot exceed 50 characters' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(500, { message: 'Address cannot exceed 500 characters' })
  address?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS_VALUES, {
    message: `Status must be one of: ${CUSTOMER_STATUS_VALUES.join(', ')}`,
  })
  status?: CustomerStatus;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name cannot be empty' })
  @MaxLength(200, { message: 'Customer name cannot exceed 200 characters' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid customer email address format' })
  @MaxLength(255, { message: 'Customer email cannot exceed 255 characters' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(50, { message: 'Phone cannot exceed 50 characters' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(500, { message: 'Address cannot exceed 500 characters' })
  address?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS_VALUES, {
    message: `Status must be one of: ${CUSTOMER_STATUS_VALUES.join(', ')}`,
  })
  status?: CustomerStatus;
}

export class CustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CUSTOMER_STATUS_VALUES, {
    message: `Status must be one of: ${CUSTOMER_STATUS_VALUES.join(', ')}`,
  })
  status?: CustomerStatus;

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(100, { message: 'Search query cannot exceed 100 characters' })
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    validateSortField(
      value as string | undefined,
      [...ALLOWED_CUSTOMER_SORT_FIELDS],
      'createdAt',
    ),
  )
  override sortBy: AllowedCustomerSortField = 'createdAt';

  getSafeSortBy(): AllowedCustomerSortField {
    return this.sortBy;
  }
}
