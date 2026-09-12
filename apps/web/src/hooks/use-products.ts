'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../lib/api/products';
import type { ProductQueryParams, CreateProductInput, UpdateProductInput } from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const productKeys = {
  all: (orgId?: string) => ['products', orgId ?? getActiveOrgId()] as const,
  lists: (orgId?: string) => [...productKeys.all(orgId), 'list'] as const,
  list: (orgId?: string, params?: ProductQueryParams) =>
    [...productKeys.lists(orgId), params] as const,
  details: (orgId?: string) => [...productKeys.all(orgId), 'detail'] as const,
  detail: (orgId?: string, id?: string) => [...productKeys.details(orgId), id ?? ''] as const,
};

export function useProducts(params?: ProductQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: productKeys.list(currentOrgId, params),
    queryFn: () => productsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useProduct(id: string | undefined, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: productKeys.detail(currentOrgId, id),
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateProduct(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (input: CreateProductInput) => productsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(currentOrgId) });
    },
  });
}

export function useUpdateProduct(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      productsApi.update(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(currentOrgId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(currentOrgId, variables.id) });
    },
  });
}

export function useDeleteProduct(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(currentOrgId) });
    },
  });
}
