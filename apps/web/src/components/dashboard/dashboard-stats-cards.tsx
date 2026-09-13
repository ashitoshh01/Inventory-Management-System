'use client';

import * as React from 'react';
import { Package, AlertTriangle, AlertOctagon, ShoppingCart, TrendingUp, Tag } from 'lucide-react';
import type { DashboardStatsDto } from '@repo/types';

interface DashboardStatsCardsProps {
  stats?: DashboardStatsDto | null | undefined;
  isLoading?: boolean | undefined;
  currencySymbol?: string | undefined;
}

export function DashboardStatsCards({
  stats,
  isLoading = false,
  currencySymbol = '$',
}: DashboardStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
          />
        ))}
      </div>
    );
  }

  const inventoryValue = stats?.totalInventoryValue ? parseFloat(stats.totalInventoryValue) : 0;

  const formattedInventoryValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
    .format(inventoryValue)
    .replace('$', currencySymbol);

  const totalProducts = stats?.totalProducts ?? 0;
  const lowStock = stats?.lowStockCount ?? 0;
  const outOfStock = stats?.outOfStockCount ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Total Inventory Value */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Inventory Value</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {formattedInventoryValue}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Tag className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-400">
          <span>vs last 7 days</span>
        </div>
      </div>

      {/* 2. Total Products */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Products</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {totalProducts.toLocaleString()}
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" /> 8.3%
              </span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-400">
          <span>vs last 7 days</span>
        </div>
      </div>

      {/* 3. Low Stock Items */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock Items</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {lowStock.toLocaleString()}
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600">
                <TrendingUp className="h-3 w-3" /> 5.6%
              </span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-400">
          <span>vs last 7 days</span>
        </div>
      </div>

      {/* 4. Out of Stock Items */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Out of Stock Items</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {outOfStock.toLocaleString()}
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600">
                <TrendingUp className="h-3 w-3" /> 3.1%
              </span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertOctagon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-400">
          <span>vs last 7 days</span>
        </div>
      </div>

      {/* 5. Today's Sales */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Today&apos;s Sales</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {currencySymbol}0.00
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" /> 0.0%
              </span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-400">
          <span>vs last 7 days</span>
        </div>
      </div>
    </div>
  );
}
