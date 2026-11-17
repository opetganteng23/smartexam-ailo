import { HttpError } from "./rbac";
import { Question } from "@/models/Question";
import { questionVisibleFilter, collectionVisible } from "./collections";
import { QuestionCollection } from "@/models/Question";
import { Course } from "@/models/Course";
import { Category } from "@/models/Category";
import { Test } from "@/models/Test";
import { drawQuestions } from "./draw";

type Draw = { collectionId: string; count: number; topics?: string[]; difficulties?: string[] } | null;
type Sec = { name: string; questionIds: string[]; draw?: Draw };

/** Semua soal harus ada, berstatus published, sesuai section, dan tidak dipakai dua kali dalam satu tes. */
export type BankCtx = { kind?: string; bankId?: string | null; extraBankIds?: string[] };
export async function validateTestQuestions(sections: Sec[], user: Parameters<typeof questionVisibleFilter>[0], ctx: BankCtx = {}) {
  // Bank tes (umum): harus terlihat. Soal manual hanya dari bank itu dan bank lain yang sengaja dipilih.
  const allowed = ctx.bankId ? [ctx.bankId, ...(ctx.extraBankIds ?? [])] : null;
  if (allowed) {
    const seen = await QuestionCollection.countDocuments({ _id: { $in: allowed }, ...collectionVisible(user) });
    if (seen !== new Set(allowed).size) throw new HttpError(400, "A selected question bank was not found");
  }
  // Bagian dengan penarikan acak: koleksi harus terlihat dan punya cukup soal terbit yang cocok (jumlah diminta tidak boleh melebihi isi).
  for (const s of sections.filter((x) => x.draw)) {
    const d = s.draw!;
    const col = await QuestionCollection.findOne({ _id: d.collectionId, ...collectionVisible(user) }).select("name").lean();
    if (!col) throw new HttpError(400, `The collection for "${s.name}" was not found`);
    const pool = await Question.find({ collectionId: d.collectionId, status: "published" }).select("_id groupId difficulty tags").lean();
    const { picked } = drawQuestions(pool, { count: d.count, topics: d.topics, difficulties: d.difficulties as never }, "validate");
    // Soal satu passage atau audio ditarik sebagai satu blok, jadi yang diuji adalah penarikan sebenarnya.
    if (picked.length < d.count) throw new HttpError(400, `Collection "${col.name}" can supply only ${picked.length} matching published question${picked.length === 1 ? "" : "s"} for "${s.name}" (questions that share a passage or audio are drawn together), but ${d.count} are requested.`);
  }
  const all = sections.flatMap((s) => s.questionIds);
  if (new Set(all).size !== all.length) throw new HttpError(400, "A question is used more than once");
  const vis = await questionVisibleFilter(user);
  const qs = await Question.find(Object.keys(vis).length ? { $and: [{ _id: { $in: all } }, vis] } : { _id: { $in: all } }).select("section status collectionId").lean();
  const by = new Map(qs.map((q) => [String(q._id), q]));
  for (const s of sections.filter((x) => !x.draw)) {
    for (const id of s.questionIds) {
      const q = by.get(id);
      if (!q) throw new HttpError(400, "Some questions were not found");
      if (q.status !== "published") throw new HttpError(400, "Only published questions can be added to a test");
      // Tes umum dengan bank: nama bagian hanya label (soal dibatasi lewat bank). Tanpa bank, dan untuk tes ITP/lainnya, nama bagian tetap harus sama dengan section soal.
      if ((ctx.kind !== "general" || !allowed) && q.section !== s.name) throw new HttpError(400, `A ${q.section} question cannot be added to the ${s.name} section`);
      if (allowed && !allowed.includes(String(q.collectionId ?? ""))) throw new HttpError(400, "Some questions are not in the selected question bank. Allow another bank explicitly to use them.");
    }
  }
}

/** Rujukan tes umum: course, kategori, dan pre-test pasangan harus ada dan sesuai. */
export async function validateGeneralRefs(t: { kind: string; courseId?: string | null; categoryId?: string | null; pairedTestId?: string | null; purpose?: string | null }, selfId?: string) {
  if (t.courseId && !(await Course.exists({ _id: t.courseId }))) throw new HttpError(400, "Course not found");
  if (t.categoryId && !(await Category.exists({ _id: t.categoryId }))) throw new HttpError(400, "Category not found");
  if (t.pairedTestId) {
    if (t.purpose !== "posttest") throw new HttpError(400, "Only a post-test can point to a pre-test");
    if (selfId && t.pairedTestId === selfId) throw new HttpError(400, "A test cannot be paired with itself");
    const pre = await Test.findById(t.pairedTestId).select("kind purpose").lean();
    if (!pre || pre.kind !== "general" || pre.purpose !== "pretest") throw new HttpError(400, "The paired test must be a general test with the purpose Pre-test");
  }
}
