'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Users,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';
import { AdminOrganizationListItem } from '@repo/types';

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = React.useState<AdminOrganizationListItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState('');
  const [createSubmitting, setCreateSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fetchOrgs = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setActionError(null);
      const res = await adminApi.listOrganizations({
        search: search || undefined,
        page,
        pageSize: 20,
      });
      setOrgs(res.data.items);
      setTotal(res.data.meta.total);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, page]);

  React.useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      setCreateSubmitting(true);
      setActionError(null);
      await adminApi.createOrganization({ name: newOrgName.trim() });
      setNewOrgName('');
      setIsCreateModalOpen(false);
      await fetchOrgs();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleStatus = async (org: AdminOrganizationListItem) => {
    try {
      setActionError(null);
      await adminApi.updateOrganization(org.id, { isActive: !org.isActive });
      await fetchOrgs();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update organization');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Organizations</h2>
          <p className="text-sm text-slate-500">
            Tenant organization management ({total} registered)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrgs(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Organization
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Search Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Filter organizations by name or slug..."
          className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Organizations Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Organization</th>
                <th className="px-6 py-3.5">Slug</th>
                <th className="px-6 py-3.5">Members</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading organizations...
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No organizations match your query.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/50 font-bold">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <Link
                            href={`/admin/organizations/${org.id}`}
                            className="font-semibold text-slate-900 hover:text-purple-600 transition-colors"
                          >
                            {org.name}
                          </Link>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {org.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600">
                      {org.slug}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>{org.memberCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(org)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          org.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        }`}
                        title="Click to toggle status"
                      >
                        {org.isActive ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Suspended
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Details
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Org Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Provision Tenant Organization</h3>
            <p className="mt-1 text-xs text-slate-500">
              Creates an isolated tenant organization with its own partition key and default RBAC roles.
            </p>

            <form onSubmit={handleCreateOrg} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Logistics India"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
