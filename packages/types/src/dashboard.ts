/**
 * Dashboard-specific DTO contracts.
 * Used by the dashboard aggregation endpoints.
 */

export interface DashboardStatsDto {
  totalProducts: number;
  totalStock: string; // Exact decimal representation
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: string; // Exact decimal representation
}

export interface InventoryByCategoryDto {
  categoryId: string;
  categoryName: string;
  totalValue: string; // Exact decimal representation
  percentage: number; // 0-100
  productCount: number;
}

export interface StockStatusOverviewDto {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalProducts: number;
}

export interface RecentActivityDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  timestamp: string;
  actorEmail: string | null;
}

export interface DashboardQueryParams {
  warehouseId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}
