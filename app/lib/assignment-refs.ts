import { HttpError } from "./rbac";
import { Course, Unit } from "@/models/Course";
import { Test } from "@/models/Test";

/** Validasi rujukan: course umum, unit milik course itu, dan tes umum (kind test). */
export async function checkAssignmentRefs(b: { courseId: string; unitId?: string | null; kind: string; testId?: string | null }) {
  if (!(await Course.exists({ _id: b.courseId, track: "general" }))) throw new HttpError(400, "Choose a general course");
  if (b.unitId && !(await Unit.exists({ _id: b.unitId, courseId: b.courseId }))) throw new HttpError(400, "The unit does not belong to this course");
  if (b.kind === "test") {
    const t = await Test.findById(b.testId).select("kind courseId").lean();
    if (!t || t.kind !== "general") throw new HttpError(400, "The test must be a general test");
    if (t.courseId && String(t.courseId) !== b.courseId) throw new HttpError(400, "That test belongs to another course");
  }
}

