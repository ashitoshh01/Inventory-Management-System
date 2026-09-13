/**
 * Authoritative Reports DTO Contracts
 */

export interface StockMovementReportItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  type: string; // OPENING, RECEIPT, ISSUE, ADJUSTMENT
  quantityDelta: string;
  quantityBefore: string;
  quantityAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface StockMovementReportSummaryDto {
  totalMovements: number;
  totalIn: string;
  totalOut: string;
  netChange: string;
}

export interface StockMovementReportResponseDto {
  items: StockMovementReportItemDto[];
  summary: StockMovementReportSummaryDto;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryValuationItemDto {
  productId: string;
  productName: string;
  productSku: string;
  categoryName: string;
  unitOfMeasure: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: string;
  unitCost: string;
  unitPrice: string;
  totalCostValue: string;
  totalRetailValue: string;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface InventoryValuationSummaryDto {
  totalItems: number;
  totalQuantity: string;
  totalCostValue: string;
  totalRetailValue: string;
}

export interface InventoryValuationReportResponseDto {
  items: InventoryValuationItemDto[];
  summary: InventoryValuationSummaryDto;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReconciliationItemDto {
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  currentBalance: string;
  ledgerDeltaSum: string;
  discrepancy: string;
  status: 'MATCH' | 'DISCREPANCY';
  lastMovementAt: string | null;
  ledgerEntriesCount: number;
}

export interface ReconciliationSummaryDto {
  totalBuckets: number;
  totalMatches: number;
  totalDiscrepancies: number;
}

export interface ReconciliationReportResponseDto {
  items: ReconciliationItemDto[];
  summary: ReconciliationSummaryDto;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProcurementReportItemDto {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  grandTotal: string;
  currency: string;
  linesCount: number;
}

export interface ProcurementSummaryDto {
  totalOrders: number;
  totalValue: string;
  receivedCount: number;
  pendingCount: number;
}

export interface ProcurementReportResponseDto {
  items: ProcurementReportItemDto[];
  summary: ProcurementSummaryDto;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalesReportItemDto {
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  orderDate: string;
  grandTotal: string;
  currency: string;
  linesCount: number;
}

export interface SalesSummaryDto {
  totalOrders: number;
  totalRevenue: string;
  fulfilledOrders: number;
  pendingOrders: number;
}

export interface SalesReportResponseDto {
  items: SalesReportItemDto[];
  summary: SalesSummaryDto;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportQueryParams {
  warehouseId?: string | undefined;
  productId?: string | undefined;
  categoryId?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  discrepancyOnly?: boolean | string | undefined;
  search?: string | undefined;
  page?: number | string | undefined;
  limit?: number | string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC' | undefined;
}
