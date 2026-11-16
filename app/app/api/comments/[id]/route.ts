import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Comment } from "@/models/Comment";
import { isModerator, unitForDiscussion } from "@/lib/comments";

const ROLES = ["participant", "admin", "academic_admin"] as const;
const moderate = z.object({ hidden: z.boolean(), reason: z.string().trim().max(200).optional() });

async function load(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Comment not found");
  await connectDB();
  const c = await Comment.findById(id);
  if (!c) throw new HttpError(404, "Comment not found");
  return c;
}

/** Sembunyikan atau tampilkan lagi sebuah komentar (moderasi). Hanya admin dan academic_admin. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole([...ROLES]);
    if (!isModerator(me)) throw new HttpError(403, "No access");
    const b = moderate.parse(await req.json());
    const c = await load(params.id);
    c.hidden = b.hidden; c.hiddenBy = b.hidden ? me._id : undefined; c.hiddenReason = b.hidden ? b.reason : undefined;
    if (!b.hidden) c.reports = [] as never; // ditinjau: laporan dihapus
    await c.save();
    await audit(me._id, b.hidden ? "comment.hide" : "comment.unhide", params.id, { reason: b.reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus komentar (beserta balasannya): penulisnya sendiri, atau moderator. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole([...ROLES]);
    const c = await load(params.id);
    if (!isModerator(me)) {
      if (String(c.userId) !== String(me._id)) throw new HttpError(404, "Comment not found");
      await unitForDiscussion(me, String(c.unitId)); // akses ke unitnya masih berlaku
    }
    await Comment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    await audit(me._id, isModerator(me) && String(c.userId) !== String(me._id) ? "comment.delete" : "comment.delete_own", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
