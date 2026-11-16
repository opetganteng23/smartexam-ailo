import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Test, Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { buildPrePost, type AttemptLite } from "@/lib/prepost";

export const dynamic = "force-dynamic";

/**
 * Laporan selisih pre/post untuk sebuah post-test: pasangannya adalah pre-test yang ditunjuk `pairedTestId`
 * (atau `?pre=<id>`). Per peserta dan per topik, memakai percobaan terbaik masing-masing; peserta uji (admin, QA tester) dikecualikan.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const post = await Test.findById(params.id).select("name kind purpose pairedTestId").lean();
    if (!post || post.kind !== "general") throw new HttpError(404, "Test not found");
    const preParam = new URL(req.url).searchParams.get("pre");
    if (preParam && !isValidObjectId(preParam)) throw new HttpError(400, "Invalid pre-test");
    const preId = preParam ?? (post.pairedTestId ? String(post.pairedTestId) : null);
    if (!preId) throw new HttpError(400, "This test has no paired pre-test. Choose one in the test settings.");
    const pre = await Test.findOne({ _id: preId, kind: "general" }).select("name purpose").lean();
    if (!pre) throw new HttpError(404, "Pre-test not found");

    const staff = await User.find({ $or: [{ role: { $ne: "participant" } }, { qaTester: true }] }).select("_id").lean();
    const base = { status: "submitted" as const, userId: { $nin: staff.map((u) => u._id) } };
    const pick = "userId scoreEst topicScores finishedAt";
    const [a, b] = await Promise.all([Attempt.find({ ...base, testId: pre._id }).select(pick).lean(), Attempt.find({ ...base, testId: post._id }).select(pick).lean()]);
    const lite = (x: typeof a[number]): AttemptLite => ({ userId: String(x.userId), scoreEst: x.scoreEst, topicScores: x.topicScores, finishedAt: x.finishedAt });
    const report = buildPrePost(a.map(lite), b.map(lite));

    const users = await User.find({ _id: { $in: report.rows.map((r) => r.userId) } }).select("name email institutionId").lean();
    const insts = new Map((await Institution.find({ _id: { $in: users.map((u) => u.institutionId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name").lean()).map((i) => [String(i._id), i.name]));
    const by = new Map(users.map((u) => [String(u._id), u]));
    return NextResponse.json({
      pre: { id: String(pre._id), name: pre.name }, post: { id: String(post._id), name: post.name },
      summary: report.summary, topics: report.topics,
      rows: report.rows.map((r) => { const u = by.get(r.userId); return { ...r, name: u?.name ?? null, email: u?.email ?? "", institution: u?.institutionId ? insts.get(String(u.institutionId)) ?? null : null }; })
        .sort((x, y) => (y.delta ?? -999) - (x.delta ?? -999)),
    });
  } catch (e) {
    return handleError(e);
  }
}
