import { IsOptional, IsString, IsUUID, IsInt, Min, Max, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryReportDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  discrepancyOnly?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'desc';

  getSkip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }

  getTake(): number {
    return this.limit ?? 20;
  }
}

export class ExportReportDto extends QueryReportDto {
  @IsString()
  @IsIn(['stock-movement', 'inventory-valuation', 'reconciliation', 'procurement', 'sales'])
  reportType!: 'stock-movement' | 'inventory-valuation' | 'reconciliation' | 'procurement' | 'sales';
}
