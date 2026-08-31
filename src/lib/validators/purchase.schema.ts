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
