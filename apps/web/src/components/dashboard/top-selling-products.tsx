'use client';

import * as React from 'react';
import Link from 'next/link';
import { Package, TrendingUp } from 'lucide-react';
import { useTopSellingProducts } from '../../hooks/use-dashboard';
import type { DashboardQueryParams } from '@repo/types';

interface TopSellingProductsProps {
  queryParams?: DashboardQueryParams;
  className?: string;
  currencySymbol?: string;
}

export function TopSellingProducts({
  queryParams,
  className,
  currencySymbol = '$',
}: TopSellingProductsProps) {
  const { data: productsResponse, isLoading } = useTopSellingProducts(queryParams);
  const products = productsResponse?.data || [];

  if (isLoading) {
    return (
      <div
        className={`flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
          className || ''
        }`}
      >
        <div className="h-6 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Top Selling Products</h3>
        <Link href="/products" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
          View all
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {products.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-700">No Sales Data Available</p>
            <p className="mt-1 max-w-xs text-[11px] text-slate-400">
              Best-selling item velocity will calculate automatically when orders are processed.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-center font-medium">Sold Qty</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                        <Package className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-semibold text-slate-700">{p.soldQty}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">
                    {currencySymbol}
                    {parseFloat(p.revenue).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
