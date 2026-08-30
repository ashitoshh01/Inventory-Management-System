import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().min(2, "SKU must be at least 2 characters").max(50, "SKU must be less than 50 characters"),
  barcode: z.string().max(100, "Barcode must be less than 100 characters").nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  unit: z.string().min(1, "Unit is required"),
  costPrice: z.number().min(0, "Cost price cannot be negative"),
  salePrice: z.number().min(0, "Sale price cannot be negative"),
  reorderPoint: z.number().int().min(0, "Reorder point cannot be negative"),
  reorderQty: z.number().int().min(0, "Reorder quantity cannot be negative"),
  trackBatches: z.boolean().default(false),
  isActive: z.boolean().default(true),
  images: z.array(z.object({
    id: z.string().optional(),
    url: z.string(),
    isPrimary: z.boolean().default(false)
  })).optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    sku: z.string().min(2, "Variant SKU must be at least 2 characters"),
    attributes: z.record(z.string(), z.string())
  })).optional(),
  isBundle: z.boolean().default(false),
  bundleItems: z.array(z.object({
    componentId: z.string(),
    quantity: z.number().int().min(1, "Quantity must be at least 1")
  })).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
