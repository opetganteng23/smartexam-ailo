import { describe, it, expect, afterAll } from "vitest";

// Ujian dengan empat jenis soal dijalankan sungguhan terhadap MongoDB in-memory: submit, essay menahan hasil, dinilai, skor dihitung ulang dan dirilis.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("alur ujian campuran dan penilaian essay", () => {
  it("pilihan ganda, mencocokkan, isian, dan essay dinilai; essay menahan hasil sampai dinilai", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri();
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Question } = await import("@/models/Question");
    const { Test, Attempt } = await import("@/models/Test");
    const { finalize } = await import("@/lib/attempts");
    const { saveEssayGrade, essaysForGrading } = await import("@/lib/essay-grading");
    const { isReleased } = await import("@/lib/attempt-release");

    const tag = [{ skill: "math", topic: "mixed" }];
    const mk = (d: Record<string, unknown>) => (Question as unknown as { create: (x: unknown) => Promise<{ _id: unknown }> }).create({ section: "math", type: "mixed", tags: tag, status: "published", ...d });
    const mcq = await mk({ stem: "1+1?", options: ["1", "2", "3"], answerKey: 1 });
    const match = await mk({ kind: "matching", points: 4, stem: "Pasangkan", key: { pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "c", right: "3" }, { left: "d", right: "4" }], partial: true } });
    const short = await mk({ kind: "short", points: 2, stem: "Ibu kota?", key: { accepted: ["Jakarta"] } });
    const essay = await mk({ kind: "essay", points: 10, stem: "Jelaskan", key: { rubric: [{ criterion: "Isi", points: 6 }, { criterion: "Bahasa", points: 4 }] } });

    const ids = [mcq, match, short, essay].map((q) => q._id);
    const test = await Test.create({ name: "Campuran", kind: "practice", sections: [{ name: "math", durationSec: 1800, questionIds: ids }] });
    const now = new Date();
    const userId = new (await import("mongoose")).Types.ObjectId();
    const attempt = await Attempt.create({
      userId, testId: test._id, kind: "practice", startedAt: now, sectionStartedAt: now,
      answers: [
        { qid: mcq._id, choice: 1 },
        { qid: match._id, response: [0, 1, 3, 2] },          // 2 dari 4 pasangan benar
        { qid: short._id, response: " jakarta " },
        { qid: essay._id, response: "Jawaban essay saya." },
      ],
    });
    await finalize(attempt as never, test as never);

    // 1 poin + 2 poin (sebagian) + 2 poin = 5 dari 17 sementara; essay (10 poin) belum dinilai
    let a = await Attempt.findById(attempt._id);
    expect(a!.status).toBe("submitted");
    expect(a!.gradingStatus).toBe("pending");
    expect(a!.essayPending).toBe(1);
    expect(a!.scoreRaw).toBe(5);
    expect(a!.sectionScores[0]).toMatchObject({ section: "math", raw: 5, total: 17 });
    expect(isReleased(a!)).toBe(false); // hasil ditahan
    expect((await essaysForGrading(String(attempt._id))).items).toHaveLength(1);

    // nilai di luar rentang ditolak
    await expect(saveEssayGrade({ attemptId: String(attempt._id), qid: String(essay._id), points: 11, graderId: userId })).rejects.toThrow(/between 0 and 10/);

    const r = await saveEssayGrade({ attemptId: String(attempt._id), qid: String(essay._id), points: 7.5, feedback: "Bagus", graderId: userId });
    expect(r).toMatchObject({ pending: 0, done: true });
    a = await Attempt.findById(attempt._id);
    expect(a!.gradingStatus).toBe("done");
    expect(a!.essayPending).toBe(0);
    expect(a!.scoreRaw).toBe(12.5); // 1 + 2 + 2 + 7.5
    expect(a!.sectionScores[0]).toMatchObject({ raw: 12.5, total: 17 });
    expect(isReleased(a!)).toBe(true); // dirilis setelah semua essay dinilai
    expect(a!.answers.find((x) => String(x.qid) === String(essay._id))).toMatchObject({ points: 7.5, feedback: "Bagus" });
    delete process.env.MONGODB_URI;
  });
});
