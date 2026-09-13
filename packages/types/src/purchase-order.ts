import { PaginationParams } from './domain.js';

export const PURCHASE_ORDER_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS_VALUES)[number];

export const ALLOWED_PURCHASE_ORDER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'orderDate',
  'expectedDate',
  'purchaseOrderNumber',
  'status',
  'grandTotal',
] as const;

export type AllowedPurchaseOrderSortField = (typeof ALLOWED_PURCHASE_ORDER_SORT_FIELDS)[number];

export interface PurchaseOrderLineDto {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  productId: string;
  quantity: string; // Exact 4-decimal representation (e.g. "10.0000")
  unitPrice: string; // Exact decimal representation (e.g. "25.5000")
  lineTotal: string; // Authoritative exact line total (e.g. "255.0000")
  receivedQuantity: string; // Exact 4-decimal representation (e.g. "0.0000")
  notes?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDto {
  id: string;
  organizationId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  supplierEmail?: string | null | undefined;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null | undefined;
  warehouseId: string;
  currency: string;
  subtotal: string; // Exact decimal representation
  taxTotal: string; // Exact decimal representation
  grandTotal: string; // Exact decimal representation
  notes?: string | null | undefined;
  createdById?: string | null | undefined;
  approvedById?: string | null | undefined;
  approvedAt?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  lines?: PurchaseOrderLineDto[] | undefined;
  goodsReceipts?: GoodsReceiptDto[] | undefined;
}

export interface CreatePurchaseOrderLineInput {
  productId: string;
  quantity: string;
  unitPrice: string;
  notes?: string | null | undefined;
}

export interface CreatePurchaseOrderInput {
  purchaseOrderNumber: string;
  supplierName: string;
  supplierEmail?: string | null | undefined;
  warehouseId: string;
  orderDate?: string | Date | undefined;
  expectedDate?: string | Date | null | undefined;
  currency?: string | undefined;
  notes?: string | null | undefined;
  lines: CreatePurchaseOrderLineInput[];
}

export interface UpdatePurchaseOrderInput {
  supplierName?: string | undefined;
  supplierEmail?: string | null | undefined;
  warehouseId?: string | undefined;
  orderDate?: string | Date | undefined;
  expectedDate?: string | Date | null | undefined;
  currency?: string | undefined;
  notes?: string | null | undefined;
  lines?: CreatePurchaseOrderLineInput[] | undefined;
}

export interface PurchaseOrderQueryParams extends PaginationParams {
  warehouseId?: string | undefined;
  status?: PurchaseOrderStatus | undefined;
  supplierName?: string | undefined;
  purchaseOrderNumber?: string | undefined;
  isOverdue?: boolean | undefined;
  receivingState?: 'OUTSTANDING' | 'RECEIVED' | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  sortBy?: AllowedPurchaseOrderSortField | undefined;
}

export interface GoodsReceiptLineDto {
  id: string;
  organizationId: string;
  goodsReceiptId: string;
  purchaseOrderLineId: string;
  productId: string;
  quantityReceived: string; // Exact 4-decimal representation (e.g. "10.0000")
  createdAt: string;
}

export interface GoodsReceiptDto {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  warehouseId: string;
  receiptNumber: string;
  idempotencyKey?: string | null | undefined;
  notes?: string | null | undefined;
  receivedById?: string | null | undefined;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  lines?: GoodsReceiptLineDto[] | undefined;
}

export interface ReceivePurchaseOrderItemInput {
  purchaseOrderLineId: string;
  quantity: string;
}

export interface ReceivePurchaseOrderInput {
  lines: ReceivePurchaseOrderItemInput[];
  notes?: string | null | undefined;
}

export interface ProcurementMetricsDto {
  totalOrders: number;
  statusCounts: Record<PurchaseOrderStatus, number>;
  totalOrderedQuantity: string;
  totalReceivedQuantity: string;
  totalOutstandingQuantity: string;
  pendingReceivingCount: number;
  overdueCount: number;
  recentlyReceivedCount: number;
}

export interface PurchaseOrderReconciliationLineDto {
  purchaseOrderLineId: string;
  productId: string;
  productName: string;
  productSku: string;
  orderedQuantity: string;
  receivedQuantity: string;
  remainingQuantity: string;
  goodsReceiptQuantity: string;
  ledgerDeltaQuantity: string;
  isLineReconciled: boolean;
}

export interface PurchaseOrderReconciliationDto {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: PurchaseOrderStatus;
  isReconciled: boolean;
  totalOrderedQuantity: string;
  totalReceivedQuantity: string;
  totalRemainingQuantity: string;
  totalGoodsReceiptQuantity: string;
  totalReceiptLedgerDelta: string;
  lines: PurchaseOrderReconciliationLineDto[];
  discrepancies: string[];
}

export interface PurchaseOrderAuditEventDto {
  id: string;
  action: string;
  entityId?: string | null | undefined;
  actorUserId?: string | null | undefined;
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
}
