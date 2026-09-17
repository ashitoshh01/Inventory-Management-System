'use client';

import * as React from 'react';
import {
  FileSpreadsheet,
  Search,
  Building2,
  User,
  Clock,
  Code2,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';
import { AdminAuditEventItem } from '@repo/types';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = React.useState<AdminAuditEventItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [action, setAction] = React.useState('');
  const [entityType, setEntityType] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  const fetchLogs = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await adminApi.listAuditLogs({
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        page,
        pageSize: 30,
      });
      setLogs(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, action, entityType, page]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Immutable Audit Trail
          </h2>
          <p className="text-sm text-slate-500">
            Permanent platform governance log across all tenant partitions ({total} events recorded)
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search action or entity ID..."
            className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <input
          type="text"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action (e.g. user.create)..."
          className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none"
        />

        <input
          type="text"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by entity type (e.g. User, Organization)..."
          className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none"
        />
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action Executed</th>
                <th className="px-6 py-3.5">Entity Type & ID</th>
                <th className="px-6 py-3.5">Actor Identity</th>
                <th className="px-6 py-3.5">Tenant Organization</th>
                <th className="px-6 py-3.5 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Querying audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records match your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(log.createdAt).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-purple-700 border border-purple-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800">{log.entityType}</div>
                        {log.entityId && (
                          <div className="font-mono text-[10px] text-slate-400">
                            {log.entityId.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate max-w-[140px]">
                            {log.actorEmail || log.actorUserId || 'System/Cron'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        {log.organizationName ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            <span className="truncate max-w-[120px]">{log.organizationName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Global Platform</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {log.metadata ? (
                          <button
                            onClick={() =>
                              setExpandedRow(expandedRow === log.id ? null : log.id)
                            }
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Code2 className="h-3 w-3 text-slate-500" />
                            {expandedRow === log.id ? 'Hide' : 'Inspect'}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedRow === log.id && log.metadata && (
                      <tr className="bg-slate-900 text-slate-100">
                        <td colSpan={6} className="p-4 font-mono text-[11px]">
                          <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-1 text-slate-400">
                            <span>Audit Event Metadata (Sanitized)</span>
                            <span>ID: {log.id}</span>
                          </div>
                          <pre className="overflow-x-auto text-emerald-400">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
