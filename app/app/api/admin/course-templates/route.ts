import { NextResponse } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { TEMPLATES, createFromTemplate, scaffoldLevel } from "@/lib/course-templates";
import { Level } from "@/models/Config";
import { getFeatures } from "@/lib/features";

export const dynamic = "force-dynamic";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
const input = z.object({
  templateKey: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(120).optional(),
  categoryId: oid.nullable().optional(),
  institutionIds: z.array(oid).max(200).default([]),
  classIds: z.array(oid).max(500).default([]),
  levelId: oid.optional(), // preset TOEFL ITP
});

export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    const itp = (await getFeatures()).itpPack; // paket TOEFL ITP di balik saklar
    return NextResponse.json({ templates: TEMPLATES.filter((t) => t.track === "general" || itp).map((t) => ({ key: t.key, name: t.name, description: t.description, track: t.track, modules: t.modules.map((m) => ({ title: m.title, units: m.units.length })) })) });
  } catch (e) {
    return handleError(e);
  }
}

/** Buat course dari templat: course umum (judul wajib) atau preset TOEFL ITP (level wajib). Course baru Preview only. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = input.parse(await req.json());
    await connectDB();
    if (b.templateKey === "toefl-itp") {
      if (!(await getFeatures()).itpPack) throw new HttpError(404, "This feature is not available");
      if (!b.levelId) throw new HttpError(400, "Choose a level for the TOEFL ITP preset");
      if (!(await Level.exists({ _id: b.levelId }))) throw new HttpError(404, "Level not found");
      const r = await scaffoldLevel(b.levelId);
      await audit(admin._id, "course.scaffold", b.levelId, r);
      return NextResponse.json(r, { status: 201 });
    }
    if (!b.title) throw new HttpError(400, "Enter a course title");
    const r = await createFromTemplate(b.templateKey, { title: b.title, categoryId: b.categoryId, institutionIds: b.institutionIds, classIds: b.classIds });
    await audit(admin._id, "course.from_template", r.id, { template: b.templateKey });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
