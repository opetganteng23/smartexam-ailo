import { describe, it, expect, afterAll } from "vitest";
import { SECTION_SHORT, SECTION_NAME, PART_LABEL, SECTION_KEY_RE } from "@/lib/exam-format";
import { validateTables, previewScore, toConversion } from "@/lib/scoring-profiles";
import { scaleSection, gradePoints, estimateTotal, scaleOf, totalRange } from "@/lib/scoring";
import { profileInput } from "@/lib/scoring-schemas";
import { buildBreakdown, typeLabel } from "@/lib/breakdown";

// Bagian tes ditentukan data, bukan daftar tetap TOEFL ITP: mapel lain (mis. matematika) harus bisa dipakai.
const safe = !process.env.MONGODB_URI;
const tbl = (rows: [number, number][]) => Object.fromEntries(rows.map(([r, s]) => [String(r), s]));

describe("nama bagian", () => {
  it("pola nama: huruf kecil, angka, garis bawah", () => {
    for (const ok of ["math", "logic", "section_a", "listening", "ipa2"]) expect(SECTION_KEY_RE.test(ok), ok).toBe(true);
    for (const bad of ["", "a", "Math", "1math", "has space", "a-b", "x".repeat(40)]) expect(SECTION_KEY_RE.test(bad), bad).toBe(false);
  });
  it("label format bawaan tetap, bagian lain dirapikan dari kuncinya", () => {
    expect(SECTION_SHORT.structure).toBe("Structure & WE");
    expect(SECTION_NAME.structure).toBe("Structure & Written Expression");
    expect(PART_LABEL.listening_a).toBe("Listening Part A");
    expect(SECTION_SHORT.math).toBe("Math");
    expect(SECTION_SHORT.section_a).toBe("Section a");
    expect(Object.keys(SECTION_SHORT)).toEqual(["listening", "structure", "reading"]);
  });
});

describe("tabel konversi untuk bagian di luar ITP", () => {
  const math = { math: tbl([[0, 31], [1, 40], [2, 50]]), logic: tbl([[0, 31], [1, 45]]) };
  it("tabel lengkap lolos dan tabel kosong ditolak per bagian", () => {
    expect(validateTables("table", 31, 68, math)).toEqual({ errors: [], warnings: [] });
    expect(validateTables("table", 31, 68, { ...math, logic: {} }).errors.join(" ")).toMatch(/logic: the table is empty/);
  });
  it("skor per bagian membaca tabel bagian itu sendiri", () => {
    const conv = { mode: "table" as const, scaledMin: 31, scaledMax: 68, tables: math };
    expect(scaleSection(conv, "math", 2, 10)).toBe(50);
    expect(scaleSection(conv, "logic", 1, 10)).toBe(45);
    expect(previewScore(conv, [{ section: "math", raw: 1, total: 10 }, { section: "logic", raw: 0, total: 5 }]).sections.map((s) => s.scaled)).toEqual([40, 31]);
  });
  it("masukan profil menerima kunci bagian bebas, menolak nama yang buruk", () => {
    expect(profileInput.safeParse({ name: "Mapel umum", tables: math }).success).toBe(true);
    expect(profileInput.safeParse({ name: "Mapel umum", tables: { "Bad Key": {} } }).success).toBe(false);
    expect(profileInput.parse({ name: "Tanpa tabel" }).tables).toEqual({});
  });
  it("toConversion mengubah Map bersarang menjadi objek biasa", () => {
    const conv = toConversion({ mode: "table", scaledMin: 31, scaledMax: 68, tables: new Map([["math", new Map([["1", 40]])]]) } as never);
    expect(conv.tables).toEqual({ math: { "1": 40 } });
  });
});

describe("model menerima bagian bebas (validasi, tanpa database)", () => {
  it("Question, Test, dan Course memakai pola nama, bukan enum", async () => {
    const { Question, QuestionGroup } = await import("@/models/Question");
    const { Test } = await import("@/models/Test");
    const { Course } = await import("@/models/Course");
    const check = (d: { validate: () => Promise<void> }) => d.validate().then(() => undefined, (e: { errors: Record<string, unknown> }) => e);
    const q = (section: string) => check(new Question({ section, type: "algebra", stem: "1+1?", options: ["1", "2"], answerKey: 1, tags: [{ skill: "math", topic: "algebra" }] }));
    expect(await q("math")).toBeUndefined();
    expect((await q("Bad Key"))?.errors.section).toBeDefined();
    expect(await check(new QuestionGroup({ section: "math" }))).toBeUndefined();
    const t = (name: string) => check(new Test({ name: "T", kind: "sim", sections: [{ name, durationSec: 600, questionIds: [] }] }));
    expect(await t("math")).toBeUndefined();
    expect(await t("Bad Key")).toBeDefined();
    expect((await check(new Course({ title: "C", part: "math" })))?.errors.part).toBeUndefined();
  });
});

