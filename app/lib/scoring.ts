import type { Section } from "@/models/Question";

export type ScoreScale = "itp" | "percent";
/** scale "itp": skor bagian 31-68 dan total 310-677 (format TOEFL ITP). "percent": skor bagian dan total berupa persen (0-100). */
export type Conversion = { mode: "linear" | "table"; scaledMin: number; scaledMax: number; tables: Record<string, Record<string, number>>; scale?: ScoreScale; passMark?: number | null };

export const scaleOf = (c: { scale?: ScoreScale }): ScoreScale => (c.scale === "percent" ? "percent" : "itp");
/** Rentang skor total untuk grafik dan label. */
export const totalRange = (scale: ScoreScale) => (scale === "percent" ? { min: 0, max: 100, unit: "%" } : { min: 310, max: 677, unit: "" });
export type SectionResult = { section: Section; raw: number; total: number; scaled: number };

/** Raw → skala section 31-68. Mode 'table' membaca tabel resmi dari config_params (score_conversion). */
export function scaleSection(conv: Conversion, section: Section, raw: number, total: number): number {
  if (scaleOf(conv) === "percent") return total === 0 ? 0 : Math.round((100 * raw) / total);
  if (conv.mode === "table") {
    const hit = conv.tables[section]?.[String(Math.round(raw))]; // poin bisa pecahan (soal mencocokkan); tabel konversi berbasis bilangan bulat
    if (typeof hit === "number") return hit;
  }
  if (total === 0) return conv.scaledMin;
  return Math.round(conv.scaledMin + ((conv.scaledMax - conv.scaledMin) * raw) / total);
}

/** Skor total ITP = rata-rata 3 section × 10, rentang 310-677. Skala persen: persen poin diperoleh dari seluruh poin tes. */
export function estimateTotal(sections: SectionResult[], scale: ScoreScale = "itp"): number {
  if (scale === "percent") {
    const total = sections.reduce((a, s) => a + s.total, 0);
    return total === 0 ? 0 : Math.round((100 * sections.reduce((a, s) => a + s.raw, 0)) / total);
  }
  if (!sections.length) return 310;
  const avg = sections.reduce((a, s) => a + s.scaled, 0) / sections.length;
  return Math.min(677, Math.max(310, Math.round(avg * 10)));
}

export function gradeAttempt(
  conv: Conversion,
  sections: { name: Section; questionIds: string[] }[],
  answerKey: Map<string, number>,
  answers: Map<string, number | undefined>
) {
  const results: SectionResult[] = sections.map((s) => {
    const raw = s.questionIds.reduce((n, id) => n + (answers.get(id) === answerKey.get(id) ? 1 : 0), 0);
    const total = s.questionIds.length;
    return { section: s.name, raw, total, scaled: scaleSection(conv, s.name, raw, total) };
  });
  return {
    sectionScores: results,
    scoreRaw: results.reduce((a, r) => a + r.raw, 0),
    scoreEst: estimateTotal(results),
  };
}

/** Penilaian berbasis poin: `graded` berisi poin diperoleh dan poin penuh tiap soal (soal tanpa catatan dihitung 1 poin, 0 diperoleh). */
export function gradePoints(
  conv: Conversion,
  sections: { name: Section; questionIds: string[] }[],
  graded: Map<string, { earned: number; max: number }>
) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const results: SectionResult[] = sections.map((s) => {
    let raw = 0, total = 0;
    for (const id of s.questionIds) { const g = graded.get(id); raw += g?.earned ?? 0; total += g?.max ?? 1; }
    raw = r2(raw); total = r2(total);
    return { section: s.name, raw, total, scaled: scaleSection(conv, s.name, raw, total) };
  });
  const scoreEst = estimateTotal(results, scaleOf(conv));
  const passMark = conv.passMark ?? null;
  return { sectionScores: results, scoreRaw: r2(results.reduce((a, r) => a + r.raw, 0)), scoreEst, scoreScale: scaleOf(conv), passMark, passed: passMark != null ? scoreEst >= passMark : null };
}
