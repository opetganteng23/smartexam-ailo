import { NextResponse } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Assignment, Submission } from "@/models/Assignment";
import { assignmentInput } from "@/lib/assignment-schemas";
import { checkAssignmentRefs } from "@/lib/assignment-refs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const courseId = new URL(req.url).searchParams.get("courseId");
    if (courseId && !/^[0-9a-f]{24}$/.test(courseId)) throw new HttpError(400, "Invalid course");
    const list = await Assignment.find(courseId ? { courseId } : {}).sort({ createdAt: -1 }).limit(300).lean();
    const counts = await Submission.aggregate<{ _id: unknown; n: number; ungraded: number }>([
      { $match: { assignmentId: { $in: list.map((a) => a._id) } } },
      { $group: { _id: "$assignmentId", n: { $sum: 1 }, ungraded: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } } } },
    ]);
    const n = new Map(counts.map((c) => [String(c._id), c]));
    return NextResponse.json({
      assignments: list.map((a) => ({
        id: String(a._id), courseId: String(a.courseId), unitId: a.unitId ? String(a.unitId) : null, title: a.title, instructions: a.instructions ?? "", kind: a.kind, testId: a.testId ? String(a.testId) : null,
        dueAt: a.dueAt ?? null, allowLate: !!a.allowLate, maxSubmissions: a.maxSubmissions, maxPoints: a.maxPoints, active: a.active, submissions: n.get(String(a._id))?.n ?? 0, ungraded: n.get(String(a._id))?.ungraded ?? 0,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = assignmentInput.parse(await req.json());
    await connectDB();
    await checkAssignmentRefs(b);
    const a = await Assignment.create({ ...b, unitId: b.unitId ?? undefined, testId: b.kind === "test" ? b.testId ?? undefined : undefined, dueAt: b.dueAt ?? undefined, createdBy: admin._id });
    await audit(admin._id, "assignment.create", String(a._id));
    return NextResponse.json({ id: String(a._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
