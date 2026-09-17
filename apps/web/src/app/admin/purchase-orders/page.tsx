'use client';

import * as React from 'react';
import { ShoppingCart, Search, Building2, Warehouse, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';

export default function AdminPurchaseOrdersPage() {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const fetchOrders = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await adminApi.listPurchaseOrders({
        search: search || undefined,
        status: status || undefined,
        page,
        pageSize: 25,
      });
      setOrders(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, page]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Cross-Tenant Purchase Orders
          </h2>
          <p className="text-sm text-slate-500">
            Procurement records across all tenant partitions ({total} orders)
          </p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm w-full">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by PO number or supplier name..."
            className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm focus:outline-none w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">PO Number</th>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">Tenant Organization</th>
                <th className="px-6 py-3.5">Warehouse</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Total Amount</th>
                <th className="px-6 py-3.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                      {po.purchaseOrderNumber}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{po.supplierName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        {po.organization?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                        {po.warehouse?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      ₹{Number(po.grandTotal || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(po.createdAt).toLocaleDateString()}
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
