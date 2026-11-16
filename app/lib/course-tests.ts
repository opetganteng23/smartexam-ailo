import type { Types } from "mongoose";
import { Attempt } from "@/models/Test";
import { seatsFor } from "./schedule-db";
import { scheduleGate, fmtWindow } from "./schedule";
import { dailyGate, wibDayStart } from "./daily-window";
import { testSize } from "./attempt-sections";

type TestLean = {
  _id: Types.ObjectId; name: string; purpose?: string | null; scheduled?: boolean; maxAttempts?: number | null; resultDelayMin?: number | null;
  daily?: { start?: string | null; end?: string | null; maxPerDay?: number | null } | null;
  sections: { durationSec: number; questionIds: unknown[]; draw?: { collectionId?: Types.ObjectId | string | null; count?: number | null } | null }[];
};
type Me = { _id: Types.ObjectId; role: string; qaTester?: boolean | null; institutionId?: Types.ObjectId | null };

/**
 * Keadaan tes umum bagi satu peserta: bisa dimulai sekarang atau tidak (jadwal sesi, jendela harian, batas percobaan total dan per hari),
 * percobaan yang sudah dipakai, skor terbaik yang sudah dirilis, dan percobaan yang sedang berjalan. Dipakai halaman course dan daftar tes.
 */
export async function generalTestStates(me: Me, tests: TestLean[], now = new Date()) {
  const out = new Map<string, { id: string; name: string; purpose: string | null; totalQuestions: number; totalSec: number; unlocked: boolean; reason: string | null; attemptsUsed: number; maxAttempts: number; best: number | null; inProgressAttemptId: string | null; daily: { start: string; end: string; maxPerDay: number } | null; schedule: { state?: string; text: string; opensAt: Date; closesAt: Date } | null }>();
  if (!tests.length) return out;
  const ids = tests.map((t) => t._id);
  const [attempts, seats] = await Promise.all([
    Attempt.find({ userId: me._id, testId: { $in: ids } }).select("testId status scoreEst startedAt releaseAt").lean(),
    seatsFor(me._id, tests.filter((t) => t.scheduled).map((t) => t._id)),
  ]);
  const dayStart = wibDayStart(now);
  for (const t of tests) {
    const mine = attempts.filter((a) => String(a.testId) === String(t._id));
    const running = mine.find((a) => a.status === "in_progress");
    const today = mine.filter((a) => a.startedAt >= dayStart).length;
    const sched = scheduleGate(t as never, me as never, seats.get(String(t._id)) ?? null, now);
    let reason: string | null = null;
    if (!running && !me.qaTester && me.role !== "admin") {
      if (!sched.ok) reason = sched.reason ?? "This test is not open for you right now";
      else if ((t.maxAttempts ?? 0) > 0 && mine.length >= t.maxAttempts!) reason = `You have used all ${t.maxAttempts} attempt${t.maxAttempts === 1 ? "" : "s"}.`;
      else if (t.daily) {
        const g = dailyGate(t.daily, now);
        if (!g.ok) reason = g.reason ?? "Closed right now";
        else if ((t.daily.maxPerDay ?? 0) > 0 && today >= t.daily.maxPerDay!) reason = `You have used today's ${t.daily.maxPerDay} attempt${t.daily.maxPerDay === 1 ? "" : "s"}. Come back tomorrow.`;
      }
    }
    if (t.scheduled && !sched.visible && !running) continue; // tes terjadwal tanpa kursi tidak terlihat
    const released = mine.filter((a) => a.status === "submitted" && (!a.releaseAt || a.releaseAt <= now) && a.scoreEst != null).map((a) => a.scoreEst as number);
    out.set(String(t._id), {
      id: String(t._id), name: t.name, purpose: t.purpose ?? null, totalQuestions: testSize(t), totalSec: t.sections.reduce((n, s) => n + s.durationSec, 0),
      unlocked: !reason, reason, attemptsUsed: mine.length, maxAttempts: t.maxAttempts ?? 0, best: released.length ? Math.max(...released) : null,
      inProgressAttemptId: running ? String(running._id) : null,
      daily: t.daily?.start && t.daily?.end ? { start: t.daily.start, end: t.daily.end, maxPerDay: t.daily.maxPerDay ?? 0 } : null,
      schedule: t.scheduled && sched.window ? { state: sched.state, text: fmtWindow(sched.window), opensAt: sched.window.opensAt, closesAt: sched.window.closesAt } : null,
    });
  }
  return out;
}
