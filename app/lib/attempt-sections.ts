import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { drawQuestions } from "./draw";
import { Question } from "@/models/Question";

type Draw = { collectionId?: Types.ObjectId | string | null; count?: number | null; topics?: string[] | null; difficulties?: string[] | null } | null;
export type SectionLike = { name: string; durationSec: number; questionIds: Types.ObjectId[]; draw?: Draw };

/** Jumlah soal sebuah bagian: soal tetap, atau jumlah yang ditarik dari koleksi. */
export const sectionSize = (s: { questionIds: unknown[]; draw?: Draw }) => (s.draw?.collectionId ? s.draw.count ?? 0 : s.questionIds.length);
export const testSize = (t: { sections: { questionIds: unknown[]; draw?: Draw }[] }) => t.sections.reduce((n, s) => n + sectionSize(s), 0);
export const hasDraw = (t: { sections: { draw?: Draw }[] }) => t.sections.some((s) => !!s.draw?.collectionId);

/**
 * Tarik soal acak untuk SATU percobaan (bagian bertanda `draw`). Soal dipilih dari soal terbit di koleksi, sesuai topik dan
 * kesulitan, tanpa mengulang soal yang sama di bagian lain pada percobaan ini. Benih = id percobaan, jadi hasilnya tetap bila
 * dihitung ulang. Kandidat kurang dari jumlah yang diminta: semua dipakai; kosong sama sekali: percobaan tidak dimulai.
 */
export async function drawSections(test: { sections: SectionLike[] }, seed: string) {
  const used = new Set<string>();
  const out: { name: string; durationSec: number; questionIds: Types.ObjectId[] }[] = [];
  for (const [i, s] of test.sections.entries()) {
    if (!s.draw?.collectionId) { out.push({ name: s.name, durationSec: s.durationSec, questionIds: s.questionIds }); s.questionIds.forEach((q) => used.add(String(q))); continue; }
    const cands = (await Question.find({ collectionId: s.draw.collectionId, status: "published" }).select("_id groupId difficulty tags").lean()).filter((q) => !used.has(String(q._id)));
    const { picked } = drawQuestions(cands, { count: s.draw.count ?? 0, topics: s.draw.topics ?? [], difficulties: (s.draw.difficulties ?? []) as never }, `${seed}:draw:${i}`);
    if (!picked.length) throw new HttpError(409, `This test cannot start yet: the question collection for "${s.name}" has no matching published questions.`);
    picked.forEach((q) => used.add(String(q._id)));
    out.push({ name: s.name, durationSec: s.durationSec, questionIds: picked.map((q) => q._id as Types.ObjectId) });
  }
  return out;
}

/** Tes dengan soal yang ditarik untuk percobaan ini; tes tanpa penarikan dikembalikan apa adanya. */
export function withAttemptSections<T extends { sections: object[] }>(test: T, attempt: { sections?: { questionIds: unknown[] }[] | null }): T {
  if (!attempt.sections?.length) return test;
  return { ...test, sections: test.sections.map((s, i) => ({ ...s, questionIds: attempt.sections![i]?.questionIds ?? (s as { questionIds: unknown[] }).questionIds, draw: undefined })) };
}
