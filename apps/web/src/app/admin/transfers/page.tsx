'use client';

import * as React from 'react';
import { ArrowLeftRight, Search, Building2, Warehouse, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';

export default function AdminTransfersPage() {
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const fetchTransfers = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await adminApi.listTransfers({
        search: search || undefined,
        page,
        pageSize: 25,
      });
      setTransfers(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load transfers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, page]);

  React.useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Cross-Tenant Stock Transfers
          </h2>
          <p className="text-sm text-slate-500">
            Internal inventory movements across partitions ({total} transfers)
          </p>
        </div>
        <button
          onClick={() => fetchTransfers(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by transfer number..."
          className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Transfer Number</th>
                <th className="px-6 py-3.5">Tenant Organization</th>
                <th className="px-6 py-3.5">Source Warehouse</th>
                <th className="px-6 py-3.5">Destination Warehouse</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading transfers...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No transfers found.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                      {t.transferNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        {t.organization?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                        {t.sourceWarehouse?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                        {t.destinationWarehouse?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
