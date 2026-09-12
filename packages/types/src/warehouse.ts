import { PaginationParams } from './domain.js';

export const WAREHOUSE_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;
export type WarehouseStatus = (typeof WAREHOUSE_STATUS_VALUES)[number];

export interface WarehouseDto {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  status: WarehouseStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
  description?: string | null | undefined;
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
  country?: string | null | undefined;
  status?: WarehouseStatus | undefined;
  isDefault?: boolean | undefined;
}

export interface UpdateWarehouseInput {
  name?: string | undefined;
  code?: string | undefined;
  description?: string | null | undefined;
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
  country?: string | null | undefined;
  status?: WarehouseStatus | undefined;
  isDefault?: boolean | undefined;
}

export const ALLOWED_WAREHOUSE_SORT_FIELDS = [
  'name',
  'code',
  'city',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type AllowedWarehouseSortField = (typeof ALLOWED_WAREHOUSE_SORT_FIELDS)[number];

export interface WarehouseQueryParams extends PaginationParams {
  search?: string | undefined;
  status?: WarehouseStatus | undefined;
  sortBy?: AllowedWarehouseSortField | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}
