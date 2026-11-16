import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Assignment, Submission } from "@/models/Assignment";
import { Attempt, Test } from "@/models/Test";
import { courseForAssignments } from "@/lib/assignment-store";

export const dynamic = "force-dynamic";

/** Tugas sebuah course umum beserta kiriman milik peserta sendiri. Course di luar akses peserta dijawab 404. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "admin", "academic_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    await connectDB();
    await courseForAssignments(me, params.id);
    const list = await Assignment.find({ courseId: params.id, active: true }).sort({ dueAt: 1, createdAt: 1 }).lean();
    const [subs, tests] = await Promise.all([
      Submission.find({ userId: me._id, assignmentId: { $in: list.map((a) => a._id) } }).sort({ attemptNo: 1 }).lean(),
      Test.find({ _id: { $in: list.map((a) => a.testId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name").lean(),
    ]);
    const best = await Attempt.find({ userId: me._id, testId: { $in: tests.map((t) => t._id) }, status: "submitted", scoreEst: { $ne: null } }).select("testId scoreEst releaseAt").lean();
    const now = new Date();
    return NextResponse.json({
      assignments: list.map((a) => {
        const mine = subs.filter((s) => String(s.assignmentId) === String(a._id));
        const closed = !!a.dueAt && a.dueAt < now && !a.allowLate;
        const full = a.maxSubmissions > 0 && mine.length >= a.maxSubmissions;
        const test = a.testId ? tests.find((t) => String(t._id) === String(a.testId)) : null;
        const scores = best.filter((b) => String(b.testId) === String(a.testId) && (!b.releaseAt || b.releaseAt <= now)).map((b) => b.scoreEst as number);
        return {
          id: String(a._id), title: a.title, instructions: a.instructions ?? "", kind: a.kind, dueAt: a.dueAt ?? null, allowLate: !!a.allowLate, maxPoints: a.maxPoints, maxSubmissions: a.maxSubmissions,
          canSubmit: a.kind === "file" && !closed && !full, reason: a.kind !== "file" ? null : closed ? "The deadline has passed." : full ? "You have used all your submissions." : null,
          test: test ? { id: String(test._id), name: test.name, best: scores.length ? Math.max(...scores) : null } : null,
          submissions: mine.map((s) => ({
            id: String(s._id), attemptNo: s.attemptNo, at: s.createdAt, late: !!s.late, text: s.text ?? "", file: s.file?.gridFsId ? { name: s.file.name, size: s.file.size, url: `/api/assignments/${a._id}/submissions/${s._id}/file` } : null,
            status: s.status, points: s.status === "graded" ? s.points ?? null : null, feedback: s.status === "graded" ? s.feedback ?? "" : "",
          })),
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
