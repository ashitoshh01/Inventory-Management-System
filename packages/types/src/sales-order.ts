import { PaginationParams } from './domain.js';

export const SALES_ORDER_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'FULFILLED',
  'CANCELLED',
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUS_VALUES)[number];

export const ALLOWED_SALES_ORDER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'orderDate',
  'expectedDate',
  'salesOrderNumber',
  'status',
  'grandTotal',
] as const;

export type AllowedSalesOrderSortField = (typeof ALLOWED_SALES_ORDER_SORT_FIELDS)[number];

export interface SalesOrderLineDto {
  id: string;
  organizationId: string;
  salesOrderId: string;
  productId: string;
  quantity: string; // Exact 4-decimal representation (e.g. "10.0000")
  unitPrice: string; // Exact decimal representation (e.g. "25.5000")
  lineTotal: string; // Authoritative exact line total (e.g. "255.0000")
  notes?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderDto {
  id: string;
  organizationId: string;
  salesOrderNumber: string;
  customerId?: string | null | undefined;
  customerName: string;
  customerEmail?: string | null | undefined;
  status: SalesOrderStatus;
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
  fulfilledById?: string | null | undefined;
  fulfilledAt?: string | null | undefined;
  cancelledById?: string | null | undefined;
  cancelledAt?: string | null | undefined;
  cancellationReason?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  lines?: SalesOrderLineDto[] | undefined;
}

export interface CreateSalesOrderLineInput {
  productId: string;
  quantity: string;
  unitPrice: string;
  notes?: string | null | undefined;
}

export interface CreateSalesOrderInput {
  salesOrderNumber: string;
  customerId?: string | null | undefined;
  customerName: string;
  customerEmail?: string | null | undefined;
  warehouseId: string;
  orderDate?: string | Date | undefined;
  expectedDate?: string | Date | null | undefined;
  currency?: string | undefined;
  notes?: string | null | undefined;
  lines: CreateSalesOrderLineInput[];
}

export interface UpdateSalesOrderInput {
  customerId?: string | null | undefined;
  customerName?: string | undefined;
  customerEmail?: string | null | undefined;
  warehouseId?: string | undefined;
  orderDate?: string | Date | undefined;
  expectedDate?: string | Date | null | undefined;
  currency?: string | undefined;
  notes?: string | null | undefined;
  lines?: CreateSalesOrderLineInput[] | undefined;
}

export interface CancelSalesOrderInput {
  reason: string;
}

export interface SalesOrderQueryParams extends PaginationParams {
  warehouseId?: string | undefined;
  status?: SalesOrderStatus | undefined;
  customerId?: string | undefined;
  customerName?: string | undefined;
  salesOrderNumber?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
  sortBy?: AllowedSalesOrderSortField | undefined;
}

export interface SalesOrderMetricsDto {
  totalOrders: number;
  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  totalRevenue: string;
  todaySalesRevenue: string;
  fulfilledQuantity: string;
}

export interface SalesOrderAuditEventDto {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
}
