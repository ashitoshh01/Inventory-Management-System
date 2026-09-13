'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChevronDown, ShoppingBag } from 'lucide-react';

interface SalesOverviewChartProps {
  className?: string;
}

export function SalesOverviewChart({ className }: SalesOverviewChartProps) {
  const [timeframe, setTimeframe] = React.useState('This Week');

  // In this system, sales orders/invoices are not yet modeled in the backend.
  // We explicitly detect this and show a clean empty state rather than hardcoding fake numbers.
  const salesData: Array<{ day: string; thisWeek: number; lastWeek: number }> = [];

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Sales Overview</h3>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              This Week
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Last Week
            </span>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span>{timeframe}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Chart or Empty State */}
      <div className="relative mt-6 h-64 w-full">
        {salesData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => `$${v / 1000}K`}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="thisWeek"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="lastWeek"
                stroke="#cbd5e1"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#94a3b8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700">No Sales Data Available</h4>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Sales transactions and POS modules are not yet registered. Connect sales channels to see revenue trends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
