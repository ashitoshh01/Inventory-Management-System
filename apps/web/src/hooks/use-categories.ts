'use client';

import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../lib/api/categories';
import type { CategoryQueryParams } from '@repo/types';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (params?: CategoryQueryParams) => [...categoryKeys.lists(), params] as const,
};

export function useCategories(params?: CategoryQueryParams) {
  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(params),
  });
}
