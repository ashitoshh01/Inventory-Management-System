// ============================================================
// Admin Panel Types — Platform-level administration
// ============================================================

// --- Dashboard ---

export interface AdminDashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  totalWarehouses: number;
  totalStockEntries: number;
  totalPurchaseOrders: number;
  totalSalesOrders: number;
  totalTransfers: number;
}

export interface AdminRecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  timestamp: string;
  actorEmail: string | null;
  organizationName: string | null;
}

// --- Organizations ---

export interface AdminOrganizationListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganizationDetail extends AdminOrganizationListItem {
  members: AdminMemberItem[];
}

export interface AdminMemberItem {
  id: string;
  userId: string;
  email: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

// --- Users ---

export interface AdminUserListItem {
  id: string;
  email: string;
  isActive: boolean;
  isPlatformAdmin: boolean;
  membershipCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  memberships: AdminUserMembership[];
}

export interface AdminUserMembership {
  id: string;
  organizationId: string;
  organizationName: string;
  roleName: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminCreateUserDto {
  email: string;
  password: string;
  organizationId?: string | undefined;
  roleId?: string | undefined;
}

export interface AdminUpdateUserDto {
  email?: string | undefined;
  isActive?: boolean | undefined;
}

export interface AdminAddMembershipDto {
  organizationId: string;
  roleId: string;
}

export interface AdminUpdateMembershipDto {
  roleId?: string | undefined;
  isActive?: boolean | undefined;
}

// --- Account Requests ---

export type AccountRequestStatus = 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface AdminAccountRequestItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: AccountRequestStatus;
  notes: string | null;
  handledByEmail: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateAccountRequestDto {
  name: string;
  phone: string;
  email?: string | undefined;
  notes?: string | undefined;
}

export interface AdminUpdateAccountRequestDto {
  status?: AccountRequestStatus | undefined;
  notes?: string | undefined;
}

// --- Roles & Permissions ---

export interface AdminRoleItem {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number;
  membershipCount: number;
}

export interface AdminRoleDetail extends AdminRoleItem {
  permissions: AdminPermissionItem[];
}

export interface AdminPermissionItem {
  id: string;
  action: string;
  description: string | null;
}

// --- Audit ---

export interface AdminAuditEventItem {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// --- System Health ---

export interface AdminSystemHealth {
  status: string;
  database: string;
  redis: string;
  storage?: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface AdminJobStats {
  exportJobs: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  importJobs: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// --- Pagination ---

export interface AdminPaginationQuery {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}
