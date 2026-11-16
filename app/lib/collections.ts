import type { QueryFilter, Types } from "mongoose";
import { HttpError } from "./rbac";
import { QuestionCollection, type CollectionDoc } from "@/models/Question";
import { Category } from "@/models/Category";

type U = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null };

/** Koleksi yang boleh dilihat staf: admin semua; lainnya miliknya, yang global, dan yang dibagikan ke institusinya. */
export function collectionVisible(u: U): QueryFilter<CollectionDoc> {
  if (u.role === "admin") return {};
  return { $or: [{ ownerId: u._id }, { visibility: "global" }, ...(u.institutionId ? [{ visibility: "institution" as const, institutionId: u.institutionId }] : [])] } as QueryFilter<CollectionDoc>;
}

/** Siapa boleh mengubah koleksi dan mengisinya: admin, pemilik, dan academic_admin untuk koleksi global. */
export function collectionWritable(u: U, c: { ownerId: Types.ObjectId; visibility: string }) {
  return u.role === "admin" || String(c.ownerId) === String(u._id) || (u.role === "academic_admin" && c.visibility === "global");
}

export function assertCollectionWritable(u: U, c: { ownerId: Types.ObjectId; visibility: string } | null | undefined): asserts c {
  if (!c) throw new HttpError(404, "Collection not found");
  if (!collectionWritable(u, c)) throw new HttpError(403, "You cannot change this collection");
}

/** Filter soal yang boleh dilihat staf: soal tanpa koleksi, dan soal di koleksi yang terlihat. Admin tanpa batas. */
export async function questionVisibleFilter(u: U): Promise<Record<string, unknown>> {
  if (u.role === "admin") return {};
  const ids = await QuestionCollection.find(collectionVisible(u)).distinct("_id");
  return { $or: [{ collectionId: { $exists: false } }, { collectionId: null }, { collectionId: { $in: ids } }] };
}

/** Koleksi dan kategori yang dirujuk soal harus ada dan boleh ditulis pengguna ini. */
export async function checkQuestionRefs(u: U, b: { collectionId?: string | null; categoryId?: string | null }) {
  if (b.collectionId) assertCollectionWritable(u, await QuestionCollection.findById(b.collectionId).lean());
  if (b.categoryId && !(await Category.exists({ _id: b.categoryId }))) throw new HttpError(400, "Category not found");
}
