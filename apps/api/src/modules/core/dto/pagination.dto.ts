import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationMeta, PaginatedResponse, SortOrder } from '@repo/types';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrder = 'desc';

  getSkip(): number {
    return (this.page - 1) * this.limit;
  }

  getTake(): number {
    return this.limit;
  }
}

/**
 * Builds standard PaginationMeta for API envelopes.
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(total / safeLimit);
  return {
    total,
    page,
    limit: safeLimit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Formats a paginated collection into the standard API data envelope.
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  requestId?: string,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      ...buildPaginationMeta(total, page, limit),
      ...(requestId ? { requestId } : {}),
    },
  };
}

/**
 * Ensures sort field belongs to a strict allowlist.
 * Prevents arbitrary field injection.
 */
export function validateSortField(
  requestedField: string | undefined,
  allowedFields: string[],
  defaultField = 'createdAt',
): string {
  if (!requestedField) {
    return defaultField;
  }
  return allowedFields.includes(requestedField) ? requestedField : defaultField;
}
