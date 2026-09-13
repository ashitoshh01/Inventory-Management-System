import { PaginationParams } from './domain.js';

export const CUSTOMER_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUS_VALUES)[number];

export const ALLOWED_CUSTOMER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'email',
  'status',
] as const;
export type AllowedCustomerSortField = (typeof ALLOWED_CUSTOMER_SORT_FIELDS)[number];

export interface CustomerDto {
  id: string;
  organizationId: string;
  name: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  status?: CustomerStatus | undefined;
}

export interface UpdateCustomerInput {
  name?: string | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  status?: CustomerStatus | undefined;
}

export interface CustomerQueryParams extends PaginationParams {
  status?: CustomerStatus | undefined;
  search?: string | undefined;
  sortBy?: AllowedCustomerSortField | undefined;
}
