import { NextResponse } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Question, QuestionCollection } from "@/models/Question";
import { Category } from "@/models/Category";
import { Institution } from "@/models/Institution";
import { collectionInput } from "@/lib/collection-schemas";
import { collectionVisible } from "@/lib/collections";

export const dynamic = "force-dynamic";

/** Koleksi yang terlihat pengguna ini, dengan jumlah soal. `?categoryId=` menyaring per kategori. */
export async function GET(req: Request) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    await connectDB();
    const cat = new URL(req.url).searchParams.get("categoryId");
    if (cat && !/^[0-9a-f]{24}$/.test(cat)) throw new HttpError(400, "Invalid category");
    const cols = await QuestionCollection.find({ ...collectionVisible(me), ...(cat ? { categoryId: cat } : {}) }).sort({ name: 1 }).lean();
    const counts = await Question.aggregate<{ _id: unknown; n: number }>([{ $match: { collectionId: { $in: cols.map((c) => c._id) } } }, { $group: { _id: "$collectionId", n: { $sum: 1 } } }]);
    const n = new Map(counts.map((c) => [String(c._id), c.n]));
    return NextResponse.json({
      collections: cols.map((c) => ({
        id: String(c._id), name: c.name, categoryId: c.categoryId ? String(c.categoryId) : null, description: c.description ?? "", visibility: c.visibility,
        institutionId: c.institutionId ? String(c.institutionId) : null, mine: String(c.ownerId) === String(me._id), questions: n.get(String(c._id)) ?? 0,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    const b = collectionInput.parse(await req.json());
    await connectDB();
    if (b.visibility === "global" && !ACADEMIC_ROLES.includes(me.role)) throw new HttpError(403, "Only academic admins can make a collection global");
    if (b.categoryId && !(await Category.exists({ _id: b.categoryId }))) throw new HttpError(400, "Category not found");
    if (b.institutionId && !(await Institution.exists({ _id: b.institutionId }))) throw new HttpError(400, "Institution not found");
    const c = await QuestionCollection.create({ ...b, categoryId: b.categoryId ?? undefined, institutionId: b.visibility === "institution" ? b.institutionId ?? undefined : undefined, ownerId: me._id });
    await audit(me._id, "collection.create", String(c._id), { visibility: b.visibility });
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
