'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Shield,
  Key,
} from 'lucide-react';
import { adminApi } from '../../../../lib/api/admin';
import { AdminOrganizationDetail } from '@repo/types';

export default function AdminOrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = React.useState<AdminOrganizationDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDetail = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getOrganization(orgId);
      setOrg(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleToggleStatus = async () => {
    if (!org) return;
    try {
      await adminApi.updateOrganization(org.id, { isActive: !org.isActive });
      await fetchDetail();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{error || 'Organization not found'}</p>
        <button
          onClick={() => router.push('/admin/organizations')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Organizations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div>
        <Link
          href="/admin/organizations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Organizations
        </Link>
      </div>

      {/* Main Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">{org.name}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    org.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {org.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {org.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-400">
                Slug: {org.slug} &bull; Partition ID: {org.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStatus}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors ${
                org.isActive
                  ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
                  : 'border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {org.isActive ? 'Suspend Organization' : 'Reactivate Organization'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-[11px] text-slate-400">Total Memberships</div>
              <div className="text-sm font-semibold text-slate-900">{org.memberCount} users</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-[11px] text-slate-400">Created At</div>
              <div className="text-sm font-semibold text-slate-900">
                {new Date(org.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-[11px] text-slate-400">Tenant Isolation</div>
              <div className="text-sm font-semibold text-emerald-700">Strictly Enforced</div>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Organization Members</h3>
          <p className="text-xs text-slate-500">Users who hold roles inside this tenant partition</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Membership Status</th>
                <th className="px-6 py-3.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {org.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No members assigned to this organization yet.
                  </td>
                </tr>
              ) : (
                org.members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      <Link
                        href={`/admin/users/${m.userId}`}
                        className="hover:text-purple-600 transition-colors"
                      >
                        {m.email}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        <Key className="h-3 w-3 text-slate-400" />
                        {m.roleName}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString()}
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
