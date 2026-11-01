import { describe, it, expect } from "vitest";
import { gradeOne, isAnswered } from "@/lib/grading";
import { validateKey, kindOf } from "@/lib/question-kinds";
import { questionSchema } from "@/lib/admin-schemas";

const matching = { kind: "matching", points: 4, key: { pairs: [{ left: "Jawa", right: "Wayang" }, { left: "Bali", right: "Kecak" }, { left: "Papua", right: "Noken" }, { left: "Aceh", right: "Saman" }] } };

describe("gradeOne: pilihan ganda (tidak berubah)", () => {
  it("benar, salah, kosong; soal lama tanpa kind dianggap pilihan ganda", () => {
    expect(gradeOne({ answerKey: 2 }, { choice: 2 })).toEqual({ earned: 1, max: 1, answered: true, correct: true, pending: false });
    expect(gradeOne({ answerKey: 2 }, { choice: 1 })).toMatchObject({ earned: 0, answered: true, correct: false });
    expect(gradeOne({ answerKey: 2 }, undefined)).toMatchObject({ earned: 0, answered: false, correct: false });
    expect(gradeOne({ kind: "mcq", points: 3, answerKey: 0 }, { choice: 0 }).earned).toBe(3);
    expect(kindOf({})).toBe("mcq");
  });
});

describe("gradeOne: mencocokkan", () => {
  it("nilai sebagian per pasangan", () => {
    expect(gradeOne(matching, { response: [0, 1, 2, 3] })).toMatchObject({ earned: 4, correct: true });
    expect(gradeOne(matching, { response: [0, 1, 3, 2] })).toMatchObject({ earned: 2, correct: false });
    expect(gradeOne(matching, { response: [-1, -1, -1, -1] })).toMatchObject({ earned: 0, answered: false });
    expect(gradeOne(matching, { response: [0, -1, -1, -1] })).toMatchObject({ earned: 1, answered: true });
  });
  it("partial=false: semua benar atau nol", () => {
    const strict = { ...matching, key: { ...matching.key, partial: false } };
    expect(gradeOne(strict, { response: [0, 1, 3, 2] }).earned).toBe(0);
    expect(gradeOne(strict, { response: [0, 1, 2, 3] }).earned).toBe(4);
  });
  it("respons yang bukan larik tidak merusak penilaian", () => {
    expect(gradeOne(matching, { response: "x" }).earned).toBe(0);
  });
});

describe("gradeOne: isian singkat", () => {
  const q = { kind: "short", points: 2, key: { accepted: ["Jakarta", "DKI Jakarta"] } };
  it("tidak peka huruf besar dan spasi berlebih", () => {
    expect(gradeOne(q, { response: "  jakarta " }).earned).toBe(2);
    expect(gradeOne(q, { response: "dki   JAKARTA" }).earned).toBe(2);
    expect(gradeOne(q, { response: "Bandung" })).toMatchObject({ earned: 0, answered: true });
  });
  it("caseSensitive bisa dinyalakan", () => {
    expect(gradeOne({ ...q, key: { accepted: ["H2O"], caseSensitive: true } }, { response: "h2o" }).earned).toBe(0);
    expect(gradeOne({ ...q, key: { accepted: ["H2O"], caseSensitive: true } }, { response: "H2O" }).earned).toBe(2);
  });
});

describe("gradeOne: essay", () => {
  const q = { kind: "essay", points: 10, key: { rubric: [{ criterion: "Isi", points: 6 }, { criterion: "Bahasa", points: 4 }] } };
  it("ada jawaban tanpa nilai = menunggu; kosong = nol tanpa perlu dinilai", () => {
    expect(gradeOne(q, { response: "Esai saya" })).toMatchObject({ earned: 0, pending: true, answered: true });
    expect(gradeOne(q, { response: "   " })).toMatchObject({ earned: 0, pending: false, answered: false });
  });
  it("nilai manusia dipakai dan dibatasi 0..poin soal", () => {
    expect(gradeOne(q, { response: "x", points: 7.5 })).toMatchObject({ earned: 7.5, pending: false, correct: true });
    expect(gradeOne(q, { response: "x", points: 99 }).earned).toBe(10);
    expect(gradeOne(q, { response: "x", points: -3 }).earned).toBe(0);
    expect(gradeOne(q, { response: "x", points: 3 }).correct).toBe(false);
  });
});

describe("isAnswered", () => {
  it("per jenis", () => {
    expect(isAnswered({}, { choice: 0 })).toBe(true);
    expect(isAnswered(matching, { response: [-1, -1] })).toBe(false);
    expect(isAnswered({ kind: "short" }, { response: " " })).toBe(false);
  });
});

