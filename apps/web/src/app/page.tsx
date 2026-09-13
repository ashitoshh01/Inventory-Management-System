'use client';

import * as React from 'react';
import { useAuth } from '../components/providers/AuthProvider';
import {
  useDashboardStats,
  useInventoryByCategory,
  useStockStatus,
  useRecentActivities,
} from '../hooks/use-dashboard';
import { DashboardStatsCards } from '../components/dashboard/dashboard-stats-cards';
import { SalesOverviewChart } from '../components/dashboard/sales-overview-chart';
import { CategoryValueChart } from '../components/dashboard/category-value-chart';
import { RecentActivities } from '../components/dashboard/recent-activities';
import { TopSellingProducts } from '../components/dashboard/top-selling-products';
import { StockStatusChart } from '../components/dashboard/stock-status-chart';
import { UpcomingExpiryTable } from '../components/dashboard/upcoming-expiry-table';
import { WarehouseSelector } from '../components/dashboard/warehouse-selector';
import { DateRangeSelector } from '../components/dashboard/date-range-selector';

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string | undefined>();

  const queryParams = React.useMemo(
    () => ({
      warehouseId: selectedWarehouseId,
    }),
    [selectedWarehouseId],
  );

  const { data: statsResponse, isLoading: statsLoading } = useDashboardStats(queryParams);
  const { data: categoryResponse, isLoading: categoryLoading } = useInventoryByCategory(queryParams);
  const { data: stockStatusResponse, isLoading: stockStatusLoading } = useStockStatus(queryParams);
  const { data: recentActivitiesResponse, isLoading: activitiesLoading } = useRecentActivities();

  const userName = user?.email
    ? user.email.split('@')[0]!.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'John';

  return (
    <div className="space-y-6">
      {/* Top Header Row: Title + Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {userName}! Here&apos;s what&apos;s happening with your inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <WarehouseSelector
            value={selectedWarehouseId}
            onChange={setSelectedWarehouseId}
            allowAll
          />
          <DateRangeSelector />
        </div>
      </div>

      {/* 5 Summary Metric Cards */}
      <DashboardStatsCards
        stats={statsResponse?.data}
        isLoading={statsLoading}
        currencySymbol="$"
      />

      {/* Middle Row: Sales Overview (Line), Category Donut, Recent Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SalesOverviewChart className="h-full" />
        </div>
        <div className="lg:col-span-4">
          <CategoryValueChart
            data={categoryResponse?.data}
            isLoading={categoryLoading}
            currencySymbol="$"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-3">
          <RecentActivities
            activities={recentActivitiesResponse?.data}
            isLoading={activitiesLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* Bottom Row: Top Selling Products, Stock Status Donut, Upcoming Expiry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <TopSellingProducts className="h-full" />
        </div>
        <div className="lg:col-span-4">
          <StockStatusChart
            data={stockStatusResponse?.data}
            isLoading={stockStatusLoading}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <UpcomingExpiryTable className="h-full" />
        </div>
      </div>
    </div>
  );
}
