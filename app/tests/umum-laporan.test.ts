import { describe, it, expect, afterAll } from "vitest";
import JSZip from "jszip";

// U7.2: laporan PPTX untuk tes umum (skala persen, bagian bebas) tanpa istilah ITP.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("ringkasan eksekutif tes umum (database in-memory)", () => {
  it("deck PPTX dibuat dari tes umum persen dan tidak memuat skala atau istilah ITP", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_laporan_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Test, Attempt } = await import("@/models/Test");
    const { buildExecSummary } = await import("@/lib/exec-summary");

    const I = await Institution.create({ name: "Telkom University Jakarta", code: "TUJ" });
    const test = await Test.create({ name: "UTS Struktur Data", kind: "general", purpose: "midterm", sections: [{ name: "pilgan", durationSec: 1800, questionIds: [new Types.ObjectId()] }, { name: "essay", durationSec: 1800, questionIds: [new Types.ObjectId()] }] });
    const scores = [95, 72, 60, 41, 18];
    for (const [i, s] of scores.entries()) {
      const u = await User.create({ email: `p${i}@t.id`, name: `Peserta ${i}`, role: "participant", status: "active", institutionId: I._id });
      await Attempt.create({
        userId: u._id, institutionId: I._id, testId: test._id, kind: "general", status: "submitted", startedAt: new Date(Date.now() - 3600_000), finishedAt: new Date(), sectionStartedAt: new Date(),
        scoreEst: s, scoreScale: "percent", passed: s >= 60, passMark: 60, sectionScores: [{ section: "pilgan", raw: s / 10, total: 10, scaled: s }, { section: "essay", raw: s / 10, total: 10, scaled: s }],
      });
    }
    const deck = await buildExecSummary(String(test._id));
    expect(deck).toBeTruthy();
    expect(deck!.buffer.subarray(0, 2).toString()).toBe("PK"); // berkas pptx = zip
    const zip = await JSZip.loadAsync(deck!.buffer);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides.length).toBeGreaterThanOrEqual(2);
    const text = (await Promise.all(slides.map((f) => zip.files[f].async("string")))).join(" ");
    expect(text).toContain("UTS Struktur Data");
    expect(text).not.toMatch(/\b(310|677|CEFR|TOEFL|Listening|Structure)\b/);
    expect(await buildExecSummary(String(new Types.ObjectId()))).toBeNull(); // tes tidak ada
  });
});
