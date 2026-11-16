import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
export const collectionInput = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: oid.nullable().optional(),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(["private", "institution", "global"]).default("private"),
  institutionId: oid.nullable().optional(),
}).refine((c) => c.visibility !== "institution" || !!c.institutionId, { message: "Choose the institution that can see this collection", path: ["institutionId"] });
