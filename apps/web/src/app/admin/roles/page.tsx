'use client';

import * as React from 'react';
import {
  ShieldAlert,
  Key,
  Shield,
  CheckCircle2,
  Users,
  Search,
  Lock,
} from 'lucide-react';
import { adminApi } from '../../../lib/api/admin';
import { AdminRoleItem, AdminRoleDetail, AdminPermissionItem } from '@repo/types';

export default function AdminRolesPage() {
  const [roles, setRoles] = React.useState<AdminRoleItem[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<AdminRoleDetail | null>(null);
  const [allPermissions, setAllPermissions] = React.useState<AdminPermissionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [rolesRes, permsRes] = await Promise.all([
          adminApi.listRoles(),
          adminApi.listPermissions(),
        ]);
        setRoles(rolesRes.data);
        setAllPermissions(permsRes.data);
        if (rolesRes.data.length > 0) {
          loadRoleDetail(rolesRes.data[0]?.id || '');
        }
      } catch (err) {
        console.error('Failed to load roles/permissions', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const loadRoleDetail = async (roleId: string) => {
    try {
      setLoadingDetail(true);
      const res = await adminApi.getRole(roleId);
      setSelectedRole(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredPermissions = allPermissions.filter((p) =>
    search ? p.action.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Roles & RBAC Registry
        </h2>
        <p className="text-sm text-slate-500">
          Tenant role definitions and fine-grained authorization permission boundaries
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roles List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Standard System Roles
          </h3>
          <div className="space-y-2">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading roles...</div>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => loadRoleDetail(role.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    selectedRole?.id === role.id
                      ? 'border-purple-600 bg-purple-50/50 shadow-sm ring-1 ring-purple-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{role.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {role.permissionCount} actions
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {role.description || 'Pre-configured tenant role'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    <span>{role.membershipCount} assigned users</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Role Permissions Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {selectedRole ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-purple-600" />
                      <h3 className="text-base font-bold text-slate-900">{selectedRole.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{selectedRole.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      {selectedRole.permissionCount} permissions granted
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search permissions by action name..."
                    className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                  />
                </div>

                {loadingDetail ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Loading role permissions...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
                    {filteredPermissions.map((perm) => {
                      const isGranted = selectedRole.permissions.some((p) => p.id === perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                            isGranted
                              ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                              : 'border-slate-100 bg-slate-50/40 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isGranted ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Lock className="h-3.5 w-3.5 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono font-semibold truncate text-[11px]">
                              {perm.action}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {perm.description || 'System operation'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Select a role to view its permission manifest.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
