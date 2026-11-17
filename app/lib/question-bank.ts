import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { DEFAULT_FORMAT, SECTION_KEY_RE } from "./exam-format";
import { QuestionCollection } from "@/models/Question";
import { Category } from "@/models/Category";

/**
 * Bank soal = koleksi (QuestionCollection) milik sebuah mata pelajaran (Category). Di ruang kerja Umum satu soal pasti punya bank,
 * dan `section` (kunci lama) diturunkan dari mata pelajaran bank itu, bukan diketik lagi.
 * Soal bagian format TOEFL ITP (listening, structure, reading) tetap boleh tanpa bank seperti sebelumnya.
 */
export const ITP_SECTION_KEYS: string[] = DEFAULT_FORMAT.sections.map((s) => s.key);
export const isItpSection = (section?: string | null) => !!section && ITP_SECTION_KEYS.includes(section);

/** Nama mata pelajaran menjadi kunci bagian yang sah (huruf kecil, angka, garis bawah; 2 sampai 32 karakter). */
export function sectionFromSubject(name?: string | null): string {
  const slug = (name ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "").slice(0, 32).replace(/_+$/, "");
  return SECTION_KEY_RE.test(slug) ? slug : "umum";
}

type U = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null };
export type BankFields = { section?: string | null; categoryId?: string | null; collectionId?: string | null };

/**
 * Menyelesaikan bank dan section sebuah soal (hasil akhir setelah digabung dengan data lama pada PATCH).
 * - Section ITP tanpa bank: dibiarkan.
 * - Selain itu bank wajib; mata pelajaran mengikuti bank, dan section diturunkan darinya (kecuali section ITP yang dipilih sengaja).
 */
export async function resolveBank(f: BankFields): Promise<{ section: string; categoryId: string | null; collectionId: string | null }> {
  if (!f.collectionId) {
    if (isItpSection(f.section)) return { section: f.section!, categoryId: f.categoryId ?? null, collectionId: null };
    throw new HttpError(400, "Choose a question bank for this question");
  }
  const col = await QuestionCollection.findById(f.collectionId).select("categoryId").lean();
  if (!col) throw new HttpError(404, "Collection not found");
  const colCat = col.categoryId ? String(col.categoryId) : null;
  if (f.categoryId && colCat && f.categoryId !== colCat) throw new HttpError(400, "The question bank belongs to another subject");
  const categoryId = colCat ?? f.categoryId ?? null;
  if (isItpSection(f.section)) return { section: f.section!, categoryId, collectionId: String(f.collectionId) };
  const cat = categoryId ? await Category.findById(categoryId).select("name").lean() : null;
  return { section: sectionFromSubject(cat?.name), categoryId, collectionId: String(f.collectionId) };
}

/** Soal yang belum punya bank dan bukan bagian format ITP: masuk daftar "Belum dikelompokkan". */
export const UNGROUPED_FILTER = { $and: [{ $or: [{ collectionId: { $exists: false } }, { collectionId: null }] }, { section: { $nin: ITP_SECTION_KEYS } }] };

/** Bank bawaan sebuah course: dibuat sekali, dinamai seperti course, di bawah mata pelajaran course itu. */
export async function ensureCourseBank(course: { _id: Types.ObjectId; title: string; categoryId?: Types.ObjectId | null; bankId?: Types.ObjectId | null }, owner: U, save: (bankId: Types.ObjectId) => Promise<unknown>): Promise<Types.ObjectId> {
  if (course.bankId && (await QuestionCollection.exists({ _id: course.bankId }))) return course.bankId;
  const bank = await QuestionCollection.create({ name: course.title.slice(0, 120), categoryId: course.categoryId ?? undefined, ownerId: owner._id, visibility: "global" });
  await save(bank._id);
  return bank._id;
}
