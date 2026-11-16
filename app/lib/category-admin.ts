import { HttpError } from "./rbac";
import { Course } from "@/models/Course";
import { Category } from "@/models/Category";

/** Kategori yang dirujuk course (dan, di tahap berikutnya, koleksi atau tes) tidak boleh dihapus. */
export async function categoryInUse(id: string) {
  return !!(await Course.exists({ categoryId: id }));
}

/** Rujukan kategori pada course, koleksi, atau tes harus ada. */
export async function checkCategory(id: string | null | undefined) {
  if (!id) return;
  if (!(await Category.exists({ _id: id }))) throw new HttpError(400, "Category not found");
}
