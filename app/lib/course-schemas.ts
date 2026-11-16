import { z } from "zod";
import { SECTION_KEY_RE } from "@/lib/exam-format";

const oid = z.string().regex(/^[0-9a-f]{24}$/);

export const courseInput = z.object({
  levelId: oid.nullable().optional(), // wajib hanya untuk track ITP (lihat refine di bawah)
  track: z.enum(["general", "itp"]).default("itp"),
  categoryId: oid.nullable().optional(),
  institutionIds: z.array(oid).max(200).default([]),
  classIds: z.array(oid).max(500).default([]),
  accessMode: z.enum(["assigned", "paid"]).default("assigned"),
  priceIdr: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
  archived: z.boolean().default(false),
  coverAssetId: oid.nullable().optional(),
  prerequisiteCourseIds: z.array(oid).max(10).default([]),
  secureMode: z.boolean().default(false),
  previewMode: z.boolean().default(false),
  part: z.string().regex(SECTION_KEY_RE).nullable().optional(),
  sectionTestId: oid.nullable().optional(),
  requireSectionTest: z.boolean().default(false),
}).refine((c) => c.track === "general" || !!c.levelId, { message: "Choose a level for a TOEFL ITP course", path: ["levelId"] })
  .transform((c) => (c.track === "general" ? { ...c, levelId: null } : c)); // course umum tidak terikat level (jaga query remedial dan progres berbasis level)

export const moduleInput = z.object({
  courseId: oid,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const unitInput = z.object({
  courseId: oid,
  moduleId: oid.nullable().optional(),
  unlockAfterDays: z.number().int().min(0).max(365).default(0),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  materialIds: z.array(oid).max(30).default([]),
  quizTestId: oid.nullable().optional(),
  active: z.boolean().default(true),
});

export const eventInput = z.object({
  kind: z.enum(["material", "unit"]),
  refId: oid,
  activeSec: z.number().min(0).max(60),
});
