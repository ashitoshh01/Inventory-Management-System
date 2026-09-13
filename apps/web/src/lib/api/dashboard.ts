import { apiClient } from './client';
import type {
  DashboardStatsDto,
  InventoryByCategoryDto,
  StockStatusOverviewDto,
  RecentActivityDto,
  DashboardQueryParams,
} from '@repo/types';

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

export const dashboardApi = {
  getStats: (params?: DashboardQueryParams) =>
    apiClient<DashboardStatsDto>(
      `/dashboard/stats${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getInventoryByCategory: (params?: DashboardQueryParams) =>
    apiClient<InventoryByCategoryDto[]>(
      `/dashboard/inventory-by-category${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getStockStatus: (params?: DashboardQueryParams) =>
    apiClient<StockStatusOverviewDto>(
      `/dashboard/stock-status${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getRecentActivities: () =>
    apiClient<RecentActivityDto[]>('/dashboard/recent-activities'),
};
