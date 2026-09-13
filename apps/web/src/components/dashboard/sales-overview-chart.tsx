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
import { ShoppingBag } from 'lucide-react';
import { useSalesOverview } from '../../hooks/use-dashboard';
import type { DashboardQueryParams } from '@repo/types';

interface SalesOverviewChartProps {
  queryParams?: DashboardQueryParams;
  className?: string;
  currencySymbol?: string;
}

export function SalesOverviewChart({
  queryParams,
  className,
  currencySymbol = '$',
}: SalesOverviewChartProps) {
  const { data: salesOverviewResponse, isLoading } = useSalesOverview(queryParams);

  const salesData = (salesOverviewResponse?.data || []).map((p) => ({
    day: p.day,
    thisWeek: p.thisPeriod,
    lastWeek: p.lastPeriod,
  }));

  const hasData = salesData.some((p) => p.thisWeek > 0 || p.lastWeek > 0);

  if (isLoading) {
    return (
      <div
        className={`flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
          className || ''
        }`}
      >
        <div className="h-6 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-xl bg-slate-50" />
      </div>
    );
  }

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
              This Period
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Prior Period
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
          Weekly Trend
        </div>
      </div>

      {/* Chart or Empty State */}
      <div className="relative mt-6 h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => `${currencySymbol}${v}`}
              />
              <Tooltip
                formatter={(val: unknown) => [`${currencySymbol}${val}`, 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey="thisWeek"
                name="This Period"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="lastWeek"
                name="Prior Period"
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
            <h4 className="text-sm font-semibold text-slate-700">No Sales Data In This Period</h4>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Orders created and fulfilled in this time frame will display trend lines here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
