import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getLevels, levelForScore, getParam } from "./config";
import { audit } from "./audit";
import { notify } from "./notify";
import { cycleState } from "./cycles";
import { pickClass } from "./class-pick";
import { HttpError } from "./rbac";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import { Setting, getSetting } from "@/models/Settings";
import { ClassGroup, ClassMember } from "@/models/Cluster";
import { LearningEvent } from "@/models/Course";

export async function participantPool(institutionId?: string | null) {
  const list = await User.find({ role: "participant", deletedAt: { $exists: false }, ...(institutionId ? { institutionId } : {}) }).select("name givenName surname email").lean();
  return list.map((u) => ({ id: String(u._id), name: u.name || [u.givenName, u.surname].filter(Boolean).join(" ") || u.email, email: u.email }));
}

/**
 * Konfirmasi hasil PURE/OCE untuk satu peserta: level dari padanan ITP, kuota coaching periode berjalan,
 * lalu masuk kelas yang masih ada kursinya. Dianggap sebagai placement periode ini (placement di aplikasi tidak diwajibkan lagi).
 */
async function eligibleClasses(user: { currentLevelId?: Types.ObjectId | null; institutionId?: Types.ObjectId | null }) {
  if (!user.currentLevelId) return [];
  const cs = await cycleState(user.institutionId);
  return ClassGroup.find({
    active: true, levelId: user.currentLevelId,
    $and: [
      { $or: [{ institutionId: { $exists: false } }, { institutionId: null }, ...(user.institutionId ? [{ institutionId: user.institutionId }] : [])] },
      { $or: [{ programCycleId: { $exists: false } }, { programCycleId: null }, ...(cs.active ? [{ programCycleId: cs.active._id }] : [])] },
    ],
  }).lean();
}

export async function memberCounts(classIds: Types.ObjectId[]) {
  const rows = await ClassMember.aggregate([{ $match: { classId: { $in: classIds }, active: true } }, { $group: { _id: "$classId", n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

/** Masukkan peserta ke kelas. `auto`: kelas berkursi yang paling longgar (acak bila seri); null = menunggu kelas. */
// Penempatan berjalan berurutan dalam satu proses (PM2 satu instance) agar dua peserta yang selesai bersamaan tidak membuat kelas kembar.
let classLock: Promise<unknown> = Promise.resolve();
export function assignClass(...args: Parameters<typeof assignClassNow>) {
  const run = classLock.then(() => assignClassNow(...args));
  classLock = run.catch(() => {});
  return run;
}

async function assignClassNow(userId: string, adminId: Types.ObjectId | undefined, method: "auto" | "manual", classId?: string | null, levelId?: Types.ObjectId) {
  const found = await User.findById(userId).select("currentLevelId institutionId").lean();
  if (!found) throw new HttpError(404, "Participant not found");
  const user = levelId ? { ...found, currentLevelId: levelId } : found; // levelId: level dari hasil yang masih ditahan (level peserta belum ditetapkan)
  const current = await ClassMember.findOne({ userId, active: true }).lean();
  let target: string | null = null;
  if (method === "manual") {
    if (classId) {
      const c = await ClassGroup.findById(classId).lean();
      if (!c || !c.active) throw new HttpError(404, "Class not found");
      const n = (await memberCounts([c._id])).get(String(c._id)) ?? 0;
      if (n >= c.capacity && String(current?.classId ?? "") !== String(c._id)) throw new HttpError(409, `${c.name} is full (${c.capacity} seats)`);
      target = String(c._id);
    }
  } else {
    const classes = await eligibleClasses(user);
    // Peserta yang sudah di kelas yang masih cocok tidak dipindah.
    if (current && classes.some((c) => String(c._id) === String(current.classId))) return String(current.classId);
    const counts = await memberCounts(classes.map((c) => c._id));
    target = pickClass(classes.map((c) => ({ id: String(c._id), capacity: c.capacity, count: counts.get(String(c._id)) ?? 0 })));
    if (!target && user.currentLevelId) target = await autoCreateClass(user as { currentLevelId: Types.ObjectId; institutionId?: Types.ObjectId | null });
  }
  if (String(current?.classId ?? "") === String(target ?? "")) return target;
  if (current) await ClassMember.updateOne({ _id: current._id }, { active: false, leftAt: new Date() });
  if (target) await ClassMember.create({ classId: target, userId, method, assignedBy: adminId });
  if (adminId) await audit(adminId, method === "manual" ? "class.move" : "class.assign", userId, { from: current ? String(current.classId) : null, to: target });
  return target;
}

/** Semua kelas level ini penuh atau belum ada: buat kelas baru (nama level + huruf, kapasitas dari parameter class_auto). */
async function autoCreateClass(user: { currentLevelId: Types.ObjectId; institutionId?: Types.ObjectId | null }) {
  const cfg = await getParam("class_auto");
  if (!cfg.enabled) return null;
  const level = (await getLevels()).find((l) => String(l._id) === String(user.currentLevelId));
  if (!level) return null;
  const cs = await cycleState(user.institutionId);
  const scope = { levelId: level._id, ...(user.institutionId ? { institutionId: user.institutionId } : {}), ...(cs.active ? { programCycleId: cs.active._id } : {}) };
  const names = new Set((await ClassGroup.find({ levelId: level._id, ...(user.institutionId ? { institutionId: user.institutionId } : {}) }).select("name").lean()).map((c) => c.name));
  let i = 0; while (names.has(`${level.name} ${classLetter(i)}`)) i++;
  const c = await ClassGroup.create({ ...scope, name: `${level.name} ${classLetter(i)}`, capacity: cfg.size, active: true });
  return String(c._id);
}
/** 0 -> A, 25 -> Z, 26 -> AA ... */
export const classLetter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : classLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** Statistik kelas: jumlah siswa, aktif 7 hari terakhir (login atau belajar), rata-rata skor. */
export async function classStats(classIds: Types.ObjectId[]) {
  const members = await ClassMember.find({ classId: { $in: classIds }, active: true }).select("classId userId").lean();
  const ids = members.map((m) => m.userId);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const day = since.toISOString().slice(0, 10);
  const [users, learners] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("lastLoginAt currentScoreEst status").lean(),
    LearningEvent.distinct("userId", { userId: { $in: ids }, day: { $gte: day } }),
  ]);
  const learned = new Set(learners.map(String));
  const byUser = new Map(users.map((u) => [String(u._id), u]));
  const out = new Map<string, { students: number; active: number; avgScore: number | null }>();
  for (const id of classIds) {
    const ms = members.filter((m) => String(m.classId) === String(id)).map((m) => byUser.get(String(m.userId))).filter(Boolean) as typeof users;
    const active = ms.filter((u) => (u.lastLoginAt && u.lastLoginAt >= since) || learned.has(String(u._id))).length;
    const scores = ms.map((u) => u.currentScoreEst).filter((s): s is number => typeof s === "number");
    out.set(String(id), { students: ms.length, active, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null });
  }
  return out;
}

export const isActiveSince = (lastLoginAt: Date | null | undefined, learned: boolean, since: Date) => learned || (!!lastLoginAt && lastLoginAt >= since);
