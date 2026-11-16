import { questionSchema } from "./admin-schemas";
import { SECTION_KEY_RE } from "./exam-format";
import { QUESTION_KINDS, type QuestionKind } from "./question-kinds";

// Impor soal dari CSV/Excel (MTS §6, Bank Soal). Bagian murni: memetakan baris tabel ke input soal yang divalidasi questionSchema.
const ALIASES: Record<string, string[]> = {
  section: ["section", "bagian", "seksi"],
  type: ["type", "tipe", "question type", "jenis"],
  stem: ["stem", "soal", "pertanyaan", "question text"],
  answer: ["answer", "jawaban", "kunci", "answer key"],
  explanation: ["explanation", "pembahasan", "penjelasan"],
  difficulty: ["difficulty", "kesulitan", "level kesulitan"],
  tags: ["tags", "tag", "topik"],
  status: ["status"],
  // Listening: nama persis audio yang SUDAH diunggah di Audio Library. Baris dengan judul audio yang sama
  // dikelompokkan menjadi satu grup (satu audio dipakai beberapa soal), dicocokkan di route (butuh DB).
  audio: ["audio", "audio title", "listening audio", "judul audio"],
  instruction: ["instruction", "group instruction", "audio instruction", "instruksi"],
  kind: ["kind", "jenis soal", "question kind"],
  points: ["points", "poin", "skor"],
  pairs: ["pairs", "pasangan"],
  accepted: ["accepted", "jawaban diterima", "accepted answers"],
  rubric: ["rubric", "rubrik"],
  guide: ["guide", "panduan", "answer guide"],
  maxwords: ["maxwords", "max words", "maks kata"],
};
const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];
const DIFF: Record<string, "easy" | "medium" | "hard"> = { easy: "easy", mudah: "easy", medium: "medium", sedang: "medium", hard: "hard", sulit: "hard" };
const SECT: Record<string, string> = { "structure & written expression": "structure", "written expression": "structure" };
const KIND: Record<string, QuestionKind> = { mcq: "mcq", "pilihan ganda": "mcq", "multiple choice": "mcq", matching: "matching", mencocokkan: "matching", short: "short", isian: "short", "short answer": "short", essay: "essay", esai: "essay", uraian: "essay" };
/** Nama bagian atau tag bebas: huruf kecil, spasi dan tanda baca jadi garis bawah (mis. "Struktur Data" jadi "struktur_data"). */
export const slugTag = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const QUESTION_TEMPLATE_HEADER = ["section", "type", "stem", "A", "B", "C", "D", "answer", "explanation", "difficulty", "tags", "status", "audio", "instruction", "kind", "points", "pairs", "accepted", "rubric", "guide"];
export const QUESTION_TEMPLATE_EXAMPLE = ["structure", "subject-verb", "The results of the study ___ clear.", "is", "are", "was", "be", "B", "The plural subject 'results' takes 'are'.", "medium", "structure:subject-verb agreement", "draft", "", "", "mcq", "1", "", "", "", ""];
// Exemple baris listening: isi kolom "audio" dengan judul persis sebuah audio yang sudah ada di Audio Library.
export const QUESTION_TEMPLATE_AUDIO_EXAMPLE = ["listening", "detail", "What does the man want to do this weekend?", "Go hiking", "Go fishing", "Stay home", "Visit family", "A", "", "medium", "listening:detail", "draft", "Campus Tour (sample)", "Listen to the conversation and answer the question.", "mcq", "1", "", "", "", ""];
// Contoh jenis lain: pasangan "kiri=kanan; kiri=kanan", jawaban diterima dipisah "|", rubrik "kriteria:poin; kriteria:poin".
export const QUESTION_TEMPLATE_EXTRA_EXAMPLES = [
  ["struktur_data", "pasangan", "Pasangkan struktur data dengan sifatnya.", "", "", "", "", "", "", "medium", "struktur-data:dasar", "draft", "", "", "matching", "2", "Stack=LIFO; Queue=FIFO", "", "", ""],
  ["struktur_data", "isian", "Struktur data dengan urutan LIFO disebut ...", "", "", "", "", "", "", "easy", "struktur-data:stack", "draft", "", "", "short", "1", "", "stack|tumpukan", "", ""],
  ["struktur_data", "uraian", "Jelaskan perbedaan array dan linked list.", "", "", "", "", "", "", "medium", "struktur-data:dasar", "draft", "", "", "essay", "10", "", "", "Konsep:5; Contoh:3; Kejelasan:2", "Bandingkan akses acak dan penyisipan."],
];

export type QuestionRowResult = { row: number; ok: true; data: ReturnType<typeof questionSchema.parse>; audioTitle?: string; groupInstruction?: string } | { row: number; ok: false; error: string };

