import { z } from "zod";

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const categoryKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
