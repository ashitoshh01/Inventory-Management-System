'use client';

import * as React from 'react';
import {
  Activity,
  Database,
  Server,
  Cloud,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  FileUp,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';
import { AdminSystemHealth, AdminJobStats } from '@repo/types';

export default function AdminSystemHealthPage() {
  const [health, setHealth] = React.useState<AdminSystemHealth | null>(null);
  const [jobs, setJobs] = React.useState<AdminJobStats | null>(null);
  const [notifications, setNotifications] = React.useState<{
    total: number;
    unread: number;
    read: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTelemetry = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const [healthRes, jobsRes, notifRes] = await Promise.all([
        adminApi.getSystemHealth(),
        adminApi.getJobStats(),
        adminApi.getNotificationStats(),
      ]);
      setHealth(healthRes.data);
      setJobs(jobsRes.data);
      setNotifications(notifRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Telemetry probes failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds % 60}s`;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'up' || status === 'ok') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    if (status === 'degraded') {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Probing infrastructure nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            System Infrastructure & Telemetry
          </h2>
          <p className="text-sm text-slate-500">
            Live health checks, worker pipeline queue stats, and platform dependencies
          </p>
        </div>
        <button
          onClick={() => fetchTelemetry(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Run Health Probe
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
          Note: {error}
        </div>
      )}

      {/* Infrastructure Nodes Health */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PostgreSQL */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/50">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">PostgreSQL</h4>
                <p className="text-[10px] text-slate-400 font-mono">Primary DB</p>
              </div>
            </div>
            {getStatusIcon(health?.database || 'down')}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">Status</span>
            <span className={health?.database === 'up' ? 'text-emerald-700' : 'text-red-700'}>
              {health?.database?.toUpperCase() || 'UNREACHABLE'}
            </span>
          </div>
        </div>

        {/* Redis */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200/50">
                <Server className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Redis Cache</h4>
                <p className="text-[10px] text-slate-400 font-mono">Queue & Session</p>
              </div>
            </div>
            {getStatusIcon(health?.redis || 'down')}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">Status</span>
            <span className={health?.redis === 'up' ? 'text-emerald-700' : 'text-red-700'}>
              {health?.redis?.toUpperCase() || 'UNREACHABLE'}
            </span>
          </div>
        </div>

        {/* Cloudinary / Storage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/50">
                <Cloud className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Media Storage</h4>
                <p className="text-[10px] text-slate-400 font-mono">Cloudinary CDN</p>
              </div>
            </div>
            {getStatusIcon(health?.storage || 'up')}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">Status</span>
            <span className="text-emerald-700">
              {health?.storage ? health.storage.toUpperCase() : 'CONFIGURED'}
            </span>
          </div>
        </div>

        {/* API Uptime */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-200/50">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">API Runtime</h4>
                <p className="text-[10px] text-slate-400 font-mono">Process Uptime</p>
              </div>
            </div>
            <Activity className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">Uptime</span>
            <span className="font-mono text-slate-900">
              {formatUptime(health?.uptimeSeconds || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Background Job Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Jobs Pipeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60">
              <FileDown className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export Jobs Pipeline</h3>
              <p className="text-xs text-slate-500">Worker batch CSV report generator</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-slate-700">
                {jobs?.exportJobs.pending ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Pending</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-lg font-bold text-blue-700">
                {jobs?.exportJobs.processing ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-blue-600 uppercase">Running</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-lg font-bold text-emerald-700">
                {jobs?.exportJobs.completed ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase">Completed</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <div className="text-lg font-bold text-red-700">
                {jobs?.exportJobs.failed ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-red-600 uppercase">Failed</div>
            </div>
          </div>
        </div>

        {/* Import Jobs Pipeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Jobs Pipeline</h3>
              <p className="text-xs text-slate-500">Bulk catalogue and inventory data ingestion</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-slate-700">
                {jobs?.importJobs.pending ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Pending</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-lg font-bold text-blue-700">
                {jobs?.importJobs.processing ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-blue-600 uppercase">Running</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-lg font-bold text-emerald-700">
                {jobs?.importJobs.completed ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase">Completed</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <div className="text-lg font-bold text-red-700">
                {jobs?.importJobs.failed ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-red-600 uppercase">Failed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Pipeline Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Notification Alerts Engine</h3>
              <p className="text-xs text-slate-500">Platform-wide alert messages and low stock triggers</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-600">
              {notifications?.total ?? 0} Total Generated
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="text-xs font-semibold text-slate-500">Unread Alert Messages</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">
              {notifications?.unread ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="text-xs font-semibold text-slate-500">Acknowledged Alerts</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {notifications?.read ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
