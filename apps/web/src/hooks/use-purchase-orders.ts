'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '../lib/api/purchase-orders';
import { stockKeys } from './use-stock';
import type {
  PurchaseOrderQueryParams,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
} from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const purchaseOrderKeys = {
  all: (orgId?: string) => ['purchase-orders', orgId ?? getActiveOrgId()] as const,
  metrics: (orgId?: string) => [...purchaseOrderKeys.all(orgId), 'metrics'] as const,
  lists: (orgId?: string) => [...purchaseOrderKeys.all(orgId), 'list'] as const,
  list: (orgId?: string, params?: PurchaseOrderQueryParams) =>
    [...purchaseOrderKeys.lists(orgId), params] as const,
  details: (orgId?: string) => [...purchaseOrderKeys.all(orgId), 'detail'] as const,
  detail: (orgId?: string, id?: string) => [...purchaseOrderKeys.details(orgId), id ?? ''] as const,
  receipts: (orgId?: string, id?: string) =>
    [...purchaseOrderKeys.detail(orgId, id), 'receipts'] as const,
  reconciliation: (orgId?: string, id?: string) =>
    [...purchaseOrderKeys.detail(orgId, id), 'reconciliation'] as const,
  auditTrail: (orgId?: string, id?: string) =>
    [...purchaseOrderKeys.detail(orgId, id), 'auditTrail'] as const,
};

export function usePurchaseOrders(
  params?: PurchaseOrderQueryParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.list(currentOrgId, params),
    queryFn: () => purchaseOrdersApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function usePurchaseOrder(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.detail(currentOrgId, id),
    queryFn: () => purchaseOrdersApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreatePurchaseOrderInput;
      idempotencyKey?: string;
    }) => purchaseOrdersApi.create(input, idempotencyKey),
    onSuccess: () => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePurchaseOrderInput }) =>
      purchaseOrdersApi.update(id, input),
    onSuccess: (data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.delete(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.removeQueries({ queryKey: purchaseOrderKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function useSubmitPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.submit(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.approve(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.cancel(id),
    onSuccess: (_data, id) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(orgId, id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
    },
  });
}

export function usePurchaseOrderReceipts(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.receipts(currentOrgId, id),
    queryFn: () => purchaseOrdersApi.getReceipts(id!),
    enabled: !!id,
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: ReceivePurchaseOrderInput;
      idempotencyKey?: string;
    }) => purchaseOrdersApi.receive(id, input, idempotencyKey),
    onSuccess: (_data, variables) => {
      const orgId = getActiveOrgId();
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(orgId, variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.receipts(orgId, variables.id) });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.reconciliation(orgId, variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.auditTrail(orgId, variables.id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.metrics(orgId) });
      queryClient.invalidateQueries({ queryKey: stockKeys.all(orgId) });
    },
  });
}

export function useProcurementMetrics(orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.metrics(currentOrgId),
    queryFn: () => purchaseOrdersApi.getMetrics(),
  });
}

export function usePurchaseOrderReconciliation(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.reconciliation(currentOrgId, id),
    queryFn: () => purchaseOrdersApi.getReconciliation(id!),
    enabled: !!id,
  });
}

export function usePurchaseOrderAuditTrail(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: purchaseOrderKeys.auditTrail(currentOrgId, id),
    queryFn: () => purchaseOrdersApi.getAuditTrail(id!),
    enabled: !!id,
  });
}
