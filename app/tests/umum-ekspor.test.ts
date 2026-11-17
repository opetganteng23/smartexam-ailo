import { describe, it, expect, afterAll } from "vitest";

// U7.2: ekspor Excel tes umum (skala persen) tidak memuat level, skala, atau istilah ITP.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("ekspor Excel tes umum (database in-memory)", () => {
  it("skor persen, tanpa nama level ITP, data bar 0-100, dan tanpa istilah ITP", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_ekspor_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const ExcelJS = (await import("exceljs")).default;
    const { User } = await import("@/models/User");
    const { Question } = await import("@/models/Question");
    const { Test, Attempt } = await import("@/models/Test");
    const { getLevels } = await import("@/lib/config");
    const { buildTestExport } = await import("@/lib/test-export");
    await getLevels(); // level ITP bawaan ada di database, tetapi tidak boleh bocor ke tes umum

    const q = await Question.create({ section: "struktur_data", type: "x", stem: "S", options: ["a", "b"], answerKey: 0, status: "published" });
    const test = await Test.create({ name: "UTS Struktur Data", kind: "general", purpose: "midterm", sections: [{ name: "bagian_1", durationSec: 600, questionIds: [q._id] }] });
    const scores = [72, 55, 90];
    for (const [i, sc] of scores.entries()) {
      const u = await User.create({ email: `p${i}@t.id`, name: `Peserta ${i}`, role: "participant", status: "active" });
      await Attempt.create({ userId: u._id, testId: test._id, kind: "general", status: "submitted", startedAt: new Date(), finishedAt: new Date(), sectionStartedAt: new Date(), scoreEst: sc, scoreScale: "percent", sectionScores: [{ section: "bagian_1", raw: 1, total: 1, scaled: sc }] });
    }

    const out = await buildTestExport(String(test._id));
    expect(out).toBeTruthy();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out!.buffer as never);

    // Kolom Level kosong untuk semua peserta (skor persen tidak dipetakan ke level ITP).
    const res = wb.getWorksheet("Results")!;
    const header = (res.getRow(1).values as unknown[]).map((v) => String(v ?? ""));
    const lvCol = header.indexOf("Level"), scoreCol = header.indexOf("Total score");
    expect(lvCol).toBeGreaterThan(0);
    const got: { score: unknown; level: unknown }[] = [];
    res.eachRow((row, i) => { if (i > 1) got.push({ score: row.getCell(scoreCol).value, level: row.getCell(lvCol).value }); });
    expect(got.map((g) => g.score).sort()).toEqual([55, 72, 90]);
    expect(got.every((g) => g.level == null || g.level === "")).toBe(true);

    // Data bar Total score memakai 0-100, bukan 310-677.
    const cf = JSON.stringify((res as unknown as { conditionalFormattings: unknown }).conditionalFormattings);
    expect(cf).toContain('"value":100');
    expect(cf).not.toContain("677");

    // Tidak ada istilah ITP di sheet mana pun.
    const text: string[] = [];
    wb.eachSheet((ws) => { text.push(ws.name); ws.eachRow((row) => row.eachCell((c) => { if (c.value != null) text.push(String(typeof c.value === "object" ? JSON.stringify(c.value) : c.value)); })); });
    const bad = text.filter((t) => /TOEFL|\bITP\b|\bCEFR\b|\bBasic\b|\bIntermediate\b|\bAdvanced\b|\b677\b|\b310\b/.test(t));
    expect(bad).toEqual([]);
  });
});
