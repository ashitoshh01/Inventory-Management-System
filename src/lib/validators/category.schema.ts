import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  parentId: z.string().nullable().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
