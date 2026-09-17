'use client';

import * as React from 'react';
import { Boxes, Search, Building2, Warehouse, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';

export default function AdminInventoryPage() {
  const [stock, setStock] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const fetchStock = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await adminApi.listStock({
        search: search || undefined,
        page,
        pageSize: 25,
      });
      setStock(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load inventory balances', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, page]);

  React.useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cross-Tenant Stock Overview</h2>
          <p className="text-sm text-slate-500">
            Real-time stock balance records across all partitions ({total} positions)
          </p>
        </div>
        <button
          onClick={() => fetchStock(true)}
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
          placeholder="Search by product title or SKU..."
          className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Product & SKU</th>
                <th className="px-6 py-3.5">Warehouse</th>
                <th className="px-6 py-3.5">Tenant Organization</th>
                <th className="px-6 py-3.5">On Hand</th>
                <th className="px-6 py-3.5">Allocated</th>
                <th className="px-6 py-3.5">Available</th>
                <th className="px-6 py-3.5">Last Mutation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading cross-tenant inventory...
                  </td>
                </tr>
              ) : stock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No stock balance records found.
                  </td>
                </tr>
              ) : (
                stock.map((s) => {
                  const onHand = Number(s.quantityOnHand || 0);
                  const allocated = Number(s.quantityAllocated || 0);
                  const available = Number(s.quantityAvailable || 0);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{s.product?.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {s.product?.sku}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <Warehouse className="h-3.5 w-3.5 text-amber-500" />
                          {s.warehouse?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-800">
                          <Building2 className="h-3.5 w-3.5 text-blue-600" />
                          {s.organization?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {onHand.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-amber-600 font-medium">
                        {allocated.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-bold ${
                            available <= 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {available.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(s.updatedAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
