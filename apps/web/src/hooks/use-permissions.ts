'use client';

export interface PermissionsState {
  canReadProducts: boolean;
  canCreateProduct: boolean;
  canUpdateProduct: boolean;
  canDeleteProduct: boolean;
  canReadWarehouses: boolean;
  canCreateWarehouse: boolean;
  canUpdateWarehouse: boolean;
  canDeleteWarehouse: boolean;
  hasPermission: (permission: string) => boolean;
}

export function usePermissions(): PermissionsState {
  if (typeof window === 'undefined') {
    return {
      canReadProducts: true,
      canCreateProduct: true,
      canUpdateProduct: true,
      canDeleteProduct: true,
      canReadWarehouses: true,
      canCreateWarehouse: true,
      canUpdateWarehouse: true,
      canDeleteWarehouse: true,
      hasPermission: () => true,
    };
  }

  const stored = localStorage.getItem('user_permissions');
  let permissions: string[] = [
    'product.read',
    'product.create',
    'product.update',
    'product.delete',
    'warehouse.read',
    'warehouse.create',
    'warehouse.update',
    'warehouse.delete',
  ];
  if (stored) {
    try {
      permissions = JSON.parse(stored);
    } catch {
      // fallback
    }
  }

  const hasPermission = (permission: string) => permissions.includes(permission);

  return {
    canReadProducts: hasPermission('product.read'),
    canCreateProduct: hasPermission('product.create'),
    canUpdateProduct: hasPermission('product.update'),
    canDeleteProduct: hasPermission('product.delete'),
    canReadWarehouses: hasPermission('warehouse.read'),
    canCreateWarehouse: hasPermission('warehouse.create'),
    canUpdateWarehouse: hasPermission('warehouse.update'),
    canDeleteWarehouse: hasPermission('warehouse.delete'),
    hasPermission,
  };
}
