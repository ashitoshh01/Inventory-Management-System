/**
 * Domain-wide shared primitives, value contracts, and pagination conventions.
 */

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta & {
    requestId?: string;
  };
}

export interface MoneyValue {
  amountMinor: string; // Serialized string to avoid JSON 64-bit integer truncation
  currency: string;
  formatted: string;
}

export interface QuantityValue {
  value: string; // Exact decimal representation (up to 4 decimal places)
  unit?: string;
}

export interface DomainEntityReference {
  id: string;
  organizationId: string;
}
