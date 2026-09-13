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

function getDateBounds(range: string): { startDate?: string; endDate?: string } {
  const now = new Date();
  const endDate = now.toISOString();

  if (range === 'Today') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return { startDate: today.toISOString(), endDate };
  }
  if (range === 'Last 7 Days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { startDate: d.toISOString(), endDate };
  }
  if (range === 'Last 30 Days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { startDate: d.toISOString(), endDate };
  }
  if (range === 'This Month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: d.toISOString(), endDate };
  }
  if (range === 'Last Month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  return {};
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string | undefined>();
  const [selectedDateRange, setSelectedDateRange] = React.useState('Last 7 Days');

  const dateBounds = React.useMemo(() => getDateBounds(selectedDateRange), [selectedDateRange]);

  const queryParams = React.useMemo(
    () => ({
      warehouseId: selectedWarehouseId,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      timeframe: selectedDateRange,
    }),
    [selectedWarehouseId, dateBounds, selectedDateRange],
  );

  const { data: statsResponse, isLoading: statsLoading } = useDashboardStats(queryParams);
  const { data: categoryResponse, isLoading: categoryLoading } =
    useInventoryByCategory(queryParams);
  const { data: stockStatusResponse, isLoading: stockStatusLoading } = useStockStatus(queryParams);
  const { data: recentActivitiesResponse, isLoading: activitiesLoading } = useRecentActivities();

  const userName = user?.email
    ? user.email
        .split('@')[0]!
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'User';

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
          <DateRangeSelector
            value={selectedDateRange}
            onChange={setSelectedDateRange}
          />
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
          <SalesOverviewChart queryParams={queryParams} className="h-full" />
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
          <TopSellingProducts queryParams={queryParams} className="h-full" />
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
