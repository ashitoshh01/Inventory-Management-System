'use client';

import * as React from 'react';
import { Download, ChevronLeft, ChevronRight, Search, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useReconciliationReport } from '../../../hooks/use-reports';
import { WarehouseSelector } from '../../../components/dashboard/warehouse-selector';
import { reportsApi } from '../../../lib/api/reports';

export default function ReconciliationReportPage() {
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>();
  const [discrepancyOnly, setDiscrepancyOnly] = React.useState(false);
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
      discrepancyOnly,
      search: debouncedSearch || undefined,
      page,
      limit: 15,
    }),
    [warehouseId, discrepancyOnly, debouncedSearch, page],
  );

  const { data: reportResponse, isLoading } = useReconciliationReport(queryParams);
  const reportData = reportResponse?.data;
  const items = reportData?.items || [];
  const summary = reportData?.summary;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await reportsApi.downloadCsv('reconciliation', {
        warehouseId,
        discrepancyOnly,
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Stock Reconciliation Report
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Read-Only Audit
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time authoritative verification comparing StockBalance against the immutable ledger entry sum.
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Stock Buckets</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary?.totalBuckets.toLocaleString() ?? '0'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Warehouse-Product pairs audited</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700">Matched Balance</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {summary?.totalMatches.toLocaleString() ?? '0'}
          </p>
          <p className="mt-1 text-xs text-emerald-600/80">100% ledger parity</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-rose-700">Discrepancies</p>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            {summary?.totalDiscrepancies.toLocaleString() ?? '0'}
          </p>
          <p className="mt-1 text-xs text-rose-600/80">Requires physical inventory audit</p>
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
            placeholder="Search product or SKU..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer ml-auto text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={discrepancyOnly}
            onChange={(e) => {
              setDiscrepancyOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          Show Discrepancies Only
        </label>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4 text-right">Current Balance</th>
                <th className="py-3.5 px-4 text-right">Ledger Delta Sum</th>
                <th className="py-3.5 px-4 text-right">Discrepancy</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Ledger Entries</th>
                <th className="py-3.5 px-4 text-right">Last Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-3 px-4 text-center"><div className="h-5 w-16 bg-slate-100 rounded mx-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-8 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No reconciliation records found matching criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.warehouseId}-${item.productId}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div>{item.productName}</div>
                      <div className="text-[11px] text-slate-400 font-normal">SKU: {item.productSku}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{item.warehouseName}</div>
                      <div className="text-[11px] text-slate-400">{item.warehouseCode}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {parseFloat(item.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      {parseFloat(item.ledgerDeltaSum).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-semibold ${item.status === 'MATCH' ? 'text-slate-500' : 'text-rose-600'}`}>
                      {parseFloat(item.discrepancy) > 0 ? `+${item.discrepancy}` : item.discrepancy}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                          item.status === 'MATCH'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {item.status === 'MATCH' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            MATCH
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                            DISCREPANCY
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {item.ledgerEntriesCount}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 text-[11px]">
                      {item.lastMovementAt ? new Date(item.lastMovementAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {reportData && reportData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{items.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{reportData.total}</span> records
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-slate-600">
                Page {page} of {reportData.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= reportData.totalPages}
                onClick={() => setPage((p) => Math.min(reportData.totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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