describe("rincian hasil untuk bagian di luar ITP", () => {
  it("jenis soal bagian lain membentuk kelompok sendiri setelah bagian bawaan", () => {
    const topics = [
      { skill: "math", topic: "algebra", correct: 3, total: 5, score: 60 },
      { skill: "math", topic: "geometry", correct: 1, total: 4, score: 25 },
      { skill: "reading", topic: "inference", correct: 4, total: 5, score: 80 },
    ];
    const groups = buildBreakdown(topics);
    expect(groups.map((g) => g.key)).toEqual(["reading", "math"]);
    expect(groups[1].label).toBe("Math");
    expect(groups[1].rows.map((r) => r.topic)).toEqual(["geometry", "algebra"]); // skor terendah dulu
    expect(typeLabel("math", "algebra")).toBe("algebra (Math)");
    expect(typeLabel("grammar", "subject-verb")).toBe("subject-verb (Structure & WE)");
  });
});

describe("skala persen dan batas lulus", () => {
  const pct = { mode: "linear" as const, scaledMin: 31, scaledMax: 68, tables: {}, scale: "percent" as const, passMark: 60 };
  const graded = new Map([["a", { earned: 1, max: 1 }], ["b", { earned: 0, max: 1 }], ["c", { earned: 2.5, max: 4 }]]);
  it("skor bagian dan total berupa persen poin; lulus dibandingkan dengan batas lulus", () => {
    const r = gradePoints(pct, [{ name: "math", questionIds: ["a", "b"] }, { name: "logic", questionIds: ["c"] }], graded);
    expect(r.sectionScores.map((s) => [s.section, s.raw, s.total, s.scaled])).toEqual([["math", 1, 2, 50], ["logic", 2.5, 4, 63]]);
    expect(r).toMatchObject({ scoreEst: 58, scoreScale: "percent", passMark: 60, passed: false, scoreRaw: 3.5 });
    expect(gradePoints({ ...pct, passMark: 55 }, [{ name: "math", questionIds: ["a", "b"] }, { name: "logic", questionIds: ["c"] }], graded).passed).toBe(true);
    expect(gradePoints({ ...pct, passMark: null }, [{ name: "math", questionIds: ["a"] }], graded).passed).toBeNull();
  });
  it("skala ITP tetap bawaan dan total tidak berubah", () => {
    expect(scaleOf({})).toBe("itp");
    expect(estimateTotal([{ section: "x", raw: 0, total: 1, scaled: 31 }])).toBe(310);
    expect(estimateTotal([{ section: "x", raw: 0, total: 0, scaled: 0 }], "percent")).toBe(0);
    expect(totalRange("percent")).toEqual({ min: 0, max: 100, unit: "%" });
    expect(totalRange("itp").max).toBe(677);
  });
});

let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("tabel konversi tersimpan di MongoDB", () => {
  it("Map bersarang untuk bagian bebas tersimpan dan terbaca kembali", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri();
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { ScoringProfile } = await import("@/models/Scoring");
    const make = ScoringProfile as unknown as { create: (d: unknown) => Promise<{ _id: unknown }> };
    const made = await make.create({ name: "Matematika", mode: "table", scale: "percent", passMark: 60, tables: { math: { "0": 31, "1": 44 }, logic: { "0": 31 } } });
    const back = await ScoringProfile.findById(made._id);
    const conv = toConversion(back!);
    expect(conv).toMatchObject({ scale: "percent", passMark: 60 });
    expect(conv.tables).toEqual({ math: { "0": 31, "1": 44 }, logic: { "0": 31 } });
    expect(scaleSection(conv, "math", 1, 10)).toBe(10); // skala persen mengabaikan tabel
    expect(scaleSection({ ...conv, scale: "itp" }, "math", 1, 10)).toBe(44); // skala ITP membaca tabel yang sama
    delete process.env.MONGODB_URI;
  });
});
