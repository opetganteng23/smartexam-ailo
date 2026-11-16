import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Comment } from "@/models/Comment";
import { User } from "@/models/User";
import { COMMENT_MAX, cleanComment, displayName, isModerator, unitForDiscussion } from "@/lib/comments";

export const dynamic = "force-dynamic";

const limiter = new RateLimiterMemory({ points: 10, duration: 60 }); // 10 komentar per menit per akun
const input = z.object({ body: z.string().max(COMMENT_MAX * 2), parentId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional() });
const ROLES = ["participant", "admin", "academic_admin"] as const;

/** Diskusi sebuah unit: komentar teratas dan balasannya. Peserta hanya melihat komentar institusinya sendiri dan yang tidak disembunyikan. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole([...ROLES]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit not found");
    await connectDB();
    await unitForDiscussion(me, params.id);
    const mod = isModerator(me);
    const scope = mod ? {} : { $or: [{ institutionId: me.institutionId ?? null }, { staff: true }], hidden: { $ne: true } };
    const list = await Comment.find({ unitId: params.id, ...scope }).sort({ createdAt: 1 }).limit(300).lean();
    const users = new Map((await User.find({ _id: { $in: list.map((c) => c.userId) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      moderator: mod,
      comments: list.map((c) => ({
        id: String(c._id), parentId: c.parentId ? String(c.parentId) : null, body: c.body, at: c.createdAt, mine: String(c.userId) === String(me._id),
        author: String(c.userId) === String(me._id) ? "You" : c.staff ? "Moderator" : displayName(users.get(String(c.userId))), hidden: !!c.hidden, reports: mod ? (c.reports ?? []).length : undefined,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole([...ROLES]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit not found");
    const b = input.parse(await req.json());
    await connectDB();
    const { unit } = await unitForDiscussion(me, params.id);
    try { await limiter.consume(String(me._id)); } catch { throw new HttpError(429, "You are posting too fast. Please wait a minute."); }
    const body = cleanComment(b.body);
    if (!body) throw new HttpError(400, "Write something first");
    if (body.length > COMMENT_MAX) throw new HttpError(400, `Maximum ${COMMENT_MAX} characters`);
    let parentId;
    if (b.parentId) {
      const parent = await Comment.findOne({ _id: b.parentId, unitId: unit._id, hidden: { $ne: true } }).lean();
      // Balasan hanya satu tingkat, di unit yang sama, pada komentar yang terlihat penulisnya (institusi sama).
      if (!parent || parent.parentId || (!isModerator(me) && String(parent.institutionId ?? "") !== String(me.institutionId ?? ""))) throw new HttpError(404, "Comment not found");
      parentId = parent._id;
    }
    const c = await Comment.create({ unitId: unit._id, courseId: unit.courseId, userId: me._id, institutionId: me.institutionId ?? undefined, staff: isModerator(me), parentId, body });
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
