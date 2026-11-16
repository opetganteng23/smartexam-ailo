// Jendela harian kuis (K5): buka dan tutup pada jam yang sama setiap hari, dalam WIB (UTC+7, tanpa DST).
export type DailyWindow = { start: string; end: string };
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WIB_OFFSET_MS = 7 * 3600_000;

export function parseHM(s: string | undefined | null): number | null {
  const m = HM.exec(s ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Menit sejak tengah malam WIB. */
export const wibMinutes = (d: Date) => { const x = new Date(d.getTime() + WIB_OFFSET_MS); return x.getUTCHours() * 60 + x.getUTCMinutes(); };
/** Tanggal WIB (YYYY-MM-DD). */
export const wibDay = (d: Date) => new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
/** Awal hari WIB (sebagai Date UTC) untuk menghitung percobaan per hari. */
export const wibDayStart = (d: Date) => new Date(Date.parse(wibDay(d) + "T00:00:00Z") - WIB_OFFSET_MS);

/** Jendela yang melewati tengah malam (mis. 22:00 sampai 02:00) didukung. Tanpa jendela, selalu terbuka. */
export function dailyGate(w: { start?: string | null; end?: string | null } | null | undefined, now = new Date()): { ok: boolean; reason?: string } {
  if (!w || (!w.start && !w.end)) return { ok: true };
  const s = parseHM(w.start), e = parseHM(w.end);
  if (s === null || e === null || s === e) return { ok: true }; // jendela tidak sah dianggap tidak ada (divalidasi saat simpan)
  const m = wibMinutes(now);
  const open = s < e ? m >= s && m < e : m >= s || m < e;
  return open ? { ok: true } : { ok: false, reason: `This quiz is open every day from ${w.start} to ${w.end} WIB.` };
}
