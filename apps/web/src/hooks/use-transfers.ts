'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transfersApi } from '../lib/api/transfers';
import { stockKeys } from './use-stock';
import type {
  StockTransferQueryParams,
  CreateStockTransferInput,
  UpdateStockTransferInput,
} from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const transferKeys = {
  all: (orgId?: string) => ['transfers', orgId ?? getActiveOrgId()] as const,
  metrics: (orgId?: string) => [...transferKeys.all(orgId), 'metrics'] as const,
  lists: (orgId?: string) => [...transferKeys.all(orgId), 'list'] as const,
  list: (orgId?: string, params?: StockTransferQueryParams) =>
    [...transferKeys.lists(orgId), params] as const,
  details: (orgId?: string) => [...transferKeys.all(orgId), 'detail'] as const,
  detail: (orgId?: string, id?: string) => [...transferKeys.details(orgId), id ?? ''] as const,
  auditTrail: (orgId?: string, id?: string) =>
    [...transferKeys.detail(orgId, id), 'auditTrail'] as const,
};

export function useTransfers(
  params?: StockTransferQueryParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: transferKeys.list(currentOrgId, params),
    queryFn: () => transfersApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useTransfer(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: transferKeys.detail(currentOrgId, id),
    queryFn: () => transfersApi.getById(id!),
    enabled: !!id,
  });
}

export function useTransferMetrics(orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: transferKeys.metrics(currentOrgId),
    queryFn: () => transfersApi.getMetrics(),
  });
}

export function useTransferAuditTrail(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: transferKeys.auditTrail(currentOrgId, id),
    queryFn: () => transfersApi.getAuditTrail(id!),
    enabled: !!id,
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateStockTransferInput;
      idempotencyKey?: string;
    }) => transfersApi.create(input, idempotencyKey),
    onSuccess: () => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
    },
  });
}

export function useUpdateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStockTransferInput }) =>
      transfersApi.update(id, input),
    onSuccess: (_data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
    },
  });
}

export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transfersApi.delete(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.removeQueries({ queryKey: transferKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
    },
  });
}

export function useApproveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transfersApi.approve(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.auditTrail(orgId, id) });
    },
  });
}

export function useShipTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey?: string }) =>
      transfersApi.ship(id, idempotencyKey),
    onSuccess: (_data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.auditTrail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: stockKeys.all(orgId) });
    },
  });
}

export function useReceiveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey?: string }) =>
      transfersApi.receive(id, idempotencyKey),
    onSuccess: (_data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.auditTrail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: stockKeys.all(orgId) });
    },
  });
}

export function useCancelTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | undefined }) =>
      transfersApi.cancel(id, reason),
    onSuccess: (_data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.metrics(orgId) });
      queryClient.invalidateQueries({ queryKey: transferKeys.auditTrail(orgId, variables.id) });
    },
  });
}
