import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Comment } from "@/models/Comment";
import { unitForDiscussion } from "@/lib/comments";

/** Laporkan komentar ke moderator. Satu laporan per peserta; komentar sendiri tidak bisa dilaporkan. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "admin", "academic_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Comment not found");
    await connectDB();
    const c = await Comment.findOne({ _id: params.id, hidden: { $ne: true } }).lean();
    if (!c || (me.role === "participant" && String(c.institutionId ?? "") !== String(me.institutionId ?? ""))) throw new HttpError(404, "Comment not found");
    await unitForDiscussion(me, String(c.unitId));
    if (String(c.userId) === String(me._id)) throw new HttpError(400, "You cannot report your own comment");
    await Comment.updateOne({ _id: c._id, "reports.userId": { $ne: me._id } }, { $push: { reports: { userId: me._id, at: new Date() } } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
