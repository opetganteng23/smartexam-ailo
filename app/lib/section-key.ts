import { DEFAULT_FORMAT, SECTION_KEY_RE } from "./exam-format";

// Fungsi murni (aman dipakai di klien) untuk kunci bagian soal. Logika yang menyentuh database ada di lib/question-bank.ts.

/** Kunci bagian format TOEFL ITP; soal bagian ini tetap boleh tanpa bank soal. */
export const ITP_SECTION_KEYS: string[] = DEFAULT_FORMAT.sections.map((s) => s.key);
export const isItpSection = (section?: string | null) => !!section && ITP_SECTION_KEYS.includes(section);

/** Nama mata pelajaran menjadi kunci bagian yang sah (huruf kecil, angka, garis bawah; 2 sampai 32 karakter). */
export function sectionFromSubject(name?: string | null): string {
  const slug = (name ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "").slice(0, 32).replace(/_+$/, "");
  return SECTION_KEY_RE.test(slug) ? slug : "umum";
}
