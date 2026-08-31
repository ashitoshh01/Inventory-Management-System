import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  leadTimeDays: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
