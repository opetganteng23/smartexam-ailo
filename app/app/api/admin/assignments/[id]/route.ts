import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Assignment, Submission } from "@/models/Assignment";
import { assignmentInput } from "@/lib/assignment-schemas";
import { checkAssignmentRefs } from "@/lib/assignment-refs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Assignment not found");
    const b = assignmentInput.parse(await req.json());
    await connectDB();
    const a = await Assignment.findById(params.id);
    if (!a) throw new HttpError(404, "Assignment not found");
    if (String(a.courseId) !== b.courseId && (await Submission.exists({ assignmentId: a._id }))) throw new HttpError(409, "This assignment already has submissions. Its course cannot change.");
    await checkAssignmentRefs(b);
    a.set({ ...b, unitId: b.unitId ?? undefined, testId: b.kind === "test" ? b.testId ?? undefined : undefined, dueAt: b.dueAt ?? undefined });
    await a.save();
    await audit(admin._id, "assignment.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Tugas yang sudah menerima kiriman tidak dihapus (nilai dan berkas peserta tetap tersimpan); nonaktifkan saja. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Assignment not found");
    await connectDB();
    if (await Submission.exists({ assignmentId: params.id })) throw new HttpError(409, "This assignment has submissions. Deactivate it instead of deleting it.");
    const r = await Assignment.deleteOne({ _id: params.id });
    if (!r.deletedCount) throw new HttpError(404, "Assignment not found");
    await audit(admin._id, "assignment.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
