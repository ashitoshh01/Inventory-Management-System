import { apiClient } from './client';
import {
  AdminDashboardStats,
  AdminRecentActivity,
  AdminOrganizationListItem,
  AdminOrganizationDetail,
  AdminUserListItem,
  AdminUserDetail,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminAddMembershipDto,
  AdminUpdateMembershipDto,
  AdminAccountRequestItem,
  AdminCreateAccountRequestDto,
  AdminUpdateAccountRequestDto,
  AdminRoleItem,
  AdminRoleDetail,
  AdminPermissionItem,
  AdminAuditEventItem,
  AdminSystemHealth,
  AdminJobStats,
  AdminPaginationQuery,
} from '@repo/types';

const toQueryString = (params?: Record<string, unknown>): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

export const adminApi = {
  // Dashboard
  getDashboardStats: () =>
    apiClient<AdminDashboardStats>('/admin/dashboard'),

  getRecentActivity: (limit = 20) =>
    apiClient<AdminRecentActivity[]>(`/admin/dashboard/activity?limit=${limit}`),

  // Organizations
  listOrganizations: (params?: AdminPaginationQuery | undefined) =>
    apiClient<{ items: AdminOrganizationListItem[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/organizations${toQueryString(params as Record<string, unknown>)}`,
    ),

  getOrganization: (id: string) =>
    apiClient<AdminOrganizationDetail>(`/admin/organizations/${id}`),

  createOrganization: (data: { name: string }) =>
    apiClient<AdminOrganizationListItem>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOrganization: (id: string, data: { name?: string; isActive?: boolean }) =>
    apiClient<AdminOrganizationListItem>(`/admin/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Users
  listUsers: (params?: AdminPaginationQuery | undefined) =>
    apiClient<{ items: AdminUserListItem[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/users${toQueryString(params as Record<string, unknown>)}`,
    ),

  getUser: (id: string) =>
    apiClient<AdminUserDetail>(`/admin/users/${id}`),

  createUser: (data: AdminCreateUserDto) =>
    apiClient<{ id: string; email: string; isActive: boolean; isPlatformAdmin: boolean }>(
      '/admin/users',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    ),

  updateUser: (id: string, data: AdminUpdateUserDto) =>
    apiClient<AdminUserListItem>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addMembership: (userId: string, data: AdminAddMembershipDto) =>
    apiClient<unknown>(`/admin/users/${userId}/memberships`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMembership: (userId: string, membershipId: string, data: AdminUpdateMembershipDto) =>
    apiClient<unknown>(`/admin/users/${userId}/memberships/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Account Requests
  listAccountRequests: (params?: (AdminPaginationQuery & { status?: string | undefined }) | undefined) =>
    apiClient<{ items: AdminAccountRequestItem[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/account-requests${toQueryString(params as Record<string, unknown>)}`,
    ),

  createAccountRequest: (data: AdminCreateAccountRequestDto) =>
    apiClient<AdminAccountRequestItem>('/admin/account-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAccountRequest: (id: string, data: AdminUpdateAccountRequestDto) =>
    apiClient<AdminAccountRequestItem>(`/admin/account-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Roles & Permissions
  listRoles: () =>
    apiClient<AdminRoleItem[]>('/admin/roles'),

  getRole: (id: string) =>
    apiClient<AdminRoleDetail>(`/admin/roles/${id}`),

  listPermissions: () =>
    apiClient<AdminPermissionItem[]>('/admin/permissions'),

  // Cross-tenant domain entities (Read-only)
  listProducts: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/products${toQueryString(params as Record<string, unknown>)}`,
    ),

  listCategories: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/categories${toQueryString(params as Record<string, unknown>)}`,
    ),

  listWarehouses: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/warehouses${toQueryString(params as Record<string, unknown>)}`,
    ),

  listStock: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/stock${toQueryString(params as Record<string, unknown>)}`,
    ),

  listStockLedger: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/stock/ledger${toQueryString(params as Record<string, unknown>)}`,
    ),

  listPurchaseOrders: (params?: (AdminPaginationQuery & { organizationId?: string | undefined; status?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/purchase-orders${toQueryString(params as Record<string, unknown>)}`,
    ),

  listTransfers: (params?: (AdminPaginationQuery & { organizationId?: string | undefined; status?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/transfers${toQueryString(params as Record<string, unknown>)}`,
    ),

  listSalesOrders: (params?: (AdminPaginationQuery & { organizationId?: string | undefined; status?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/sales-orders${toQueryString(params as Record<string, unknown>)}`,
    ),

  listCustomers: (params?: (AdminPaginationQuery & { organizationId?: string | undefined }) | undefined) =>
    apiClient<{ items: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/customers${toQueryString(params as Record<string, unknown>)}`,
    ),

  // Audit Logs
  listAuditLogs: (params?: Record<string, unknown>) =>
    apiClient<{ items: AdminAuditEventItem[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
      `/admin/audit${toQueryString(params)}`,
    ),

  // System Health
  getSystemHealth: () =>
    apiClient<AdminSystemHealth>('/admin/system/health'),

  getJobStats: () =>
    apiClient<AdminJobStats>('/admin/system/jobs'),

  getNotificationStats: () =>
    apiClient<{ total: number; unread: number; read: number }>('/admin/system/notifications'),
};
