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
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  StockTransferStatus,
  STOCK_TRANSFER_STATUS_VALUES,
  ALLOWED_STOCK_TRANSFER_SORT_FIELDS,
  AllowedStockTransferSortField,
} from '@repo/types';
import { PaginationQueryDto, validateSortField } from '../../core/dto/pagination.dto';
import { IsExactDecimalQuantity } from '../../purchase-orders/dto/purchase-order.dto';

export class CreateStockTransferLineDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsString({ message: 'Quantity must be a string' })
  @IsNotEmpty({ message: 'Quantity is required' })
  @IsExactDecimalQuantity()
  quantity!: string;

  @IsOptional()
  @IsString({ message: 'Line notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Line notes cannot exceed 2000 characters' })
  notes?: string;
}

export class CreateStockTransferDto {
  @IsOptional()
  @IsString({ message: 'Transfer number must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Transfer number cannot exceed 50 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Transfer number can only contain letters, numbers, hyphens, and underscores',
  })
  transferNumber?: string;

  @IsUUID('4', { message: 'Source warehouse ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Source warehouse ID is required' })
  sourceWarehouseId!: string;

  @IsUUID('4', { message: 'Destination warehouse ID must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'Destination warehouse ID is required' })
  destinationWarehouseId!: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, { message: 'Stock transfer must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferLineDto)
  lines!: CreateStockTransferLineDto[];

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  idempotencyKey?: string;
}

export class UpdateStockTransferDto {
  @IsOptional()
  @IsUUID('4', { message: 'Source warehouse ID must be a valid UUIDv4' })
  sourceWarehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Destination warehouse ID must be a valid UUIDv4' })
  destinationWarehouseId?: string;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Lines must be an array' })
  @ArrayMinSize(1, { message: 'Stock transfer must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferLineDto)
  lines?: CreateStockTransferLineDto[];
}

export class QueryStockTransferDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUIDv4' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Source warehouse ID must be a valid UUIDv4' })
  sourceWarehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Destination warehouse ID must be a valid UUIDv4' })
  destinationWarehouseId?: string;

  @IsOptional()
  @IsIn(STOCK_TRANSFER_STATUS_VALUES, { message: 'Invalid status filter value' })
  status?: StockTransferStatus;

  @IsOptional()
  @IsString({ message: 'Transfer number filter must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  transferNumber?: string;

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    validateSortField(
      value as string | undefined,
      [...ALLOWED_STOCK_TRANSFER_SORT_FIELDS],
      'createdAt',
    ),
  )
  override sortBy: AllowedStockTransferSortField = 'createdAt';
}

export class ShipStockTransferDto {
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  idempotencyKey?: string;
}

export class ReceiveStockTransferDto {
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Idempotency key must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Idempotency key cannot exceed 100 characters' })
  idempotencyKey?: string;
}
