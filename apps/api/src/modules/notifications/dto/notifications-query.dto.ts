import { IsOptional, IsString, IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { NotificationType } from '@repo/types';

export class QueryNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['LOW_STOCK', 'OUT_OF_STOCK', 'EXPORT_READY', 'EXPORT_FAILED', 'SYSTEM'])
  type?: NotificationType;

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

  getSkip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }

  getTake(): number {
    return this.limit ?? 20;
  }
}
