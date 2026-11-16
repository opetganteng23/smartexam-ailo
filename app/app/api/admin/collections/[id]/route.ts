import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Question, QuestionCollection } from "@/models/Question";
import { Category } from "@/models/Category";
import { Institution } from "@/models/Institution";
import { collectionInput } from "@/lib/collection-schemas";
import { assertCollectionWritable, collectionVisible } from "@/lib/collections";

/** Koleksi yang dikenali pengguna; koleksi yang tidak terlihat dijawab seolah tidak ada. */
async function load(id: string, me: Parameters<typeof collectionVisible>[0]) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Collection not found");
  await connectDB();
  const c = await QuestionCollection.findOne({ _id: id, ...collectionVisible(me) });
  if (!c) throw new HttpError(404, "Collection not found");
  return c;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    const c = await load(params.id, me);
    assertCollectionWritable(me, c);
    const b = collectionInput.parse(await req.json());
    if (b.visibility === "global" && !ACADEMIC_ROLES.includes(me.role)) throw new HttpError(403, "Only academic admins can make a collection global");
    if (b.categoryId && !(await Category.exists({ _id: b.categoryId }))) throw new HttpError(400, "Category not found");
    if (b.institutionId && !(await Institution.exists({ _id: b.institutionId }))) throw new HttpError(400, "Institution not found");
    const before = c.visibility;
    c.set({ name: b.name, description: b.description, categoryId: b.categoryId ?? undefined, visibility: b.visibility, institutionId: b.visibility === "institution" ? b.institutionId ?? undefined : undefined });
    await c.save();
    await audit(me._id, before !== b.visibility ? "collection.visibility" : "collection.update", params.id, { from: before, to: b.visibility });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    const c = await load(params.id, me);
    assertCollectionWritable(me, c);
    if (await Question.exists({ collectionId: c._id })) throw new HttpError(409, "This collection still has questions. Move or delete them first.");
    await c.deleteOne();
    await audit(me._id, "collection.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
