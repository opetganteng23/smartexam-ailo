// Jenis soal ujian. Pilihan ganda memakai `options` + `answerKey` (tidak berubah); jenis lain menyimpan kuncinya di `Question.key`.
export const QUESTION_KINDS = ["mcq", "matching", "short", "essay"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const KIND_LABEL: Record<QuestionKind, string> = { mcq: "Multiple choice", matching: "Matching", short: "Short answer", essay: "Essay" };

/** Mencocokkan: tiap kiri punya satu kanan yang benar. Nilai sebagian per pasangan, kecuali `partial` false. */
export type MatchingKey = { pairs: { left: string; right: string }[]; partial?: boolean };
/** Isian singkat: dinilai otomatis terhadap daftar jawaban yang diterima. */
export type ShortKey = { accepted: string[]; caseSensitive?: boolean };
/** Essay: dinilai manusia (dengan draf AI bila tersedia) memakai rubrik; jumlah poin rubrik = poin soal. */
export type EssayKey = { rubric: { criterion: string; points: number }[]; guide?: string; maxWords?: number };

export const isKind = (v: unknown): v is QuestionKind => typeof v === "string" && (QUESTION_KINDS as readonly string[]).includes(v);
export const kindOf = (q: { kind?: string | null }): QuestionKind => (isKind(q.kind) ? q.kind : "mcq");

/** Periksa kunci jawaban saat soal dibuat/diubah. Mengembalikan pesan kesalahan, atau null bila sah. */
export function validateKey(kind: QuestionKind, key: unknown, points: number, mcq?: { options: string[]; answerKey: number | undefined }): string | null {
  if (kind === "mcq") {
    if (!mcq || mcq.options.length < 2 || mcq.options.length > 6) return "Multiple choice needs 2 to 6 options.";
    if (mcq.answerKey == null || mcq.answerKey < 0 || mcq.answerKey >= mcq.options.length) return "Choose the correct option.";
    return null;
  }
  const k = key as Record<string, unknown> | null | undefined;
  if (!k || typeof k !== "object") return "The answer key is missing.";
  if (kind === "matching") {
    const pairs = (k as MatchingKey).pairs;
    if (!Array.isArray(pairs) || pairs.length < 2 || pairs.length > 12) return "Matching needs 2 to 12 pairs.";
    if (pairs.some((p) => !p || !String(p.left ?? "").trim() || !String(p.right ?? "").trim())) return "Every pair needs both sides filled in.";
    if (new Set(pairs.map((p) => p.right.trim().toLowerCase())).size !== pairs.length) return "Right-hand items must all be different.";
    return null;
  }
  if (kind === "short") {
    const acc = (k as ShortKey).accepted;
    if (!Array.isArray(acc) || !acc.length || acc.some((a) => typeof a !== "string" || !a.trim())) return "Add at least one accepted answer.";
    return null;
  }
  const r = (k as EssayKey).rubric;
  if (!Array.isArray(r) || !r.length || r.length > 10) return "An essay needs a rubric of 1 to 10 criteria.";
  if (r.some((c) => !String(c.criterion ?? "").trim() || !(c.points > 0))) return "Every rubric criterion needs a name and points above 0.";
  const sum = Math.round(r.reduce((n, c) => n + c.points, 0) * 100) / 100;
  if (Math.abs(sum - points) > 0.01) return `Rubric points add up to ${sum}, but the question is worth ${points}.`;
  return null;
}

/** Rapikan kunci jawaban sebelum disimpan: spasi, duplikat, dan angka dibulatkan. Kunci pilihan ganda tidak dipakai (undefined). */
export function normalizeKey(kind: QuestionKind, key: unknown): unknown {
  const k = (key ?? {}) as Record<string, unknown>;
  if (kind === "matching") {
    const pairs = Array.isArray(k.pairs) ? (k.pairs as { left?: unknown; right?: unknown }[]) : [];
    return { pairs: pairs.map((p) => ({ left: String(p?.left ?? "").trim(), right: String(p?.right ?? "").trim() })), partial: k.partial === false ? false : true };
  }
  if (kind === "short") {
    const acc = Array.isArray(k.accepted) ? (k.accepted as unknown[]).map((a) => String(a ?? "").trim()).filter(Boolean) : [];
    return { accepted: Array.from(new Set(acc)), caseSensitive: k.caseSensitive === true };
  }
  if (kind === "essay") {
    const rubric = Array.isArray(k.rubric) ? (k.rubric as { criterion?: unknown; points?: unknown }[]) : [];
    const mw = Number(k.maxWords);
    return {
      rubric: rubric.map((c) => ({ criterion: String(c?.criterion ?? "").trim(), points: Math.round(Number(c?.points) * 100) / 100 })),
      guide: typeof k.guide === "string" && k.guide.trim() ? k.guide.trim().slice(0, 4000) : undefined,
      maxWords: Number.isFinite(mw) && mw > 0 ? Math.round(mw) : undefined,
    };
  }
  return undefined;
}
