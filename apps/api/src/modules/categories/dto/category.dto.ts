import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';

export const ALLOWED_CATEGORY_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;
export type AllowedCategorySortField = (typeof ALLOWED_CATEGORY_SORT_FIELDS)[number];

export class CreateCategoryDto {
  @IsString({ message: 'Category name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Category name is required and cannot be empty' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Category description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'Category description cannot exceed 500 characters' })
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'Category name must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Category name cannot be empty when provided' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Category description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'Category description cannot exceed 500 characters' })
  description?: string;
}

export class QueryCategoryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  getSafeSortBy(): AllowedCategorySortField {
    return validateSortField(
      this.sortBy,
      [...ALLOWED_CATEGORY_SORT_FIELDS],
      'createdAt',
    ) as AllowedCategorySortField;
  }
}
