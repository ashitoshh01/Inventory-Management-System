'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Building2,
  Key,
  Calendar,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import { adminApi } from '../../../../lib/api/admin';
import { AdminUserDetail, AdminOrganizationListItem, AdminRoleItem } from '@repo/types';

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = React.useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Add membership state
  const [isAddMembershipOpen, setIsAddMembershipOpen] = React.useState(false);
  const [orgs, setOrgs] = React.useState<AdminOrganizationListItem[]>([]);
  const [roles, setRoles] = React.useState<AdminRoleItem[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState('');
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [membershipSubmitting, setMembershipSubmitting] = React.useState(false);

  const fetchUser = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getUser(userId);
      setUser(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loadMembershipLookups = async () => {
    try {
      const [orgsRes, rolesRes] = await Promise.all([
        adminApi.listOrganizations({ pageSize: 100 }),
        adminApi.listRoles(),
      ]);
      setOrgs(orgsRes.data.items);
      setRoles(rolesRes.data);
      if (orgsRes.data.items.length > 0) setSelectedOrgId(orgsRes.data.items[0]?.id || '');
      if (rolesRes.data.length > 0) setSelectedRoleId(rolesRes.data[0]?.id || '');
      setIsAddMembershipOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations or roles');
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      await fetchUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleAddMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedRoleId) return;
    try {
      setMembershipSubmitting(true);
      await adminApi.addMembership(userId, {
        organizationId: selectedOrgId,
        roleId: selectedRoleId,
      });
      setIsAddMembershipOpen(false);
      await fetchUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign organization membership');
    } finally {
      setMembershipSubmitting(false);
    }
  };

  const handleToggleMembership = async (membershipId: string, currentActive: boolean) => {
    try {
      await adminApi.updateMembership(userId, membershipId, { isActive: !currentActive });
      await fetchUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update membership');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{error || 'User not found'}</p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </Link>
      </div>

      {/* User Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold text-lg border border-purple-200">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">{user.email}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {user.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {user.isActive ? 'Active' : 'Suspended'}
                </span>
                {user.isPlatformAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Platform Administrator
                  </span>
                )}
                {user.mustChangePassword && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                    <Key className="h-3.5 w-3.5 text-amber-600" />
                    Password Change Pending
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-slate-400">User ID: {user.id}</p>
            </div>
          </div>

          <div>
            <button
              onClick={handleToggleActive}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors ${
                user.isActive
                  ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
                  : 'border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {user.isActive ? 'Suspend User Access' : 'Reactivate User Account'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-[11px] text-slate-400">Tenant Organizations</div>
              <div className="text-sm font-semibold text-slate-900">
                Member of {user.membershipCount} organization{user.membershipCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-[11px] text-slate-400">Account Created</div>
              <div className="text-sm font-semibold text-slate-900">
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memberships Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Tenant Memberships & Roles</h3>
            <p className="text-xs text-slate-500">
              Assigned organization workspaces and RBAC permission sets
            </p>
          </div>
          <button
            onClick={loadMembershipLookups}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Assign Organization
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Organization</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Membership Status</th>
                <th className="px-6 py-3.5">Granted On</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {user.memberships.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    This user does not belong to any tenant organization.
                  </td>
                </tr>
              ) : (
                user.memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      <Link
                        href={`/admin/organizations/${m.organizationId}`}
                        className="hover:text-purple-600 transition-colors"
                      >
                        {m.organizationName}
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
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {m.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleMembership(m.id, m.isActive)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-purple-600 underline"
                      >
                        {m.isActive ? 'Revoke' : 'Re-enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Organization Modal */}
      {isAddMembershipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Assign Organization Membership</h3>
            <p className="mt-1 text-xs text-slate-500">
              Grants this user access to a specific tenant workspace with the selected role.
            </p>

            <form onSubmit={handleAddMembership} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tenant Organization
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                >
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RBAC Role
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.permissionCount} permissions)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMembershipOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={membershipSubmitting}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {membershipSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
