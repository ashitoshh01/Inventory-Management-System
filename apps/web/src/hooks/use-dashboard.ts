'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api/dashboard';
import type { DashboardQueryParams } from '@repo/types';

function getActiveOrgId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeOrganizationId') || 'default-org';
  }
  return 'default-org';
}

export const dashboardKeys = {
  all: (orgId?: string) => ['dashboard', orgId ?? getActiveOrgId()] as const,
  stats: (orgId?: string, params?: DashboardQueryParams) =>
    [...dashboardKeys.all(orgId), 'stats', params] as const,
  inventoryByCategory: (orgId?: string, params?: DashboardQueryParams) =>
    [...dashboardKeys.all(orgId), 'inventory-by-category', params] as const,
  stockStatus: (orgId?: string, params?: DashboardQueryParams) =>
    [...dashboardKeys.all(orgId), 'stock-status', params] as const,
  recentActivities: (orgId?: string) =>
    [...dashboardKeys.all(orgId), 'recent-activities'] as const,
};

export function useDashboardStats(params?: DashboardQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: dashboardKeys.stats(currentOrgId, params),
    queryFn: () => dashboardApi.getStats(params),
  });
}

export function useInventoryByCategory(params?: DashboardQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: dashboardKeys.inventoryByCategory(currentOrgId, params),
    queryFn: () => dashboardApi.getInventoryByCategory(params),
  });
}

export function useStockStatus(params?: DashboardQueryParams, orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: dashboardKeys.stockStatus(currentOrgId, params),
    queryFn: () => dashboardApi.getStockStatus(params),
  });
}

export function useRecentActivities(orgId?: string) {
  const currentOrgId = orgId ?? getActiveOrgId();
  return useQuery({
    queryKey: dashboardKeys.recentActivities(currentOrgId),
    queryFn: () => dashboardApi.getRecentActivities(),
  });
}
