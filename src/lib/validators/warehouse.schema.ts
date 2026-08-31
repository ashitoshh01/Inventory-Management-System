import { z } from 'zod';

export const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;
