import { IsEnum, IsOptional, IsBoolean, IsIn, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../core/dto/pagination.dto';
import type { ImportJobType, ImportJobStatus } from '@repo/types';

export class PreviewImportDto {
  @IsEnum(['PRODUCT', 'STOCK'] as const, {
    message: 'type must be either PRODUCT or STOCK',
  })
  type!: ImportJobType;

  @IsOptional()
  @IsIn(['CREATE', 'UPSERT'])
  mode?: 'CREATE' | 'UPSERT' = 'CREATE';
}

export class CreateImportDto {
  @IsEnum(['PRODUCT', 'STOCK'] as const, {
    message: 'type must be either PRODUCT or STOCK',
  })
  type!: ImportJobType;

  @IsOptional()
  @IsIn(['CREATE', 'UPSERT'])
  mode?: 'CREATE' | 'UPSERT' = 'CREATE';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  dryRun?: boolean = false;
}

export class QueryImportJobDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(['PRODUCT', 'STOCK'] as const)
  type?: ImportJobType;

  @IsOptional()
  @IsEnum(['PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED'] as const)
  status?: ImportJobStatus;
}
