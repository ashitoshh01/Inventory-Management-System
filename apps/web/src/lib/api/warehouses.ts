import { apiClient } from './client';
import type {
  WarehouseDto,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseQueryParams,
  PaginatedResponse,
} from '@repo/types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const warehousesApi = {
  list: (params?: WarehouseQueryParams) =>
    apiClient<PaginatedResponse<WarehouseDto>['data']>(
      `/warehouses${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getById: (id: string) => apiClient<WarehouseDto>(`/warehouses/${id}`),

  getByCode: (code: string) =>
    apiClient<WarehouseDto>(`/warehouses/code/${encodeURIComponent(code)}`),

  create: (input: CreateWarehouseInput) =>
    apiClient<WarehouseDto>('/warehouses', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateWarehouseInput) =>
    apiClient<WarehouseDto>(`/warehouses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    apiClient<void>(`/warehouses/${id}`, {
      method: 'DELETE',
    }),
};