/** Format kolom tag: "skill:topic; skill:topic". Tag tanpa titik dua dianggap topik pada skill = section soal. */
export function parseTags(raw: string, section: string) {
  return raw.split(/[;|]/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const [a, ...rest] = t.split(":");
    return rest.length ? { skill: a.trim().toLowerCase(), topic: rest.join(":").trim() } : { skill: section, topic: a.trim() };
  });
}

export function mapQuestionRows(table: string[][], ctx: { section?: string; categoryId?: string | null; collectionId?: string | null } = {}): QuestionRowResult[] {
  const head = new Map(table[0].map((h, i) => [h.toLowerCase().trim(), i] as const));
  const col = (k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).find((x) => x !== undefined);
  const opt = OPTION_LETTERS.map((l) => head.get(l) ?? head.get(`pilihan ${l}`) ?? head.get(`option ${l}`));
  const need = (["stem"] as const).filter((k) => col(k) === undefined).concat(col("section") === undefined && !ctx.section ? (["section"] as never[]) : []);
  if (need.length) return [{ row: 1, ok: false, error: `Required columns not found: ${need.join(", ")}` }];

  return table.slice(1).map((r, i) => {
    const row = i + 2, get = (k: keyof typeof ALIASES) => (col(k) !== undefined ? (r[col(k)!] ?? "").trim() : "");
    const rawSection = get("section") || ctx.section || "";
    const section = SECT[rawSection.toLowerCase()] ?? slugTag(rawSection);
    if (!SECTION_KEY_RE.test(section)) return { row, ok: false as const, error: `Invalid category/section "${rawSection}" (use 2 to 32 letters, digits, or underscores, starting with a letter)` };
    const kind = get("kind") ? KIND[get("kind").toLowerCase()] : "mcq";
    if (!kind || !QUESTION_KINDS.includes(kind)) return { row, ok: false as const, error: `Unknown kind "${get("kind")}" (mcq, matching, short, essay)` };
    const options = opt.map((c) => (c !== undefined ? (r[c] ?? "").trim() : "")).filter((o, idx, arr) => o && arr.slice(0, idx).every(Boolean));
    const ans = get("answer").toUpperCase();
    const answerKey = /^[A-F]$/.test(ans) ? ans.charCodeAt(0) - 65 : /^[1-6]$/.test(ans) ? Number(ans) - 1 : -1;
    if (kind === "mcq" && answerKey < 0) return { row, ok: false as const, error: `Invalid answer key "${get("answer")}" (A-F)` };
    const diff = get("difficulty") ? DIFF[get("difficulty").toLowerCase()] : "medium";
    if (!diff) return { row, ok: false as const, error: `Unknown difficulty "${get("difficulty")}" (easy/medium/hard)` };
    const status = (get("status").toLowerCase() || "draft") as "draft" | "review" | "published";
    const audioTitle = get("audio").trim();
    if (audioTitle && section !== "listening") return { row, ok: false as const, error: `An audio title was given but section is "${section}", not listening` };
    const points = get("points") ? Number(get("points").replace(",", ".")) : 1;
    if (!Number.isFinite(points)) return { row, ok: false as const, error: `Invalid points "${get("points")}"` };
    let key: unknown;
    if (kind === "matching") key = { pairs: get("pairs").split(/[;\n]/).map((p) => p.trim()).filter(Boolean).map((p) => { const k = p.indexOf("="); return { left: p.slice(0, Math.max(k, 0)).trim(), right: p.slice(k + 1).trim() }; }) };
    if (kind === "short") key = { accepted: get("accepted").split(/[|;\n]/).map((a) => a.trim()).filter(Boolean) };
    if (kind === "essay") {
      const rub = get("rubric") ? get("rubric").split(/[;\n]/).map((c) => c.trim()).filter(Boolean).map((c) => { const k = c.lastIndexOf(":"); return { criterion: c.slice(0, Math.max(k, 0)).trim(), points: Number(c.slice(k + 1).replace(",", ".")) }; }) : [{ criterion: "Answer quality", points }];
      key = { rubric: rub, guide: get("guide") || undefined, maxWords: get("maxwords") ? Number(get("maxwords")) : undefined };
    }
    const parsed = questionSchema.safeParse({
      section, type: get("type") || "umum", stem: get("stem"), kind, points, options: kind === "mcq" ? options : [], answerKey: kind === "mcq" ? answerKey : undefined, key, explanation: get("explanation") || undefined,
      difficulty: diff, tags: parseTags(get("tags"), section), status, categoryId: ctx.categoryId ?? null, collectionId: ctx.collectionId ?? null,
    });
    return parsed.success
      ? { row, ok: true as const, data: parsed.data, audioTitle: audioTitle || undefined, groupInstruction: get("instruction").trim() || undefined }
      : { row, ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid row" };
  });
}
