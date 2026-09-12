'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehousesApi } from '../lib/api/warehouses';
import type { WarehouseQueryParams, CreateWarehouseInput, UpdateWarehouseInput } from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const warehouseKeys = {
  all: (orgId?: string) => ['warehouses', orgId ?? getActiveOrgId()] as const,
  lists: (orgId?: string) => [...warehouseKeys.all(orgId), 'list'] as const,
  list: (orgId?: string, params?: WarehouseQueryParams) =>
    [...warehouseKeys.lists(orgId), params] as const,
  details: (orgId?: string) => [...warehouseKeys.all(orgId), 'detail'] as const,
  detail: (orgId?: string, id?: string) => [...warehouseKeys.details(orgId), id ?? ''] as const,
};

export function useWarehouses(params?: WarehouseQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: warehouseKeys.list(currentOrgId, params),
    queryFn: () => warehousesApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useWarehouse(id: string | undefined, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: warehouseKeys.detail(currentOrgId, id),
    queryFn: () => warehousesApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateWarehouse(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (input: CreateWarehouseInput) => warehousesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists(currentOrgId) });
    },
  });
}

export function useUpdateWarehouse(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWarehouseInput }) =>
      warehousesApi.update(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists(currentOrgId) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(currentOrgId, variables.id) });
    },
  });
}

export function useDeleteWarehouse(orgId?: string) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (id: string) => warehousesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists(currentOrgId) });
    },
  });
}
