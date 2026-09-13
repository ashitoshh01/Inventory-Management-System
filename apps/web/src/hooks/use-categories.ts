'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../lib/api/categories';
import type {
  CategoryQueryParams,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const categoryKeys = {
  all: (orgId?: string) => ['categories', orgId ?? getActiveOrgId()] as const,
  lists: (orgId?: string) => [...categoryKeys.all(orgId), 'list'] as const,
  list: (orgId?: string, params?: CategoryQueryParams) =>
    [...categoryKeys.lists(orgId), params] as const,
  details: (orgId?: string) => [...categoryKeys.all(orgId), 'detail'] as const,
  detail: (orgId?: string, id?: string) => [...categoryKeys.details(orgId), id ?? ''] as const,
};

export function useCategories(params?: CategoryQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: categoryKeys.list(currentOrgId, params),
    queryFn: () => categoriesApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCategory(id: string | undefined, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: categoryKeys.detail(currentOrgId, id),
    queryFn: () => categoriesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateCategory(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (data: CreateCategoryPayload) => categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists(currentOrgId) });
    },
  });
}

export function useUpdateCategory(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryPayload }) =>
      categoriesApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists(currentOrgId) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(currentOrgId, variables.id) });
    },
  });
}

export function useDeleteCategory(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists(currentOrgId) });
    },
  });
}