describe("validateKey", () => {
  it("pilihan ganda", () => {
    expect(validateKey("mcq", null, 1, { options: ["a", "b"], answerKey: 1 })).toBeNull();
    expect(validateKey("mcq", null, 1, { options: ["a"], answerKey: 0 })).toMatch(/2 to 6/);
    expect(validateKey("mcq", null, 1, { options: ["a", "b"], answerKey: 5 })).toMatch(/correct option/);
  });
  it("mencocokkan", () => {
    expect(validateKey("matching", matching.key, 4)).toBeNull();
    expect(validateKey("matching", { pairs: [{ left: "a", right: "x" }] }, 1)).toMatch(/2 to 12/);
    expect(validateKey("matching", { pairs: [{ left: "a", right: "x" }, { left: "b", right: "X" }] }, 1)).toMatch(/different/);
    expect(validateKey("matching", { pairs: [{ left: "a", right: "x" }, { left: "", right: "y" }] }, 1)).toMatch(/both sides/);
  });
  it("isian singkat dan essay", () => {
    expect(validateKey("short", { accepted: ["a"] }, 1)).toBeNull();
    expect(validateKey("short", { accepted: [] }, 1)).toMatch(/at least one/);
    expect(validateKey("essay", q10(), 10)).toBeNull();
    expect(validateKey("essay", q10(), 8)).toMatch(/add up to 10/);
    expect(validateKey("essay", { rubric: [] }, 1)).toMatch(/rubric/);
  });
});
const q10 = () => ({ rubric: [{ criterion: "Isi", points: 6 }, { criterion: "Bahasa", points: 4 }] });

describe("questionSchema per jenis", () => {
  const base = { section: "math", type: "algebra", stem: "Soal", tags: [{ skill: "math", topic: "algebra" }] };
  it("pilihan ganda lama tetap sah tanpa kind dan poin", () => {
    const r = questionSchema.parse({ ...base, options: ["a", "b", "c"], answerKey: 2 });
    expect(r).toMatchObject({ kind: "mcq", points: 1, answerKey: 2 });
    expect(questionSchema.safeParse({ ...base, options: ["a", "b"], answerKey: 5 }).success).toBe(false);
  });
  it("mencocokkan: kunci dirapikan, opsi dan answerKey dikosongkan", () => {
    const r = questionSchema.parse({ ...base, kind: "matching", points: 2, options: ["x"], answerKey: 1, key: { pairs: [{ left: " A ", right: " 1 " }, { left: "B", right: "2" }] } });
    expect(r.options).toEqual([]); expect(r.answerKey).toBeUndefined();
    expect(r.key).toEqual({ pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }], partial: true });
  });
  it("isian singkat: duplikat dibuang; tanpa jawaban diterima ditolak", () => {
    expect((questionSchema.parse({ ...base, kind: "short", key: { accepted: ["a", " a ", "b"] } }).key as { accepted: string[] }).accepted).toEqual(["a", "b"]);
    expect(questionSchema.safeParse({ ...base, kind: "short", key: { accepted: [] } }).success).toBe(false);
  });
  it("essay: jumlah poin rubrik harus sama dengan poin soal", () => {
    const rubric = [{ criterion: "Isi", points: 6 }, { criterion: "Bahasa", points: 4 }];
    expect(questionSchema.safeParse({ ...base, kind: "essay", points: 10, key: { rubric, maxWords: 300 } }).success).toBe(true);
    const bad = questionSchema.safeParse({ ...base, kind: "essay", points: 8, key: { rubric } });
    expect(bad.success).toBe(false);
  });
});

describe("clampDraft (draf nilai AI)", () => {
  const rubric = [{ criterion: "Isi", points: 6 }, { criterion: "Bahasa", points: 4 }];
  it("nilai dijepit ke maksimum kriteria dan dijumlahkan", async () => {
    const { clampDraft } = await import("@/lib/essay-ai");
    const d = clampDraft({ criteria: [{ criterion: "isi", points: 99 }, { criterion: "Bahasa", points: -5 }], rationale: "  Bagus.  " }, rubric)!;
    expect(d.criteria).toEqual([{ criterion: "Isi", points: 6, max: 6 }, { criterion: "Bahasa", points: 0, max: 4 }]);
    expect(d.points).toBe(6);
    expect(d.rationale).toBe("Bagus.");
  });
  it("kriteria yang tidak dikembalikan model bernilai 0; keluaran rusak ditolak", async () => {
    const { clampDraft } = await import("@/lib/essay-ai");
    expect(clampDraft({ criteria: [{ criterion: "Isi", points: 3 }], rationale: "x" }, rubric)!.points).toBe(3);
    expect(clampDraft({ nope: 1 }, rubric)).toBeNull();
    expect(clampDraft(null, rubric)).toBeNull();
  });
});
