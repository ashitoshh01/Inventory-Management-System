'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockApi } from '../lib/api/stock';
import type {
  StockBalanceQueryParams,
  CreateStockMutationInput,
  PaginationParams,
  StockLedgerQueryParams,
} from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const stockKeys = {
  all: (orgId?: string) => ['stock', orgId ?? getActiveOrgId()] as const,
  balances: (orgId?: string) => [...stockKeys.all(orgId), 'balances'] as const,
  list: (orgId?: string, params?: StockBalanceQueryParams) =>
    [...stockKeys.balances(orgId), 'list', params] as const,
  detail: (orgId?: string, id?: string) =>
    [...stockKeys.balances(orgId), 'detail', id ?? ''] as const,
  byProduct: (orgId?: string, productId?: string, params?: PaginationParams) =>
    [...stockKeys.balances(orgId), 'byProduct', productId ?? '', params] as const,
  byWarehouse: (orgId?: string, warehouseId?: string, params?: PaginationParams) =>
    [...stockKeys.balances(orgId), 'byWarehouse', warehouseId ?? '', params] as const,
  ledger: (orgId?: string) => [...stockKeys.all(orgId), 'ledger'] as const,
  ledgerList: (orgId?: string, params?: StockLedgerQueryParams) =>
    [...stockKeys.ledger(orgId), 'list', params] as const,
  ledgerDetail: (orgId?: string, id?: string) =>
    [...stockKeys.ledger(orgId), 'detail', id ?? ''] as const,
};

export function useStockBalances(
  params?: StockBalanceQueryParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.list(currentOrgId, params),
    queryFn: () => stockApi.listBalances(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useStockBalance(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.detail(currentOrgId, id),
    queryFn: () => stockApi.getBalanceById(id!),
    enabled: !!id,
  });
}

export function useProductStock(
  productId: string | undefined,
  params?: PaginationParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.byProduct(currentOrgId, productId, params),
    queryFn: () => stockApi.getBalancesByProduct(productId!, params),
    enabled: !!productId,
    placeholderData: (previousData) => previousData,
  });
}

export function useWarehouseStock(
  warehouseId: string | undefined,
  params?: PaginationParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.byWarehouse(currentOrgId, warehouseId, params),
    queryFn: () => stockApi.getBalancesByWarehouse(warehouseId!, params),
    enabled: !!warehouseId,
    placeholderData: (previousData) => previousData,
  });
}

export function useStockLedger(
  params?: StockLedgerQueryParams | undefined,
  orgId?: string | undefined,
) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.ledgerList(currentOrgId, params),
    queryFn: () => stockApi.listLedger(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useStockLedgerEntry(id: string | undefined, orgId?: string | undefined) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: stockKeys.ledgerDetail(currentOrgId, id),
    queryFn: () => stockApi.getLedgerById(id!),
    enabled: !!id,
  });
}

export function useStockMutation(orgId?: string | undefined) {
  const queryClient = useQueryClient();
  const currentOrgId = orgId ?? getActiveOrgId();

  return useMutation({
    mutationFn: (input: CreateStockMutationInput) => stockApi.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockKeys.all(currentOrgId) });
    },
  });
}
