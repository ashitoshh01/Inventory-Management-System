'use client';

import * as React from 'react';
import { Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useSalesReport } from '../../../hooks/use-reports';
import { WarehouseSelector } from '../../../components/dashboard/warehouse-selector';
import { DateRangeSelector } from '../../../components/dashboard/date-range-selector';
import { reportsApi } from '../../../lib/api/reports';

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-slate-50', text: 'text-slate-700 border-slate-200' },
  CONFIRMED: { bg: 'bg-blue-50', text: 'text-blue-700 border-blue-200' },
  ALLOCATED: { bg: 'bg-indigo-50', text: 'text-indigo-700 border-indigo-200' },
  PICKED: { bg: 'bg-purple-50', text: 'text-purple-700 border-purple-200' },
  PACKED: { bg: 'bg-amber-50', text: 'text-amber-700 border-amber-200' },
  SHIPPED: { bg: 'bg-cyan-50', text: 'text-cyan-700 border-cyan-200' },
  DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700 border-emerald-200' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700 border-rose-200' },
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

export default function SalesReportPage() {
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = React.useState<string | undefined>();
  const [dateRange, setDateRange] = React.useState('Last 30 Days');
  const [page, setPage] = React.useState(1);
  const [isExporting, setIsExporting] = React.useState(false);

  const dateBounds = React.useMemo(() => getDateBounds(dateRange), [dateRange]);

  const queryParams = React.useMemo(
    () => ({
      warehouseId,
      status: selectedStatus,
      startDate: dateBounds.startDate,
      endDate: dateBounds.endDate,
      page,
      limit: 15,
    }),
    [warehouseId, selectedStatus, dateBounds, page],
  );

  const { data: reportResponse, isLoading } = useSalesReport(queryParams);
  const reportData = reportResponse?.data;
  const items = reportData?.items || [];
  const summary = reportData?.summary;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await reportsApi.downloadCsv('sales', {
        warehouseId,
        status: selectedStatus,
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
            Sales & Outbound Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Authoritative sales order fulfillment, customer demand, and outbound revenue metrics.
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
          <p className="text-xs font-medium text-slate-500">Total Sales Orders</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary?.totalOrders.toLocaleString() ?? '0'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Outbound Revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            ${summary?.totalRevenue ?? '0.00'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Fulfilled Orders</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {summary?.fulfilledOrders.toLocaleString() ?? '0'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pending Orders</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {summary?.pendingOrders.toLocaleString() ?? '0'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <WarehouseSelector value={warehouseId} onChange={setWarehouseId} allowAll />

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedStatus || ''}
            onChange={(e) => {
              setSelectedStatus(e.target.value || undefined);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="PICKED">Picked</option>
            <option value="PACKED">Packed</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="ml-auto">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="py-3.5 px-4">Order Number</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Order Date</th>
                <th className="py-3.5 px-4 text-right">Lines</th>
                <th className="py-3.5 px-4 text-right">Order Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4 text-center"><div className="h-5 w-16 bg-slate-100 rounded mx-auto" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-8 bg-slate-100 rounded ml-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No sales orders found matching the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const badge = STATUS_BADGES[item.status] || {
                    bg: 'bg-slate-50',
                    text: 'text-slate-700 border-slate-200',
                  };
                  return (
                    <tr key={item.salesOrderId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.salesOrderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {item.customerName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.warehouseName}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${badge.bg} ${badge.text}`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(item.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {item.linesCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        ${parseFloat(item.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
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
