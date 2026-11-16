import type { Types } from "mongoose";
import type { QueryFilter } from "mongoose";
import { ClassMember } from "@/models/Cluster";
import { Course, Unit, type CourseDoc } from "@/models/Course";
import { LIVE } from "./course-access";

type Me = { _id: Types.ObjectId; institutionId?: Types.ObjectId | null; currentLevelId?: Types.ObjectId | null };

/** Track course; course lama tanpa field dibaca ITP. */
export const trackOf = (c: { track?: string | null }) => c.track ?? "itp";

/**
 * Filter Mongo untuk course yang boleh dibuka seorang peserta (dipakai di SEMUA rute course/unit/materi/kuis, supaya akses
 * dijaga di level query dan bukan hanya di daftar). Gabungan dari:
 *  - track umum: institusi peserta termasuk `institutionIds` (kosong = semua institusi) DAN kelas aktifnya termasuk
 *    `classIds` (kosong = semua kelas); course `paid` tidak masuk jalur ditetapkan;
 *  - track ITP (atau tanpa track): course di level peserta, persis seperti sebelumnya.
 * Tanpa institusi atau kelas, peserta hanya melihat course yang tidak dibatasi ke institusi atau kelas.
 */
export async function participantCourseFilter(me: Me, opts: { itp?: boolean } = {}): Promise<QueryFilter<CourseDoc>> {
  const member = await ClassMember.findOne({ userId: me._id, active: true }).select("classId").lean();
  const scope = (field: "institutionIds" | "classIds", id: Types.ObjectId | null | undefined) => ({
    $or: [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }, ...(id ? [{ [field]: id }] : [])],
  });
  const general = {
    track: "general",
    accessMode: { $ne: "paid" },
    $and: [scope("institutionIds", me.institutionId), scope("classIds", member?.classId)],
  };
  const itp = me.currentLevelId && opts.itp !== false ? [{ levelId: me.currentLevelId, track: { $ne: "general" } }] : [];
  return { $or: [general, ...itp] } as QueryFilter<CourseDoc>;
}

/** Apakah course ITP (dibuka lewat level dan placement)? */
export const isItpCourse = (c: { track?: string | null }) => trackOf(c) !== "general";

/**
 * Materi yang hanya dipakai course umum yang TIDAK boleh dibuka peserta ini (institusi atau kelas lain). Materi yang juga ada
 * di course ITP atau tidak di course mana pun (perpustakaan) tidak terpengaruh.
 */
export async function restrictedMaterialIds(me: Me): Promise<Types.ObjectId[]> {
  const general = await Course.find({ ...LIVE, track: "general" }).select("_id").lean();
  if (!general.length) return [];
  const generalIds = general.map((c) => c._id);
  const mine = new Set((await Course.find({ ...LIVE, ...(await participantCourseFilter(me)) }).select("_id").lean()).map((c) => String(c._id)));
  const units = await Unit.find({ courseId: { $in: generalIds }, active: true }).select("courseId materialIds").lean();
  const open = new Set(units.filter((u) => mine.has(String(u.courseId))).flatMap((u) => u.materialIds.map(String)));
  const blocked = new Map<string, Types.ObjectId>();
  for (const u of units) if (!mine.has(String(u.courseId))) for (const m of u.materialIds) if (!open.has(String(m))) blocked.set(String(m), m);
  if (!blocked.size) return [];
  const elsewhere = await Unit.find({ courseId: { $nin: generalIds }, materialIds: { $in: [...blocked.values()] } }).select("materialIds").lean();
  for (const u of elsewhere) for (const m of u.materialIds) blocked.delete(String(m));
  return [...blocked.values()];
}
