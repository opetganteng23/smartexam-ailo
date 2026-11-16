import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Comment } from "@/models/Comment";
import { User } from "@/models/User";
import { Unit } from "@/models/Course";

export const dynamic = "force-dynamic";

/** Antrean moderasi: `?filter=reported` (bawaan), `hidden`, atau `all`. 100 terbaru. */
export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const f = new URL(req.url).searchParams.get("filter") ?? "reported";
    const match = f === "all" ? {} : f === "hidden" ? { hidden: true } : { "reports.0": { $exists: true }, hidden: { $ne: true } };
    const list = await Comment.find(match).sort({ updatedAt: -1 }).limit(100).lean();
    const [users, units] = await Promise.all([
      User.find({ _id: { $in: list.map((c) => c.userId) } }).select("name email").lean(),
      Unit.find({ _id: { $in: list.map((c) => c.unitId) } }).select("title").lean(),
    ]);
    const u = new Map(users.map((x) => [String(x._id), x])), t = new Map(units.map((x) => [String(x._id), x.title]));
    return NextResponse.json({
      comments: list.map((c) => ({ id: String(c._id), body: c.body, at: c.createdAt, unit: t.get(String(c.unitId)) ?? "-", author: u.get(String(c.userId))?.name ?? u.get(String(c.userId))?.email ?? "-", hidden: !!c.hidden, reports: (c.reports ?? []).length, reason: c.hiddenReason ?? "" })),
    });
  } catch (e) {
    return handleError(e);
  }
}
