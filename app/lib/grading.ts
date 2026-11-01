import { kindOf, type MatchingKey, type ShortKey, type EssayKey } from "./question-kinds";

// Penilaian satu jawaban per jenis soal. Hasil dalam poin: pilihan ganda 0 atau penuh, mencocokkan sebagian per pasangan,
// isian singkat 0 atau penuh, essay menunggu nilai manusia (pending) sampai `points` diisi.
export type GQuestion = { kind?: string | null; points?: number | null; answerKey?: number | null; key?: unknown };
export type GAnswer = { choice?: number | null; response?: unknown; points?: number | null };
export type Graded = { earned: number; max: number; answered: boolean; correct: boolean; pending: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string, cs: boolean) => { const t = s.trim().replace(/\s+/g, " "); return cs ? t : t.toLowerCase(); };
const text = (v: unknown) => (typeof v === "string" ? v : "");

export const maxPoints = (q: GQuestion) => (q.points != null && q.points >= 0 ? q.points : 1);

/** Apakah jawaban ini terisi (dipakai untuk "terjawab" di mana pun). */
export function isAnswered(q: GQuestion, a: GAnswer | undefined): boolean {
  if (!a) return false;
  const kind = kindOf(q);
  if (kind === "mcq") return a.choice != null;
  if (kind === "matching") return Array.isArray(a.response) && (a.response as unknown[]).some((x) => typeof x === "number" && x >= 0);
  return text(a.response).trim().length > 0;
}

/** Ada isi pada jawaban ini, apa pun jenis soalnya (tanpa perlu data soal). */
export const hasAnswer = (a: GAnswer | undefined): boolean =>
  !!a && (a.choice != null || (typeof a.response === "string" ? a.response.trim().length > 0 : Array.isArray(a.response) && (a.response as unknown[]).some((x) => typeof x === "number" && x >= 0)));

export function gradeOne(q: GQuestion, a: GAnswer | undefined): Graded {
  const kind = kindOf(q), max = maxPoints(q), answered = isAnswered(q, a);
  if (kind === "mcq") {
    const ok = answered && a!.choice === q.answerKey;
    return { earned: ok ? max : 0, max, answered, correct: ok, pending: false };
  }
  if (kind === "matching") {
    const key = q.key as MatchingKey | undefined, pairs = key?.pairs ?? [];
    const resp = Array.isArray(a?.response) ? (a!.response as unknown[]) : [];
    const right = pairs.length ? resp.slice(0, pairs.length).filter((x, i) => x === i).length : 0; // pasangan ke-i benar bila kanan terpilih = i
    const full = pairs.length > 0 && right === pairs.length;
    const earned = key?.partial === false ? (full ? max : 0) : pairs.length ? r2((max * right) / pairs.length) : 0;
    return { earned, max, answered, correct: full, pending: false };
  }
  if (kind === "short") {
    const key = q.key as ShortKey | undefined, cs = !!key?.caseSensitive;
    const ok = answered && (key?.accepted ?? []).some((x) => norm(x, cs) === norm(text(a!.response), cs));
    return { earned: ok ? max : 0, max, answered, correct: ok, pending: false };
  }
  // essay: tanpa jawaban = 0 dan tidak perlu dinilai; ada jawaban = menunggu nilai manusia.
  if (!answered) return { earned: 0, max, answered: false, correct: false, pending: false };
  if (a!.points == null) return { earned: 0, max, answered: true, correct: false, pending: true };
  const earned = r2(Math.min(max, Math.max(0, a!.points)));
  return { earned, max, answered: true, correct: max > 0 && earned >= max * 0.6, pending: false };
}

/** Rubrik essay: batas poin tiap kriteria dipakai untuk memeriksa nilai yang dimasukkan. */
export const essayMax = (q: GQuestion) => ((q.key as EssayKey | undefined)?.rubric ?? []).reduce((n, c) => n + c.points, 0) || maxPoints(q);
