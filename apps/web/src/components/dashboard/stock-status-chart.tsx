'use client';

import * as React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { StockStatusOverviewDto } from '@repo/types';
import { Boxes } from 'lucide-react';

interface StockStatusChartProps {
  data?: StockStatusOverviewDto | null | undefined;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

export function StockStatusChart({
  data,
  isLoading = false,
  className,
}: StockStatusChartProps) {
  if (isLoading) {
    return (
      <div
        className={`h-80 animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
          className || ''
        }`}
      />
    );
  }

  const inStock = data?.inStock ?? 0;
  const lowStock = data?.lowStock ?? 0;
  const outOfStock = data?.outOfStock ?? 0;
  const total = inStock + lowStock + outOfStock;

  const items = [
    {
      name: 'In Stock',
      value: inStock,
      percentage: total > 0 ? (inStock / total) * 100 : 0,
      color: '#10b981', // Green
    },
    {
      name: 'Low Stock',
      value: lowStock,
      percentage: total > 0 ? (lowStock / total) * 100 : 0,
      color: '#f59e0b', // Amber/Orange
    },
    {
      name: 'Out of Stock',
      value: outOfStock,
      percentage: total > 0 ? (outOfStock / total) * 100 : 0,
      color: '#ef4444', // Red
    },
  ];

  const hasData = total > 0;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">
          Stock Status Overview
        </h3>
      </div>

      {!hasData ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <Boxes className="h-10 w-10 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700">No Stock Status Data</p>
          <p className="mt-1 max-w-xs text-[11px] text-slate-400">
            Stock balances across warehouses will be monitored and classified here.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Donut Chart with Center Text */}
          <div className="relative h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {items.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total Count */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold text-slate-800">
                {total.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-400">Total Products</span>
            </div>
          </div>

          {/* Right Legend */}
          <div className="flex flex-1 flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs transition-colors hover:bg-slate-50 p-1.5 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
