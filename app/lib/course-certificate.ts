import type { Types } from "mongoose";
import { connectDB } from "./db";
import { Certificate } from "@/models/Certificate";
import { Course, CourseProgress, Unit, UnitProgress } from "@/models/Course";
import { User } from "@/models/User";
import { nextSeq } from "@/models/Settings";

export async function courseCertificateNumber() {
  const y = new Date().getFullYear();
  return `SMX-CRS-${y}-${String(await nextSeq(`cert-course-${y}`)).padStart(6, "0")}`;
}

/**
 * Apakah peserta sudah menyelesaikan course umum? Semua unit aktif selesai (materi dan kuis unit), dan bila course mewajibkan
 * ujian per bagian, ujian itu juga lulus. Course tanpa unit tidak pernah dianggap selesai.
 */
export async function courseCompleted(userId: Types.ObjectId | string, course: { _id: Types.ObjectId; requireSectionTest?: boolean | null; sectionTestId?: Types.ObjectId | null }) {
  const units = await Unit.find({ courseId: course._id, active: true }).select("_id").lean();
  if (!units.length) return false;
  const done = await UnitProgress.countDocuments({ userId, unitId: { $in: units.map((u) => u._id) }, status: "completed" });
  if (done < units.length) return false;
  if (course.requireSectionTest && course.sectionTestId) {
    if (!(await CourseProgress.exists({ userId, courseId: course._id, sectionTestPassed: true }))) return false;
  }
  return true;
}

/** Terbitkan sertifikat penyelesaian course umum (idempoten: satu per peserta per course). Course ITP tidak memakainya. */
export async function ensureCourseCertificate(userId: Types.ObjectId | string, courseId: Types.ObjectId | string) {
  await connectDB();
  const course = await Course.findById(courseId).select("title track requireSectionTest sectionTestId").lean();
  if (!course || course.track !== "general") return null;
  const hit = await Certificate.findOne({ userId, courseId });
  if (hit) return hit;
  if (!(await courseCompleted(userId, course))) return null;
  const user = await User.findById(userId).select("name email").lean();
  try {
    return await Certificate.create({
      userId, courseId, type: "course_completion", number: await courseCertificateNumber(),
      data: { courseTitle: course.title, name: user?.name ?? user?.email ?? "", completedAt: new Date() },
    });
  } catch { return Certificate.findOne({ userId, courseId }); } // balapan: dibuat proses lain
}
