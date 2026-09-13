'use client';

import * as React from 'react';
import { Package, Boxes, AlertTriangle, AlertOctagon, DollarSign } from 'lucide-react';
import type { DashboardStatsDto } from '@repo/types';

interface StockStatsCardsProps {
  stats?: DashboardStatsDto | null | undefined;
  isLoading?: boolean | undefined;
  currencySymbol?: string | undefined;
}

export function StockStatsCards({
  stats,
  isLoading = false,
  currencySymbol = '$',
}: StockStatsCardsProps) {
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
  const totalStock = stats?.totalStock ? parseFloat(stats.totalStock) : 0;
  const lowStock = stats?.lowStockCount ?? 0;
  const outOfStock = stats?.outOfStockCount ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Total Products */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Products</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {totalProducts.toLocaleString()}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">All Products</div>
      </div>

      {/* 2. Total Stock */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Stock</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {totalStock.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Boxes className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">All Warehouses</div>
      </div>

      {/* 3. Low Stock Items */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock Items</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {lowStock.toLocaleString()}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-amber-600 font-medium">Requires Attention</div>
      </div>

      {/* 4. Out of Stock */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Out of Stock</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {outOfStock.toLocaleString()}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertOctagon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">Out of Stock Items</div>
      </div>

      {/* 5. Stock Value */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Stock Value</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {formattedInventoryValue}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">Total Inventory Value</div>
      </div>
    </div>
  );
}
