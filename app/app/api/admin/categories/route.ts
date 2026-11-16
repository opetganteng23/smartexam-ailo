import { NextResponse } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Category } from "@/models/Category";
import { Course } from "@/models/Course";
import { categoryInput, categoryKey } from "@/lib/category-schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const [cats, used] = await Promise.all([
      Category.find().sort({ order: 1, name: 1 }).lean(),
      Course.aggregate<{ _id: unknown; n: number }>([{ $match: { categoryId: { $exists: true } } }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]),
    ]);
    const n = new Map(used.map((u) => [String(u._id), u.n]));
    return NextResponse.json({ categories: cats.map((c) => ({ id: String(c._id), name: c.name, description: c.description ?? "", order: c.order, active: c.active, courses: n.get(String(c._id)) ?? 0 })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = categoryInput.parse(await req.json());
    await connectDB();
    if (await Category.exists({ nameKey: categoryKey(b.name) })) throw new HttpError(409, "A category with this name already exists");
    const c = await Category.create({ ...b, nameKey: categoryKey(b.name) });
    await audit(admin._id, "category.create", String(c._id));
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
