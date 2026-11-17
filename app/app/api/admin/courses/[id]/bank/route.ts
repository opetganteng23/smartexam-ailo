import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Course } from "@/models/Course";
import { ensureCourseBank } from "@/lib/question-bank";

/** Bank soal bawaan sebuah course umum. Dibuat bila belum ada (course lama), lalu dikembalikan; idempoten. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    await connectDB();
    const c = await Course.findById(params.id).select("title categoryId bankId track").lean();
    if (!c) throw new HttpError(404, "Course not found");
    if ((c.track ?? "itp") !== "general") throw new HttpError(400, "Only general courses have a default question bank");
    const had = !!c.bankId;
    const bankId = await ensureCourseBank(c, admin, (id) => Course.updateOne({ _id: c._id, bankId: { $exists: false } }, { bankId: id }));
    if (!had) await audit(admin._id, "course.bank.create", params.id, { bankId: String(bankId) });
    return NextResponse.json({ bankId: String(bankId) });
  } catch (e) {
    return handleError(e);
  }
}
