import { PaginationParams } from './domain.js';
import { ProductDto } from './product.js';
import { WarehouseDto } from './warehouse.js';

export const STOCK_TRANSFER_STATUS_VALUES = [
  'DRAFT',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED',
] as const;

export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUS_VALUES)[number];

export const ALLOWED_STOCK_TRANSFER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'transferNumber',
  'status',
] as const;

export type AllowedStockTransferSortField = (typeof ALLOWED_STOCK_TRANSFER_SORT_FIELDS)[number];

export interface StockTransferLineDto {
  id: string;
  organizationId: string;
  transferId: string;
  productId: string;
  quantity: string; // Exact 4-decimal representation (e.g. "10.0000")
  notes?: string | null | undefined;
  product?: ProductDto | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferDto {
  id: string;
  organizationId: string;
  transferNumber: string;
  status: StockTransferStatus;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  notes?: string | null | undefined;
  createdById?: string | null | undefined;
  approvedById?: string | null | undefined;
  approvedAt?: string | null | undefined;
  shippedById?: string | null | undefined;
  shippedAt?: string | null | undefined;
  receivedById?: string | null | undefined;
  receivedAt?: string | null | undefined;
  cancelledById?: string | null | undefined;
  cancelledAt?: string | null | undefined;
  sourceWarehouse?: WarehouseDto | undefined;
  destinationWarehouse?: WarehouseDto | undefined;
  lines?: StockTransferLineDto[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockTransferLineInput {
  productId: string;
  quantity: string;
  notes?: string | null | undefined;
}

export interface CreateStockTransferInput {
  transferNumber?: string | undefined;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  notes?: string | null | undefined;
  lines: CreateStockTransferLineInput[];
}

export interface UpdateStockTransferInput {
  sourceWarehouseId?: string | undefined;
  destinationWarehouseId?: string | undefined;
  notes?: string | null | undefined;
  lines?: CreateStockTransferLineInput[] | undefined;
}

export interface StockTransferQueryParams extends PaginationParams {
  sourceWarehouseId?: string | undefined;
  destinationWarehouseId?: string | undefined;
  warehouseId?: string | undefined;
  status?: StockTransferStatus | undefined;
  transferNumber?: string | undefined;
  search?: string | undefined;
}

export interface StockTransferMetricsDto {
  totalCount: number;
  draftCount: number;
  approvedCount: number;
  inTransitCount: number;
  receivedCount: number;
  cancelledCount: number;
  statusCounts: Record<StockTransferStatus, number>;
}

export interface StockTransferAuditEventDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
  createdAt: string;
  user?:
    | {
        id: string;
        email?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
      }
    | null
    | undefined;
}
