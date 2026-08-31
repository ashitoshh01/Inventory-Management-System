import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  orderedQty: z.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  expectedDate: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;

export const receiveGoodsLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  newReceivedQty: z.number().int().min(0),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

export const receiveGoodsSchema = z.object({
  lines: z.array(receiveGoodsLineSchema),
});

export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;

export const returnGoodsLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  returnQty: z.number().int().min(0),
});

export const returnGoodsSchema = z.object({
  lines: z.array(returnGoodsLineSchema),
});

export type ReturnGoodsInput = z.infer<typeof returnGoodsSchema>;
