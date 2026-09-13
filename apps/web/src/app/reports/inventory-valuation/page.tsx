'use client';

import * as React from 'react';
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useInventoryValuationReport } from '../../../hooks/use-reports';
import { WarehouseSelector } from '../../../components/dashboard/warehouse-selector';
import { reportsApi } from '../../../lib/api/reports';

export default function InventoryValuationReportPage() {
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [isExporting, setIsExporting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = React.useMemo(
    () => ({
      warehouseId,
      search: debouncedSearch || undefined,
      page,
      limit: 15,
    }),
    [warehouseId, debouncedSearch, page],
  );

  const { data: reportResponse, isLoading } = useInventoryValuationReport(queryParams);
  const reportData = reportResponse?.data;
  const items = reportData?.items || [];
  const summary = reportData?.summary;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await reportsApi.downloadCsv('inventory-valuation', {
        warehouseId,
        search: debouncedSearch || undefined,
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
            Inventory Valuation Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Authoritative cost and retail price inventory valuation across active catalog items.
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
          <p className="text-xs font-medium text-slate-500">Total Stock Items</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary?.totalItems.toLocaleString() ?? '0'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Quantity on Hand</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {summary?.totalQuantity ?? '0.0000'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Cost Valuation</p>
          <p className="mt-2 text-2xl font-bold text-purple-600">
            ${summary?.totalCostValue ?? '0.00'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Retail Valuation</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            ${summary?.totalRetailValue ?? '0.00'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} allowAll />

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Product</th>
                <th className="px-5 py-3.5 font-semibold">Category</th>
                <th className="px-5 py-3.5 font-semibold">Warehouse</th>
                <th className="px-5 py-3.5 text-right font-semibold">On Hand</th>
                <th className="px-5 py-3.5 text-right font-semibold">Unit Cost</th>
                <th className="px-5 py-3.5 text-right font-semibold">Unit Price</th>
                <th className="px-5 py-3.5 text-right font-semibold">Total Cost</th>
                <th className="px-5 py-3.5 text-right font-semibold">Total Retail</th>
                <th className="px-5 py-3.5 text-center font-semibold">Status</th>
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
                    No products found matching the active filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const statusBadge =
                    item.stockStatus === 'IN_STOCK'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : item.stockStatus === 'LOW_STOCK'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <tr key={`${item.productId}-${item.warehouseId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{item.productName}</div>
                        <div className="text-[11px] text-slate-400">{item.productSku}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{item.categoryName}</td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{item.warehouseName}</div>
                        <div className="text-[11px] text-slate-400">{item.warehouseCode}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800">
                        {item.quantity} <span className="text-[10px] font-normal text-slate-400">{item.unitOfMeasure}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">${item.unitCost}</td>
                      <td className="px-5 py-3 text-right text-slate-600">${item.unitPrice}</td>
                      <td className="px-5 py-3 text-right font-semibold text-purple-700">${item.totalCostValue}</td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-700">${item.totalRetailValue}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge}`}>
                          {item.stockStatus.replace('_', ' ')}
                        </span>
                      </td>
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
