import { PurchaseOrderStatus, PurchaseOrderDto, PurchaseOrderLineDto } from '@repo/types';

export interface InternalCreatePurchaseOrderLine {
  productId: string;
  quantity: string;
  unitPrice: string;
  notes?: string | null | undefined;
}

export interface InternalCreatePurchaseOrder {
  purchaseOrderNumber: string;
  supplierName: string;
  supplierEmail?: string | null | undefined;
  warehouseId: string;
  orderDate?: Date | string | undefined;
  expectedDate?: Date | string | null | undefined;
  currency?: string | undefined;
  notes?: string | null | undefined;
  idempotencyKey?: string | undefined;
  idempotencyPayloadHash?: string | undefined;
  lines: InternalCreatePurchaseOrderLine[];
}

export interface PurchaseOrderFilter {
  warehouseId?: string | undefined;
  status?: PurchaseOrderStatus | undefined;
  supplierName?: string | undefined;
}

export interface PurchaseOrderLineCalculation {
  productId: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  notes?: string | null | undefined;
}

export interface PurchaseOrderTotalsCalculation {
  lines: PurchaseOrderLineCalculation[];
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
}

export interface PurchaseOrderWithLines extends PurchaseOrderDto {
  lines: PurchaseOrderLineDto[];
}
