import { apiClient } from './client';
import type { CategoryDto, CategoryQueryParams } from '@repo/types';

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

export const categoriesApi = {
  list: (params?: CategoryQueryParams) =>
    apiClient<CategoryDto[]>(
      `/categories${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),
};
