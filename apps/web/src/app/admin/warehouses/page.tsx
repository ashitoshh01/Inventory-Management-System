'use client';

import * as React from 'react';
import { Warehouse, Search, Building2, Boxes, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);

  const fetchWarehouses = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await adminApi.listWarehouses({
        search: search || undefined,
        pageSize: 50,
      });
      setWarehouses(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load warehouses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  React.useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cross-Tenant Warehouses</h2>
          <p className="text-sm text-slate-500">
            Storage locations across all organizations ({total} warehouses)
          </p>
        </div>
        <button
          onClick={() => fetchWarehouses(true)}
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter warehouses across all tenants..."
          className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Warehouse Name</th>
                <th className="px-6 py-3.5">Code</th>
                <th className="px-6 py-3.5">Tenant Organization</th>
                <th className="px-6 py-3.5">Stock Positions</th>
                <th className="px-6 py-3.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading cross-tenant warehouses...
                  </td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No warehouses found.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/50">
                          <Warehouse className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900">{w.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600">{w.code || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        {w.organization?.name || w.organizationId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        <Boxes className="h-3 w-3 text-slate-400" />
                        {w._count?.stockBalances || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(w.createdAt).toLocaleDateString()}
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
