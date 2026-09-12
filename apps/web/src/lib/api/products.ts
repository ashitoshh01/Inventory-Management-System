import { apiClient } from './client';
import type {
  ProductDto,
  CreateProductInput,
  UpdateProductInput,
  ProductQueryParams,
} from '@repo/types';
import type { PaginatedResponse } from '@repo/types';

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

export const productsApi = {
  list: (params?: ProductQueryParams) =>
    apiClient<PaginatedResponse<ProductDto>['data']>(
      `/products${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getById: (id: string) => apiClient<ProductDto>(`/products/${id}`),

  getBySku: (sku: string) => apiClient<ProductDto>(`/products/sku/${encodeURIComponent(sku)}`),

  create: (input: CreateProductInput) =>
    apiClient<ProductDto>('/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateProductInput) =>
    apiClient<ProductDto>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    apiClient<{ message: string; id: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),
};
