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
  canReadStock: boolean;
  canMutateStock: boolean;
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
      canReadStock: true,
      canMutateStock: true,
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
    'stock.read',
    'stock.mutate',
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
    canReadStock: hasPermission('stock.read'),
    canMutateStock: hasPermission('stock.mutate'),
    hasPermission,
  };
}
