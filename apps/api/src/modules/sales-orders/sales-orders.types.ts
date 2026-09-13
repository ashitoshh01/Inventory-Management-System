import { SalesOrderDto, SalesOrderStatus } from '@repo/types';

export interface SalesOrderMutationResult {
  order: SalesOrderDto;
  isIdempotentReplay: boolean;
}

export interface SalesOrderFulfillmentResult {
  order: SalesOrderDto;
  isIdempotentReplay: boolean;
}

export interface ValidatedSalesOrderLineItem {
  productId: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  notes?: string | null | undefined;
}

export interface ValidatedSalesOrderData {
  salesOrderNumber: string;
  customerId?: string | null | undefined;
  customerName: string;
  customerEmail?: string | null | undefined;
  warehouseId: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  notes?: string | null | undefined;
  orderDate: Date;
  expectedDate?: Date | null | undefined;
  lines: ValidatedSalesOrderLineItem[];
}
