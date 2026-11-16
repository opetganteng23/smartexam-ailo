import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
export const assignmentInput = z.object({
  courseId: oid,
  unitId: oid.nullable().optional(),
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(3000).optional(),
  kind: z.enum(["file", "test"]).default("file"),
  testId: oid.nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  allowLate: z.boolean().default(false),
  maxSubmissions: z.number().int().min(0).max(20).default(1),
  maxPoints: z.number().min(1).max(1000).default(100),
  active: z.boolean().default(true),
}).refine((a) => a.kind !== "test" || !!a.testId, { message: "Choose the test for this assignment", path: ["testId"] });

export const gradeInput = z.object({ points: z.number().min(0).max(1000), feedback: z.string().trim().max(2000).optional() });
