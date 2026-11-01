import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { Attempt, Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { ScoringProfile } from "@/models/Scoring";
import { scoreAttempt, releaseDueResults } from "./attempts";
import { profileForTest } from "./scoring-profiles";
import { kindOf, type EssayKey } from "./question-kinds";
import { essayMax } from "./grading";

// Penilaian essay oleh manusia. Hasil tes ditahan (gradingStatus "pending") sampai semua essay yang dijawab sudah bernilai;
// setelah itu skor dihitung ulang dan hasil dirilis lewat jalur rilis yang sama dengan penahanan lain.

/** Simpan nilai satu essay. Nilai harus 0..poin soal. */
export async function saveEssayGrade(o: { attemptId: string; qid: string; points: number; feedback?: string; graderId: unknown }) {
  await connectDB();
  const attempt = await Attempt.findById(o.attemptId);
  if (!attempt || attempt.status !== "submitted") throw new HttpError(404, "Attempt not found");
  if (attempt.gradingStatus !== "pending") throw new HttpError(409, "This attempt has no essays waiting for a grade");
  const ans = attempt.answers.find((a) => String(a.qid) === o.qid);
  const q = await Question.findById(o.qid).select("kind points key").lean();
  if (!ans || !q || kindOf(q) !== "essay") throw new HttpError(404, "Essay answer not found");
  const max = essayMax(q);
  if (!Number.isFinite(o.points) || o.points < 0 || o.points > max) throw new HttpError(400, `Points must be between 0 and ${max}`);
  ans.points = Math.round(o.points * 100) / 100;
  ans.feedback = o.feedback?.trim().slice(0, 2000) || undefined;
  ans.gradedBy = o.graderId as never;
  ans.gradedAt = new Date();
  await attempt.save();
  return recompute(o.attemptId);
}

/** Hitung ulang skor dari jawaban dan nilai saat ini. Bila semua essay sudah bernilai, hasil dirilis. */
export async function recompute(attemptId: string) {
  await connectDB();
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || attempt.status !== "submitted") throw new HttpError(404, "Attempt not found");
  const test = await Test.findById(attempt.testId);
  if (!test) throw new HttpError(404, "Test not found");
  const prof = (attempt.scoringProfileId && (await ScoringProfile.findById(attempt.scoringProfileId))) || (await profileForTest(test as never)); // profil yang sama dengan saat submit
  const { graded, topicScores, pending } = await scoreAttempt(attempt as never, test as never, prof);
  attempt.set({ ...graded, topicScores, essayPending: pending });
  if (pending === 0) attempt.set({ gradingStatus: "done", releaseAt: new Date() });
  await attempt.save();
  if (pending === 0) void releaseDueResults(50).catch((e) => console.error("[essay-grading] release", e));
  return { pending, done: pending === 0, scoreEst: attempt.scoreEst ?? null };
}

/** Essay yang dijawab pada percobaan ini beserta rubriknya, untuk halaman Grading. Tanpa identitas peserta. */
export async function essaysForGrading(attemptId: string) {
  await connectDB();
  const attempt = await Attempt.findById(attemptId).lean();
  if (!attempt || attempt.status !== "submitted") throw new HttpError(404, "Attempt not found");
  const qs = await Question.find({ _id: { $in: attempt.answers.map((a) => a.qid) as never[] }, kind: "essay" }).select("stem points key").lean();
  const byId = new Map(qs.map((q) => [String(q._id), q]));
  const items = attempt.answers
    .filter((a) => byId.has(String(a.qid)) && typeof a.response === "string" && a.response.trim())
    .map((a) => {
      const q = byId.get(String(a.qid))!, key = (q.key ?? {}) as EssayKey;
      return {
        qid: String(a.qid), stem: q.stem, rubric: key.rubric ?? [], guide: key.guide ?? null, max: essayMax(q), maxWords: key.maxWords ?? null,
        answer: a.response as string, points: a.points ?? null, feedback: a.feedback ?? null, gradedAt: a.gradedAt ?? null,
        aiDraft: a.aiDraft?.points != null ? { points: a.aiDraft.points, rationale: a.aiDraft.rationale ?? "" } : null,
      };
    });
  return { attemptId, status: attempt.gradingStatus ?? "none", pending: attempt.essayPending ?? 0, items };
}
