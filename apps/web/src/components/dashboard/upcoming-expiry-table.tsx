'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Package } from 'lucide-react';

interface UpcomingExpiryTableProps {
  className?: string;
}

export function UpcomingExpiryTable({ className }: UpcomingExpiryTableProps) {
  // Batch/Expiry tracking is not modeled in current schema.
  // Render clean empty state per NO HARDCODED DATA guidelines.
  const expiryItems: Array<{
    id: string;
    productName: string;
    batchNo: string;
    expiryDate: string;
    daysLeft: number;
  }> = [];

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Upcoming Expiry</h3>
        <Link
          href="/stock"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {expiryItems.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
              <Calendar className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-700">No Expiry Tracking Active</p>
            <p className="mt-1 max-w-xs text-[11px] text-slate-400">
              Batch and lot expiration dates will be monitored here when batch tracking is enabled.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Batch No.</th>
                <th className="pb-2 font-medium">Expiry Date</th>
                <th className="pb-2 text-right font-medium">Days Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expiryItems.map((item) => {
                const badgeColor =
                  item.daysLeft <= 7
                    ? 'text-rose-600 font-bold'
                    : item.daysLeft <= 15
                    ? 'text-amber-600 font-semibold'
                    : 'text-emerald-600 font-medium';

                return (
                  <tr key={item.id}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                          <Package className="h-4 w-4 text-slate-400" />
                        </div>
                        <span className="font-semibold text-slate-800">
                          {item.productName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-500">{item.batchNo}</td>
                    <td className="py-2.5 text-slate-600">{item.expiryDate}</td>
                    <td className={`py-2.5 text-right ${badgeColor}`}>
                      {item.daysLeft}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
