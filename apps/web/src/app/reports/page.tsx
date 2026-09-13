'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
  Download,
} from 'lucide-react';
import { reportsApi } from '../../lib/api/reports';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  reportType: 'stock-movement' | 'inventory-valuation' | 'reconciliation' | 'procurement' | 'sales';
}

const REPORT_CARDS: ReportCard[] = [
  {
    id: 'stock-movement',
    title: 'Stock Movements Report',
    description:
      'Authoritative ledger movement trail tracking every receipt, issue, adjustment, and opening balance with actor and delta math.',
    href: '/reports/stock-movement',
    icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    reportType: 'stock-movement',
  },
  {
    id: 'inventory-valuation',
    title: 'Inventory Valuation Report',
    description:
      'Real-time cost and retail price inventory valuation grouped by warehouse facility, category, and active product catalog.',
    href: '/reports/inventory-valuation',
    icon: DollarSign,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    reportType: 'inventory-valuation',
  },
  {
    id: 'reconciliation',
    title: 'Inventory Reconciliation Report',
    description:
      'Read-only integrity verification engine comparing live StockBalance rows against cumulative sum of immutable StockLedgerEntry deltas.',
    href: '/reports/reconciliation',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    reportType: 'reconciliation',
  },
  {
    id: 'procurement',
    title: 'Procurement & Purchasing Report',
    description:
      'Operational status and financial volume of purchase orders, receiving progress, and vendor order fulfillment.',
    href: '/reports/procurement',
    icon: ShoppingCart,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    reportType: 'procurement',
  },
  {
    id: 'sales',
    title: 'Sales & Outbound Report',
    description:
      'Customer order volume, fulfillment performance, and revenue totals derived from confirmed and fulfilled sales orders.',
    href: '/reports/sales',
    icon: TrendingUp,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    reportType: 'sales',
  },
];

export default function ReportsHubPage() {
  const [downloading, setDownloading] = React.useState<string | null>(null);

  const handleQuickExport = async (reportType: 'stock-movement' | 'inventory-valuation' | 'reconciliation' | 'procurement' | 'sales') => {
    try {
      setDownloading(reportType);
      await reportsApi.downloadCsv(reportType);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Reports & Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Authoritative business reports, audit trails, inventory valuation, and read-only reconciliation.
        </p>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon;
          const isExporting = downloading === card.reportType;

          return (
            <div
              key={card.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleQuickExport(card.reportType)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    <span>{isExporting ? 'Exporting...' : 'CSV'}</span>
                  </button>
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{card.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                <Link
                  href={card.href}
                  className="flex items-center justify-between text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <span>View Full Report</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
