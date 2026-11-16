import { gradeOne, type GAnswer } from "./grading";

// Statistik butir soal dari percobaan yang sudah selesai: kesulitan nyata, daya beda, jumlah pemakaian, dan sebaran pilihan.
// Murni (tanpa database). Percobaan membawa daftar butirnya sendiri (snapshot), jadi tes dengan soal acak per percobaan juga benar.
export type StatItem = { qid: string; section?: string | null; kind?: string | null; points?: number | null; answerKey?: number | null; key?: unknown; stem?: string; declared?: string | null; options?: number };
export type StatAttempt = { items: StatItem[]; answers: (GAnswer & { qid: string })[] };
export type ItemRow = {
  qid: string; stem: string; kind: string; section: string | null; declared: string | null;
  used: number; answered: number; p: number | null; discrimination: number | null; distribution: number[] | null;
  flags: ("too_easy" | "too_hard" | "weak_discrimination" | "negative_discrimination" | "many_blank")[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const MIN_FOR_P = 5, MIN_FOR_D = 10, MIN_FOR_FLAGS = 30;

export function computeItemStats(attempts: StatAttempt[]): { rows: ItemRow[]; attempts: number } {
  type Obs = { frac: number | null; total: number; answered: boolean; choice: number | null };
  const byItem = new Map<string, { item: StatItem; obs: Obs[] }>();
  for (const a of attempts) {
    const ans = new Map(a.answers.map((x) => [String(x.qid), x]));
    const graded = a.items.map((it) => ({ it, g: gradeOne({ kind: it.kind ?? "mcq", points: it.points ?? 1, answerKey: it.answerKey ?? undefined, key: it.key } as never, ans.get(String(it.qid))) }));
    const scored = graded.filter((x) => !x.g.pending);
    const max = scored.reduce((n, x) => n + x.g.max, 0);
    const total = max > 0 ? (scored.reduce((n, x) => n + x.g.earned, 0) / max) * 100 : 0; // nilai peserta (persen) untuk daya beda
    for (const { it, g } of graded) {
      const e = byItem.get(String(it.qid)) ?? { item: it, obs: [] };
      const a2 = ans.get(String(it.qid));
      e.obs.push({ frac: g.pending ? null : g.max > 0 ? g.earned / g.max : 0, total, answered: g.answered, choice: (it.kind ?? "mcq") === "mcq" && a2?.choice != null ? a2.choice : null });
      byItem.set(String(it.qid), e);
    }
  }
  const rows: ItemRow[] = [...byItem.values()].map(({ item, obs }) => {
    const scored = obs.filter((o) => o.frac !== null);
    const p = scored.length >= MIN_FOR_P ? r2(scored.reduce((n, o) => n + (o.frac as number), 0) / scored.length) : null;
    let discrimination: number | null = null;
    if (scored.length >= MIN_FOR_D) {
      const sorted = [...scored].sort((a, b) => b.total - a.total), k = Math.max(1, Math.round(sorted.length * 0.27));
      const mean = (xs: Obs[]) => xs.reduce((n, o) => n + (o.frac as number), 0) / xs.length;
      discrimination = r2(mean(sorted.slice(0, k)) - mean(sorted.slice(-k)));
    }
    const answered = obs.filter((o) => o.answered).length;
    const flags: ItemRow["flags"] = [];
    if (scored.length >= MIN_FOR_FLAGS) {
      if (p !== null && p > 0.9) flags.push("too_easy");
      if (p !== null && p < 0.2) flags.push("too_hard");
      if (discrimination !== null && discrimination < 0) flags.push("negative_discrimination");
      else if (discrimination !== null && discrimination < 0.2) flags.push("weak_discrimination");
      if (answered / obs.length < 0.7) flags.push("many_blank");
    }
    let distribution: number[] | null = null;
    if ((item.kind ?? "mcq") === "mcq") {
      const n = Math.max(item.options ?? 0, ...obs.map((o) => (o.choice ?? -1) + 1), 0);
      distribution = Array.from({ length: n }, (_, i) => obs.filter((o) => o.choice === i).length);
    }
    return { qid: String(item.qid), stem: item.stem ?? "", kind: item.kind ?? "mcq", section: item.section ?? null, declared: item.declared ?? null, used: obs.length, answered, p, discrimination, distribution, flags };
  });
  rows.sort((a, b) => (a.p ?? 2) - (b.p ?? 2)); // yang tersulit dulu; tanpa cukup data di akhir
  return { rows, attempts: attempts.length };
}
