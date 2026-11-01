import { SECTION_SHORT } from "@/lib/exam-format";
import { isLearningTopic } from "./topics";

export type TopicRow = { skill: string; topic: string; correct: number; total: number; score: number };
export type BreakdownRow = TopicRow & { delta: number | null; few: boolean };
export type BreakdownGroup = { key: string; label: string; rows: BreakdownRow[]; parts: TopicRow[] };

export const SECTION_LABEL = SECTION_SHORT;
// Soal Structure dan Written Expression ditandai skill "grammar"; ketiganya dipetakan ke section tampilannya.
const SECTION_OF: Record<string, string> = { listening: "listening", grammar: "structure", structure: "structure", reading: "reading" };
const isPart = (topic: string) => /^part-[abc]$/.test(topic);
/** Nama jenis soal dengan sectionnya, karena jenis yang sama (mis. detail, inference) ada di beberapa section. */
export const typeLabel = (skill: string, topic: string) => `${topic} (${SECTION_LABEL[SECTION_OF[skill] ?? skill]})`;
export const partLabel = (topic: string) => `Part ${topic.slice(-1).toUpperCase()}`;

/**
 * Rincian per jenis soal, dikelompokkan per section dan memuat SEMUA jenis soal (tidak dipotong).
 * - Label bagian (part-a/b/c) bukan jenis soal: dipisah ke `parts`.
 * - Label internal (oce, test-NN, written-expression) disaring, termasuk dari percobaan lama.
 * - Urutan: skor terendah dulu; bila seri, yang soalnya lebih banyak dulu (lebih bermakna). Jenis dengan kurang dari 3 soal ditandai `few`.
 */
export function buildBreakdown(topics: TopicRow[], previous?: TopicRow[] | null): BreakdownGroup[] {
  const before = new Map((previous ?? []).map((t) => [`${t.skill}|${t.topic}`, t.score]));
  // Bagian format bawaan tampil lebih dulu dan berurutan; bagian lain mengikuti urutan kemunculannya.
  const groups: BreakdownGroup[] = ["listening", "structure", "reading"].map((key) => ({ key, label: SECTION_LABEL[key], rows: [], parts: [] }));
  for (const t of topics) {
    if (!t.skill || !t.topic || !isLearningTopic(t)) continue;
    const key = SECTION_OF[t.skill] ?? t.skill;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, label: SECTION_LABEL[key], rows: [], parts: [] }; groups.push(g); }
    if (isPart(t.topic)) { g.parts.push(t); continue; }
    const b = before.get(`${t.skill}|${t.topic}`);
    g.rows.push({ ...t, delta: b == null ? null : Math.round(t.score - b), few: t.total < 3 });
  }
  for (const g of groups) {
    g.rows.sort((a, b) => a.score - b.score || b.total - a.total || a.topic.localeCompare(b.topic));
    g.parts.sort((a, b) => a.topic.localeCompare(b.topic));
  }
  return groups.filter((g) => g.rows.length || g.parts.length);
}
