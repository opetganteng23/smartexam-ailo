import { createHash } from "crypto";

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Sidik isi soal (jenis, teks, opsi dan kunci) untuk mendeteksi duplikat. Tidak peka huruf besar, spasi, atau urutan opsi pilihan ganda. */
export function questionHash(q: { kind?: string | null; stem: string; options?: string[]; answerKey?: number | null; key?: unknown }) {
  const kind = q.kind ?? "mcq";
  let body: unknown;
  if (kind === "mcq") {
    const opts = (q.options ?? []).map(norm);
    body = { o: [...opts].sort(), a: q.answerKey != null ? opts[q.answerKey] : null };
  } else body = JSON.parse(JSON.stringify(q.key ?? null, (_k, v) => (typeof v === "string" ? norm(v) : v)));
  return createHash("sha256").update(JSON.stringify({ k: kind, s: norm(q.stem), b: body })).digest("hex");
}
