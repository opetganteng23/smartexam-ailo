import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Assignment, Submission } from "@/models/Assignment";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

/** Kiriman sebuah tugas untuk dinilai (terbaru dulu). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Assignment not found");
    await connectDB();
    const a = await Assignment.findById(params.id).select("title maxPoints").lean();
    if (!a) throw new HttpError(404, "Assignment not found");
    const list = await Submission.find({ assignmentId: a._id }).sort({ createdAt: -1 }).limit(500).lean();
    const users = new Map((await User.find({ _id: { $in: list.map((s) => s.userId) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    const insts = new Map((await Institution.find({ _id: { $in: list.map((s) => s.institutionId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name").lean()).map((i) => [String(i._id), i.name]));
    return NextResponse.json({
      assignment: { id: String(a._id), title: a.title, maxPoints: a.maxPoints },
      submissions: list.map((s) => ({
        id: String(s._id), attemptNo: s.attemptNo, name: users.get(String(s.userId))?.name ?? null, email: users.get(String(s.userId))?.email ?? "", institution: s.institutionId ? insts.get(String(s.institutionId)) ?? null : null,
        text: s.text ?? "", file: s.file?.gridFsId ? { name: s.file.name, size: s.file.size, url: `/api/assignments/${a._id}/submissions/${s._id}/file` } : null,
        at: s.createdAt, late: !!s.late, status: s.status, points: s.points ?? null, feedback: s.feedback ?? "",
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
