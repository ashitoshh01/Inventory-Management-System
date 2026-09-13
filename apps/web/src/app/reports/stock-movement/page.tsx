'use client';

import * as React from 'react';
import { Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useStockMovementReport } from '../../../hooks/use-reports';
import { WarehouseSelector } from '../../../components/dashboard/warehouse-selector';
import { DateRangeSelector } from '../../../components/dashboard/date-range-selector';
import { reportsApi } from '../../../lib/api/reports';

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  OPENING: { bg: 'bg-purple-50', text: 'text-purple-700 border-purple-200' },
  RECEIPT: { bg: 'bg-emerald-50', text: 'text-emerald-700 border-emerald-200' },
  ISSUE: { bg: 'bg-rose-50', text: 'text-rose-700 border-rose-200' },
  ADJUSTMENT: { bg: 'bg-amber-50', text: 'text-amber-700 border-amber-200' },
};

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

export default function StockMovementReportPage() {
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>();
  const [selectedType, setSelectedType] = React.useState<string | undefined>();
  const [dateRange, setDateRange] = React.useState('Last 30 Days');
  const [page, setPage] = React.useState(1);
  const [isExporting, setIsExporting] = React.useState(false);

  const dateBounds = React.useMemo(() => getDateBounds(dateRange), [dateRange]);

  const queryParams = React.useMemo(
    () => ({
      warehouseId,
      type: selectedType,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      page,
      limit: 15,
    }),
    [warehouseId, selectedType, dateBounds, page],
  );

  const { data: reportResponse, isLoading } = useStockMovementReport(queryParams);
  const reportData = reportResponse?.data;
  const items = reportData?.items || [];
  const summary = reportData?.summary;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await reportsApi.downloadCsv('stock-movement', {
        warehouseId,
        type: selectedType,
        startDate: dateBounds.startDate,
        endDate: dateBounds.endDate,
      });
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Stock Movements Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Immutable ledger movement history across all warehouses and products.
          </p>
        </div>

        <button
          type="button"
          disabled={isExporting}
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span>{isExporting ? 'Exporting CSV...' : 'Export to CSV'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Movements</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary?.totalMovements.toLocaleString() ?? '0'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Inflow</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            +{summary?.totalIn ?? '0.0000'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Outflow</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            -{summary?.totalOut ?? '0.0000'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Net Quantity Change</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary?.netChange ?? '0.0000'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} allowAll />
        <DateRangeSelector value={dateRange} onChange={setDateRange} />

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedType || ''}
            onChange={(e) => {
              setSelectedType(e.target.value || undefined);
              setPage(1);
            }}
            aria-label="Filter by mutation type"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Mutation Types</option>
            <option value="OPENING">OPENING</option>
            <option value="RECEIPT">RECEIPT</option>
            <option value="ISSUE">ISSUE</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Date & Time</th>
                <th className="px-5 py-3.5 font-semibold">Product</th>
                <th className="px-5 py-3.5 font-semibold">Warehouse</th>
                <th className="px-5 py-3.5 font-semibold">Type</th>
                <th className="px-5 py-3.5 text-right font-semibold">Delta</th>
                <th className="px-5 py-3.5 text-right font-semibold">Before</th>
                <th className="px-5 py-3.5 text-right font-semibold">After</th>
                <th className="px-5 py-3.5 font-semibold">Reference</th>
                <th className="px-5 py-3.5 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="h-4 rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    No stock movements found matching the active filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const deltaNum = parseFloat(item.quantityDelta);
                  const badge = TYPE_BADGES[item.type] || { bg: 'bg-slate-100', text: 'text-slate-700' };

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{item.productName}</div>
                        <div className="text-[11px] text-slate-400">{item.productSku}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{item.warehouseName}</div>
                        <div className="text-[11px] text-slate-400">{item.warehouseCode}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                          {item.type}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-bold ${
                          deltaNum > 0 ? 'text-emerald-600' : deltaNum < 0 ? 'text-rose-600' : 'text-slate-600'
                        }`}
                      >
                        {deltaNum > 0 ? `+${item.quantityDelta}` : item.quantityDelta}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">{item.quantityBefore}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">{item.quantityAfter}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {item.referenceType ? `${item.referenceType} ${item.referenceId || ''}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{item.actorEmail || 'System'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {reportData && reportData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
            <span>
              Showing Page {reportData.page} of {reportData.totalPages} ({reportData.total} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= reportData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
