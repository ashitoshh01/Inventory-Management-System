'use client';

import * as React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { InventoryByCategoryDto } from '@repo/types';
import { Layers } from 'lucide-react';

interface CategoryValueChartProps {
  data?: InventoryByCategoryDto[] | undefined;
  isLoading?: boolean | undefined;
  currencySymbol?: string | undefined;
  className?: string | undefined;
}

const COLORS = [
  '#2563eb', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#64748b', // Slate
  '#ec4899', // Pink
  '#8b5cf6', // Violet
];

export function CategoryValueChart({
  data = [],
  isLoading = false,
  currencySymbol = '$',
  className,
}: CategoryValueChartProps) {
  if (isLoading) {
    return (
      <div
        className={`h-80 animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
          className || ''
        }`}
      />
    );
  }

  const totalValue = data.reduce((acc, curr) => acc + (parseFloat(curr.totalValue) || 0), 0);

  const formattedTotal =
    totalValue >= 1_000_000
      ? `${currencySymbol}${(totalValue / 1_000_000).toFixed(2)}M`
      : totalValue >= 1_000
        ? `${currencySymbol}${(totalValue / 1_000).toFixed(1)}K`
        : `${currencySymbol}${totalValue.toFixed(0)}`;

  const chartData = data.map((cat, idx) => ({
    name: cat.categoryName,
    value: parseFloat(cat.totalValue) || 0,
    percentage: cat.percentage,
    color: COLORS[idx % COLORS.length],
  }));

  const hasData = chartData.length > 0 && totalValue > 0;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Inventory Value by Category</h3>
      </div>

      {!hasData ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-700">No Inventory Value Data</h4>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            Add products with unit prices and stock levels to calculate category valuation.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Donut Chart with Center Text */}
          <div className="relative h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#2563eb'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: unknown) => [
                    `${currencySymbol}${Number(val || 0).toLocaleString()}`,
                    'Value',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold text-slate-800">{formattedTotal}</span>
              <span className="text-[11px] font-medium text-slate-400">Total</span>
            </div>
          </div>

          {/* Right Legend */}
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-56 pr-2">
            {chartData.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between text-xs transition-colors hover:bg-slate-50 p-1 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate font-medium text-slate-700 max-w-[120px]">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="font-semibold text-slate-800">
                    {currencySymbol}
                    {cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[11px] text-slate-400">({cat.percentage.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
