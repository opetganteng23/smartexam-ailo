import sanitizeHtml from "sanitize-html";
import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { Course, Unit } from "@/models/Course";
import { LIVE, PREVIEW_VISIBLE, isPreviewer, assertUnitAccess } from "./course-access";
import { participantCourseFilter } from "./course-scope";
import { featuresFor } from "./features";

export const COMMENT_MAX = 2000;

/** Teks komentar: semua tag dibuang, karakter kontrol hilang, spasi dirapikan. Hasil dikirim dan ditampilkan sebagai teks biasa. */
export function cleanComment(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "discard" });
  // sanitize-html mengembalikan entity (&amp;, &lt;): kembalikan ke karakter agar tampil wajar sebagai teks.
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

type Me = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null; currentLevelId?: Types.ObjectId | null; qaTester?: boolean | null };
export const isModerator = (u: { role: string }) => u.role === "admin" || u.role === "academic_admin";

/** Nama yang tampil di diskusi: nama depan dan inisial belakang (privasi), bukan email. */
export function displayName(u: { name?: string | null; email?: string | null } | null | undefined) {
  const parts = (u?.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Participant";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Unit yang boleh dibuka pengguna ini (aturan sama dengan halaman unit: course, institusi, kelas, prasyarat, drip). 404 bila tidak. */
export async function unitForDiscussion(me: Me, unitId: string) {
  const unit = await Unit.findOne({ _id: unitId, active: true }).lean();
  const preview = isPreviewer(me);
  if (!preview && !(await featuresFor(me as never)).learning) throw new HttpError(404, "Unit not found");
  const course = unit ? await Course.findOne(preview ? { _id: unit.courseId, ...PREVIEW_VISIBLE } : { _id: unit.courseId, ...LIVE, ...(await participantCourseFilter(me)) }).lean() : null;
  if (!unit || !course) throw new HttpError(404, "Unit not found");
  if (!preview) await assertUnitAccess(me._id, unit, course);
  return { unit, course };
}
