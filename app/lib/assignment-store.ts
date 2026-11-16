import mongoose from "mongoose";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { Course } from "@/models/Course";
import { LIVE, isPreviewer } from "./course-access";
import { participantCourseFilter } from "./course-scope";
import { featuresFor } from "./features";

export const MAX_ASSIGNMENT_BYTES = 10 * 1024 * 1024;

export async function assignmentBucket() {
  await connectDB();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "assignments" });
}

type Sniffed = { mime: string; ext: string };
/** Jenis berkas dari byte awal: PDF, PNG, JPEG, atau ZIP (termasuk docx, xlsx, pptx). Selain itu ditolak; nama dan tipe klaim tidak dipercaya. */
export function sniffAssignmentFile(b: Buffer): Sniffed | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06)) return { mime: "application/zip", ext: "zip" };
  return null;
}

/** Nama berkas aman untuk disimpan dan diunduh: tanpa jalur, tanda kutip, atau karakter kontrol. */
export function safeFileName(name: string, ext: string) {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "").replace(/[^\w\- .()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "submission";
  return `${base}.${ext}`;
}

type Me = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null; currentLevelId?: Types.ObjectId | null; qaTester?: boolean | null };

/** Course umum yang boleh dibuka peserta (institusi, kelas, status, modul Learning). 404 bila tidak. Admin dan QA tester: semua. */
export async function courseForAssignments(me: Me, courseId: string) {
  if (!isPreviewer(me)) {
    if (!(await featuresFor(me as never)).learning) throw new HttpError(404, "Course not found");
    const c = await Course.findOne({ _id: courseId, track: "general", ...LIVE, ...(await participantCourseFilter(me, { itp: false })) }).lean();
    if (!c) throw new HttpError(404, "Course not found");
    return c;
  }
  const c = await Course.findOne({ _id: courseId, track: "general" }).lean();
  if (!c) throw new HttpError(404, "Course not found");
  return c;
}
