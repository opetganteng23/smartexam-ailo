// Format ujian: satu-satunya tempat yang tahu nama bagian tes. UI, skor, dan analitik membaca dari sini, bukan menulis
// "Listening"/"Structure" sendiri. TOEFL ITP adalah format bawaan; format lain (mapel umum) ditambahkan sebagai ExamFormat baru.
export type SectionDef = { key: string; label: string; short: string };
export type PartDef = { key: string; label: string; section: string };
export type ExamFormat = { id: string; name: string; sections: readonly SectionDef[]; parts: readonly PartDef[] };

/** Nama bagian tes: huruf kecil, angka, garis bawah (mis. "listening", "math", "section_a"). Bagian ditentukan oleh isi soal dan tes, bukan daftar tetap. */
export const SECTION_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;
export type Section = string;
/** Bagian format TOEFL ITP (format bawaan). Dipakai kode khusus ITP dan kerangka course; bukan batas bagi tes lain. */
export const SECTIONS = ["listening", "structure", "reading"] as const;
export type ItpSection = (typeof SECTIONS)[number];
export const COURSE_PARTS = ["listening_a", "listening_b", "listening_c", "structure", "written_expression", "reading"] as const;
export type CoursePart = (typeof COURSE_PARTS)[number];

export const TOEFL_ITP: ExamFormat = {
  id: "toefl-itp",
  name: "TOEFL ITP",
  sections: [
    { key: "listening", label: "Listening", short: "Listening" },
    { key: "structure", label: "Structure & Written Expression", short: "Structure & WE" },
    { key: "reading", label: "Reading", short: "Reading" },
  ],
  parts: [
    { key: "listening_a", label: "Listening Part A", section: "listening" },
    { key: "listening_b", label: "Listening Part B", section: "listening" },
    { key: "listening_c", label: "Listening Part C", section: "listening" },
    { key: "structure", label: "Structure", section: "structure" },
    { key: "written_expression", label: "Written Expression", section: "structure" },
    { key: "reading", label: "Reading", section: "reading" },
  ],
};

export const DEFAULT_FORMAT = TOEFL_ITP;

const pretty = (k: string) => k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
/** Tabel label; kunci yang tidak ada di format bawaan tampil sebagai nama yang dirapikan ("math_a" jadi "Math a"). */
const labels = (base: Record<string, string>): Record<string, string> =>
  new Proxy(base, { get: (t, k) => (typeof k === "string" && !(k in t) && !(k in Object.prototype) ? pretty(k) : (t as Record<string | symbol, string>)[k]) });

/** Nama pendek bagian untuk tabel dan grafik. */
export const SECTION_SHORT = labels(Object.fromEntries(DEFAULT_FORMAT.sections.map((s) => [s.key, s.short])));
/** Nama bagian lengkap. */
export const SECTION_NAME = labels(Object.fromEntries(DEFAULT_FORMAT.sections.map((s) => [s.key, s.label])));
/** Nama sub-bagian (part) course. */
export const PART_LABEL = labels(Object.fromEntries(DEFAULT_FORMAT.parts.map((p) => [p.key, p.label])));
