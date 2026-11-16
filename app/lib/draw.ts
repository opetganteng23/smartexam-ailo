import { shuffled } from "./shuffle";

export type DrawSpec = { count: number; topics?: string[]; difficulties?: ("easy" | "medium" | "hard")[] };
type Cand = { _id: unknown; groupId?: unknown; difficulty?: string | null; tags?: { topic: string }[] };

/**
 * Ambil `spec.count` soal acak dari kandidat (soal terbit sebuah koleksi). Soal satu passage/audio dipilih sebagai satu blok.
 * Acak ditentukan benih (id percobaan): memuat ulang tidak mengganti soal, antar percobaan berbeda. Bila kandidat kurang
 * dari `count`, semua dipakai dan `short` melaporkan kekurangannya (tidak gagal diam-diam).
 */
export function drawQuestions<T extends Cand>(cands: T[], spec: DrawSpec, seed: string): { picked: T[]; short: number } {
  const topics = spec.topics?.map((t) => t.toLowerCase());
  const pool = cands.filter((q) => (!spec.difficulties?.length || spec.difficulties.includes(q.difficulty as never)) && (!topics?.length || (q.tags ?? []).some((t) => topics.includes(t.topic.toLowerCase()))));
  const blocks = new Map<string, T[]>();
  for (const q of pool) { const k = q.groupId ? `g:${q.groupId}` : `q:${q._id}`; (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(q); }
  const picked: T[] = [];
  for (const blk of shuffled([...blocks.values()], seed)) {
    if (picked.length >= spec.count) break;
    if (picked.length + blk.length <= spec.count) picked.push(...blk);
  }
  return { picked, short: Math.max(0, spec.count - picked.length) };
}
