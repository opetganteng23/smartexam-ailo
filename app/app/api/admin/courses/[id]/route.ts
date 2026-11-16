import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { courseInput } from "@/lib/course-schemas";
import { Course, CourseModule, Unit } from "@/models/Course";
import { checkCourseRefs } from "@/lib/course-admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    const raw = await req.json();
    await connectDB();
    // Klien yang tidak mengirim track tidak boleh mengubah course umum menjadi ITP secara diam-diam.
    if (raw && typeof raw === "object" && raw.track === undefined) raw.track = (await Course.findById(params.id).select("track").lean())?.track ?? "itp";
    const b = courseInput.parse(raw);
    await checkCourseRefs(b, params.id);
    const { coverAssetId, part, sectionTestId, levelId, categoryId, priceIdr, ...rest } = b;
    const unset: Record<string, 1> = {};
    if (!coverAssetId) unset.coverAssetId = 1;
    if (!part) unset.part = 1;
    if (!sectionTestId) unset.sectionTestId = 1;
    if (!levelId) unset.levelId = 1;
    if (!categoryId) unset.categoryId = 1;
    if (priceIdr == null) unset.priceIdr = 1;
    const r = await Course.updateOne({ _id: params.id }, { ...rest, ...(levelId ? { levelId } : {}), ...(categoryId ? { categoryId } : {}), ...(priceIdr != null ? { priceIdr } : {}), ...(coverAssetId ? { coverAssetId } : {}), ...(part ? { part } : {}), ...(sectionTestId ? { sectionTestId } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    if (!r.matchedCount) throw new HttpError(404, "Course not found");
    await audit(admin._id, b.archived ? "course.archive" : "course.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    await connectDB();
    if (await Unit.exists({ courseId: params.id })) throw new HttpError(409, "This course still has units. Delete its units first or deactivate the course.");
    await CourseModule.deleteMany({ courseId: params.id });
    await Course.updateMany({ prerequisiteCourseIds: params.id }, { $pull: { prerequisiteCourseIds: params.id } });
    await Course.deleteOne({ _id: params.id });
    await audit(admin._id, "course.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
