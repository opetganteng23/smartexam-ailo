import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Attempt, AttemptSnapshot, Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { User } from "@/models/User";
import { computeItemStats, type StatAttempt } from "@/lib/item-stats";
import { htmlToText } from "@/lib/html-text";
import { withAttemptSections } from "@/lib/attempt-sections";

export const dynamic = "force-dynamic";

/**
 * Statistik butir soal sebuah tes: kesulitan nyata (p), daya beda, jumlah pemakaian, sebaran pilihan, dan penanda mutu.
 * Dari percobaan selesai peserta sungguhan (admin dan QA tester dikecualikan). Memakai snapshot soal saat tes dikerjakan,
 * jadi tetap benar walau soal di bank diubah kemudian, dan untuk tes dengan soal acak per percobaan.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const test = await Test.findById(params.id).select("name sections kind").lean();
    if (!test) throw new HttpError(404, "Test not found");
    const staff = await User.find({ $or: [{ role: { $ne: "participant" } }, { qaTester: true }] }).select("_id").lean();
    const attempts = await Attempt.find({ testId: test._id, status: "submitted", userId: { $nin: staff.map((u) => u._id) } }).select("answers sections").limit(5000).lean();
    const snaps = new Map((await AttemptSnapshot.find({ attemptId: { $in: attempts.map((a) => a._id) } }).lean()).map((s) => [String(s.attemptId), s]));
    // Percobaan tanpa snapshot (lama): pakai soal yang ada sekarang.
    const live = new Map((await Question.find({ _id: { $in: test.sections.flatMap((s) => s.questionIds) } }).select("section kind points answerKey key stem stemFormat difficulty options").lean()).map((q) => [String(q._id), q]));
    const fromLive = (q: NonNullable<ReturnType<typeof live.get>>) => ({ qid: String(q._id), section: q.section, kind: q.kind, points: q.points, answerKey: q.answerKey, key: q.key, stem: q.stemFormat === "html" ? htmlToText(q.stem) : q.stem, declared: q.difficulty, options: q.options?.length });
    const input: StatAttempt[] = attempts.map((a) => {
      const snap = snaps.get(String(a._id));
      const items = snap?.items?.length
        ? snap.items.map((i) => ({ qid: String(i.qid), section: i.section, kind: i.kind, points: i.points, answerKey: i.answerKey, key: i.key, stem: i.stemFormat === "html" ? htmlToText(i.stem ?? "") : i.stem ?? "", declared: live.get(String(i.qid))?.difficulty ?? null, options: i.options?.length }))
        : withAttemptSections(test, a).sections.flatMap((s) => s.questionIds).map((id) => live.get(String(id))).filter((q): q is NonNullable<typeof q> => !!q).map(fromLive);
      return { items, answers: (a.answers ?? []).map((x) => ({ qid: String(x.qid), choice: x.choice, response: x.response, points: x.points })) };
    });
    const r = computeItemStats(input);
    return NextResponse.json({ test: { id: String(test._id), name: test.name }, attempts: r.attempts, rows: r.rows.map((x) => ({ ...x, stem: x.stem.slice(0, 200) })) });
  } catch (e) {
    return handleError(e);
  }
}
