'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft, Building2, Key, Mail, Lock } from 'lucide-react';
import { adminApi } from '../../../../lib/api/admin';
import { AdminOrganizationListItem, AdminRoleItem } from '@repo/types';

export default function AdminCreateUserPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [roleId, setRoleId] = React.useState('');

  const [orgs, setOrgs] = React.useState<AdminOrganizationListItem[]>([]);
  const [roles, setRoles] = React.useState<AdminRoleItem[]>([]);
  const [loadingLookups, setLoadingLookups] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadLookups() {
      try {
        const [orgsRes, rolesRes] = await Promise.all([
          adminApi.listOrganizations({ pageSize: 100 }),
          adminApi.listRoles(),
        ]);
        setOrgs(orgsRes.data.items);
        setRoles(rolesRes.data);
      } catch (err: unknown) {
        console.error('Failed to load lookup data', err);
      } finally {
        setLoadingLookups(false);
      }
    }
    loadLookups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await adminApi.createUser({
        email: email.trim().toLowerCase(),
        password,
        organizationId: organizationId || undefined,
        roleId: roleId || undefined,
      });

      router.push(`/admin/users/${res.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Provision User Account</h2>
            <p className="text-xs text-slate-500">
              Create a new user with argon2id hashed credentials and optional tenant assignment
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@organization.com"
                required
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Initial Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Password will be encrypted using Argon2id with memory cost 64MB and 4-way parallelism.
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800">
              <span className="font-semibold">Temporary Password Policy:</span> This initial password is temporary. The user will be required to change it on their first login.
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tenant Membership Assignment (Optional)
            </h4>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assign to Organization
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                >
                  <option value="">-- No initial organization (Identity only) --</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {organizationId && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tenant RBAC Role
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                  >
                    <option value="">-- Default (Owner role) --</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.permissionCount} permissions)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => router.push('/admin/users')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingLookups}
              className="rounded-lg bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {submitting ? 'Creating User...' : 'Provision User Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
