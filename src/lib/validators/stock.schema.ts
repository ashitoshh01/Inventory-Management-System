import { z } from 'zod';
import { StockMovementType } from '@prisma/client';

export const adjustStockSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().int(),
  reasonCode: z.enum(['DAMAGE', 'THEFT', 'COUNT_CORRECTION', 'OTHER']),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const transferStockSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  fromWarehouseId: z.string().min(1, 'Source Warehouse is required'),
  toWarehouseId: z.string().min(1, 'Destination Warehouse is required'),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;

export const stockCountSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  corrections: z.array(z.object({
    productId: z.string(),
    delta: z.number().int()
  }))
});

export type StockCountInput = z.infer<typeof stockCountSchema>;
