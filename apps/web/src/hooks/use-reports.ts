'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api/reports';
import type { ReportQueryParams } from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const reportsKeys = {
  all: (orgId?: string) => ['reports', orgId ?? getActiveOrgId()] as const,
  stockMovement: (orgId?: string, params?: ReportQueryParams) =>
    [...reportsKeys.all(orgId), 'stock-movement', params] as const,
  inventoryValuation: (orgId?: string, params?: ReportQueryParams) =>
    [...reportsKeys.all(orgId), 'inventory-valuation', params] as const,
  reconciliation: (orgId?: string, params?: ReportQueryParams) =>
    [...reportsKeys.all(orgId), 'reconciliation', params] as const,
  procurement: (orgId?: string, params?: ReportQueryParams) =>
    [...reportsKeys.all(orgId), 'procurement', params] as const,
  sales: (orgId?: string, params?: ReportQueryParams) =>
    [...reportsKeys.all(orgId), 'sales', params] as const,
};

export function useStockMovementReport(params?: ReportQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: reportsKeys.stockMovement(currentOrgId, params),
    queryFn: () => reportsApi.getStockMovement(params),
  });
}

export function useInventoryValuationReport(params?: ReportQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: reportsKeys.inventoryValuation(currentOrgId, params),
    queryFn: () => reportsApi.getInventoryValuation(params),
  });
}

export function useReconciliationReport(params?: ReportQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: reportsKeys.reconciliation(currentOrgId, params),
    queryFn: () => reportsApi.getReconciliation(params),
  });
}

export function useProcurementReport(params?: ReportQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: reportsKeys.procurement(currentOrgId, params),
    queryFn: () => reportsApi.getProcurement(params),
  });
}

export function useSalesReport(params?: ReportQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: reportsKeys.sales(currentOrgId, params),
    queryFn: () => reportsApi.getSales(params),
  });
}
