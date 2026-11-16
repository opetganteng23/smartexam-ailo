import type { QueryFilter, Types } from "mongoose";
import { HttpError } from "./rbac";
import type { CollectionDoc } from "@/models/Question";

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
