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
  canReadPurchaseOrders: boolean;
  canCreatePurchaseOrder: boolean;
  canUpdatePurchaseOrder: boolean;
  canDeletePurchaseOrder: boolean;
  canSubmitPurchaseOrder: boolean;
  canApprovePurchaseOrder: boolean;
  canCancelPurchaseOrder: boolean;
  canReceivePurchaseOrder: boolean;
  canReadTransfers: boolean;
  canCreateTransfer: boolean;
  canUpdateTransfer: boolean;
  canDeleteTransfer: boolean;
  canApproveTransfer: boolean;
  canShipTransfer: boolean;
  canReceiveTransfer: boolean;
  canCancelTransfer: boolean;
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
      canReadPurchaseOrders: true,
      canCreatePurchaseOrder: true,
      canUpdatePurchaseOrder: true,
      canDeletePurchaseOrder: true,
      canSubmitPurchaseOrder: true,
      canApprovePurchaseOrder: true,
      canCancelPurchaseOrder: true,
      canReceivePurchaseOrder: true,
      canReadTransfers: true,
      canCreateTransfer: true,
      canUpdateTransfer: true,
      canDeleteTransfer: true,
      canApproveTransfer: true,
      canShipTransfer: true,
      canReceiveTransfer: true,
      canCancelTransfer: true,
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
    'purchase-order.read',
    'purchase-order.create',
    'purchase-order.update',
    'purchase-order.delete',
    'purchase-order.submit',
    'purchase-order.approve',
    'purchase-order.cancel',
    'purchase-order.receive',
    'stock-transfer.read',
    'stock-transfer.create',
    'stock-transfer.update',
    'stock-transfer.delete',
    'stock-transfer.approve',
    'stock-transfer.ship',
    'stock-transfer.receive',
    'stock-transfer.cancel',
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
    canReadPurchaseOrders: hasPermission('purchase-order.read'),
    canCreatePurchaseOrder: hasPermission('purchase-order.create'),
    canUpdatePurchaseOrder: hasPermission('purchase-order.update'),
    canDeletePurchaseOrder: hasPermission('purchase-order.delete'),
    canSubmitPurchaseOrder: hasPermission('purchase-order.submit'),
    canApprovePurchaseOrder: hasPermission('purchase-order.approve'),
    canCancelPurchaseOrder: hasPermission('purchase-order.cancel'),
    canReceivePurchaseOrder: hasPermission('purchase-order.receive'),
    canReadTransfers: hasPermission('stock-transfer.read'),
    canCreateTransfer: hasPermission('stock-transfer.create'),
    canUpdateTransfer: hasPermission('stock-transfer.update'),
    canDeleteTransfer: hasPermission('stock-transfer.delete'),
    canApproveTransfer: hasPermission('stock-transfer.approve'),
    canShipTransfer: hasPermission('stock-transfer.ship'),
    canReceiveTransfer: hasPermission('stock-transfer.receive'),
    canCancelTransfer: hasPermission('stock-transfer.cancel'),
    hasPermission,
  };
}
