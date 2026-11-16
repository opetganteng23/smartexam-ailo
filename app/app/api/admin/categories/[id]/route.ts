import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Category } from "@/models/Category";
import { categoryInput, categoryKey } from "@/lib/category-schemas";
import { categoryInUse } from "@/lib/category-admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Category not found");
    const b = categoryInput.parse(await req.json());
    await connectDB();
    if (await Category.exists({ nameKey: categoryKey(b.name), _id: { $ne: params.id } })) throw new HttpError(409, "A category with this name already exists");
    const r = await Category.updateOne({ _id: params.id }, { ...b, nameKey: categoryKey(b.name) });
    if (!r.matchedCount) throw new HttpError(404, "Category not found");
    await audit(admin._id, "category.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Category not found");
    await connectDB();
    if (await categoryInUse(params.id)) throw new HttpError(409, "This category is still used. Deactivate it instead.");
    const r = await Category.deleteOne({ _id: params.id });
    if (!r.deletedCount) throw new HttpError(404, "Category not found");
    await audit(admin._id, "category.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
