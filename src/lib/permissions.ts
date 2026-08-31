import type { Session } from 'next-auth'

type Role = 'ADMIN' | 'MANAGER' | 'WAREHOUSE_STAFF' | 'SALES' | 'ACCOUNTANT' | 'VIEWER'

const PERMISSIONS: Record<Role, Record<string, string[]>> = {
  ADMIN: {
    '*': ['*'],
  },
  MANAGER: {
    products: ['read', 'create', 'update', 'delete'],
    warehouses: ['read', 'create', 'update', 'delete'],
    stock: ['read', 'create', 'update', 'delete', 'adjust'],
    purchasing: ['read', 'create', 'update', 'delete', 'approve'],
    sales: ['read', 'create', 'update', 'delete'],
    pos: ['read', 'create', 'update', 'delete'],
    reports: ['read'],
    users: ['read'],
    settings: ['read', 'update'],
  },
  WAREHOUSE_STAFF: {
    products: ['read'],
    warehouses: ['read'],
    stock: ['read', 'create', 'update'],
    purchasing: ['read', 'update'],
    sales: ['read', 'update'],
    pos: [],
    reports: [],
    users: [],
    settings: [],
  },
  SALES: {
    products: ['read'],
    warehouses: ['read'],
    stock: ['read'],
    purchasing: [],
    sales: ['read', 'create', 'update'],
    pos: ['read', 'create', 'update'],
    reports: [],
    users: [],
    settings: [],
  },
  ACCOUNTANT: {
    products: ['read'],
    warehouses: ['read'],
    stock: ['read'],
    purchasing: ['read'],
    sales: ['read'],
    pos: ['read'],
    reports: ['read', 'create'],
    users: [],
    settings: [],
  },
  VIEWER: {
    products: ['read'],
    warehouses: ['read'],
    stock: ['read'],
    purchasing: ['read'],
    sales: ['read'],
    pos: ['read'],
    reports: ['read'],
    users: ['read'],
    settings: [],
  }
}

export function can(session: Session | null, action: string, resource: string, targetWarehouseId?: string): boolean {
  if (!session?.user?.role) return false
  
  const role = session.user.role as Role
  const rolePermissions = PERMISSIONS[role]
  
  if (!rolePermissions) return false
  
  if (rolePermissions['*']?.includes('*')) return true
  
  const resourcePermissions = rolePermissions[resource]
  
  if (!resourcePermissions) return false
  
  const hasAction = resourcePermissions.includes(action) || resourcePermissions.includes('*')
  if (!hasAction) return false
  
  if (targetWarehouseId && session.user.warehouseId) {
    if (session.user.warehouseId !== targetWarehouseId) {
      return false
    }
  }
  
  return true
}
