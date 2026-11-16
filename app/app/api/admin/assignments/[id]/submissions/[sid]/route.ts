import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Assignment, Submission } from "@/models/Assignment";
import { gradeInput } from "@/lib/assignment-schemas";

/** Nilai satu kiriman: poin 0 sampai poin penuh tugas, dan umpan balik opsional. */
export async function PATCH(req: Request, { params }: { params: { id: string; sid: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id) || !isValidObjectId(params.sid)) throw new HttpError(404, "Submission not found");
    const b = gradeInput.parse(await req.json());
    await connectDB();
    const a = await Assignment.findById(params.id).select("maxPoints").lean();
    const s = a ? await Submission.findOne({ _id: params.sid, assignmentId: a._id }) : null;
    if (!a || !s) throw new HttpError(404, "Submission not found");
    if (b.points > a.maxPoints) throw new HttpError(400, `Points cannot exceed ${a.maxPoints}`);
    s.set({ points: Math.round(b.points * 100) / 100, feedback: b.feedback || undefined, status: "graded", gradedBy: admin._id, gradedAt: new Date() });
    await s.save();
    await audit(admin._id, "assignment.grade", params.sid, { points: s.points });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
