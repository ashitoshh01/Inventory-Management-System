'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Package,
  Warehouse,
  Boxes,
  ShoppingCart,
  ReceiptText,
  ArrowLeftRight,
  Activity,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../lib/api/admin';
import { AdminDashboardStats, AdminRecentActivity } from '@repo/types';

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<AdminDashboardStats | null>(null);
  const [activity, setActivity] = React.useState<AdminRecentActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const [statsRes, activityRes] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getRecentActivity(10),
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load platform data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Aggregating platform telemetry...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations ?? 0,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200/60',
      href: '/admin/organizations',
    },
    {
      title: 'Platform Users',
      value: stats?.totalUsers ?? 0,
      subValue: `${stats?.activeUsers ?? 0} active`,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200/60',
      href: '/admin/users',
    },
    {
      title: 'Catalog Products',
      value: stats?.totalProducts ?? 0,
      icon: Package,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 border-indigo-200/60',
      href: '/admin/products',
    },
    {
      title: 'Warehouses',
      value: stats?.totalWarehouses ?? 0,
      icon: Warehouse,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200/60',
      href: '/admin/warehouses',
    },
    {
      title: 'Stock Balances',
      value: stats?.totalStockEntries ?? 0,
      icon: Boxes,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200/60',
      href: '/admin/inventory',
    },
    {
      title: 'Purchase Orders',
      value: stats?.totalPurchaseOrders ?? 0,
      icon: ShoppingCart,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-200/60',
      href: '/admin/purchase-orders',
    },
    {
      title: 'Sales Orders',
      value: stats?.totalSalesOrders ?? 0,
      icon: ReceiptText,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50 border-cyan-200/60',
      href: '/admin/sales',
    },
    {
      title: 'Stock Transfers',
      value: stats?.totalTransfers ?? 0,
      icon: ArrowLeftRight,
      color: 'text-orange-600',
      bg: 'bg-orange-50 border-orange-200/60',
      href: '/admin/transfers',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Overview
          </h2>
          <p className="text-sm text-slate-500">
            Global operational overview across all tenant organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/users/new"
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create User
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.title}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {card.value.toLocaleString()}
                </span>
                {card.subValue && (
                  <span className="text-xs font-medium text-emerald-600">
                    {card.subValue}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-purple-600 transition-colors">
                <span>View details</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column Layout: Quick Actions & Recent Platform Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Recent Cross-Org Activity */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Platform Activity</h3>
              <p className="text-xs text-slate-500">Live immutable audit trail events</p>
            </div>
            <Link
              href="/admin/audit"
              className="text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              View all logs &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {activity.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent activity recorded.
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {item.description}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {item.actorEmail && (
                        <span className="font-medium text-slate-700">by {item.actorEmail}</span>
                      )}
                      {item.organizationName && (
                        <>
                          <span>&bull;</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                            {item.organizationName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Links & Platform Status */}
        <div className="space-y-6">
          {/* Quick Management Links */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Administrative Shortcuts</h3>
            <div className="space-y-2">
              <Link
                href="/admin/organizations"
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Organizations</div>
                    <div className="text-[11px] text-slate-400">Manage tenant accounts</div>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/admin/account-requests"
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Account Inquiries</div>
                    <div className="text-[11px] text-slate-400">Review WhatsApp lead requests</div>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/admin/system"
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">System Telemetry</div>
                    <div className="text-[11px] text-slate-400">Health checks & job queues</div>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* Platform Status Badge */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-900">Platform Online</h4>
                <p className="text-[11px] text-emerald-700">Cross-tenant isolation active</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-emerald-800/80 leading-relaxed">
              Database migrations are aligned and tenant boundaries are enforced at the organization gateway.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
