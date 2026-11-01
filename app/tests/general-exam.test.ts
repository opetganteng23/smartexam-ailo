import { describe, it, expect, afterAll } from "vitest";

// Ujian umum non-ITP dijalankan utuh terhadap MongoDB in-memory: seed, mengerjakan, submit, essay dinilai, lulus/tidak.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("ujian umum (Matematika dan Logika)", () => {
  it("seed valid dan idempoten; skor persen, batas lulus, dan essay bekerja", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri();
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { seedGeneralExam, GENERAL_TEST_NAME } = await import("@/lib/seed-general");
    const { Test, Attempt } = await import("@/models/Test");
    const { Question } = await import("@/models/Question");
    const { finalize } = await import("@/lib/attempts");
    const { saveEssayGrade } = await import("@/lib/essay-grading");
    const { Types } = await import("mongoose");

    const r1 = await seedGeneralExam();
    expect(r1.generalQuestions).toBe(12);
    expect(await seedGeneralExam()).toEqual({ generalSkipped: true });

    const test = (await Test.findOne({ name: GENERAL_TEST_NAME }))!;
    expect(test.sections.map((s) => s.name)).toEqual(["math", "logic"]);
    const qs = await Question.find({ _id: { $in: test.sections.flatMap((s) => s.questionIds) } });
    const byStem = (part: string) => qs.find((q) => q.stem.includes(part))!;

    // jawaban benar semua kecuali satu pilihan ganda dan separuh pasangan; essay dijawab
    const answers = qs.map((q) => {
      const kind = q.kind ?? "mcq";
      if (kind === "mcq") return { qid: q._id, choice: q.stem.startsWith("Berapa hasil") ? 0 : q.answerKey };
      if (kind === "matching") { const n = (q.key as { pairs: unknown[] }).pairs.length; return { qid: q._id, response: q.points === 4 ? [0, 1, 3, 2] : Array.from({ length: n }, (_, i) => i) }; }
      if (kind === "short") return { qid: q._id, response: (q.key as { accepted: string[] }).accepted[0] };
      return { qid: q._id, response: "Keberagaman justru mempersatukan kita, contohnya gotong royong." };
    });
    const now = new Date();
    const attempt = await Attempt.create({ userId: new Types.ObjectId(), testId: test._id, kind: "practice", startedAt: now, sectionStartedAt: now, answers });
    await finalize(attempt as never, test as never);

    let a = (await Attempt.findById(attempt._id))!;
    expect(a).toMatchObject({ scoreScale: "percent", passMark: 60, gradingStatus: "pending", essayPending: 1 });
    expect(a.sectionScores.map((s) => s.section)).toEqual(["math", "logic"]);
    expect(a.sectionScores[0].total).toBe(4 + 4 + 2 + 2 + 2); // 4 pilihan ganda (1) + 4 + 2 + 2 + 2 poin
    expect(a.sectionScores[1].total).toBe(3 + 10);

    // nilai essay penuh lalu hitung ulang
    const essay = byStem("Bhinneka");
    const done = await saveEssayGrade({ attemptId: String(attempt._id), qid: String(essay._id), points: 9, graderId: new Types.ObjectId() });
    expect(done).toMatchObject({ pending: 0, done: true });
    a = (await Attempt.findById(attempt._id))!;
    // diperoleh: math = 3 (3 mcq benar) + 2 (pasangan sebagian: 2 dari 4 -> 2) + 2 + 2 + 2 = 11 dari 14; logic = 3 + 9 = 12 dari 13
    expect(a.sectionScores[0]).toMatchObject({ raw: 11, total: 14, scaled: 79 });
    expect(a.sectionScores[1]).toMatchObject({ raw: 12, total: 13, scaled: 92 });
    expect(a.scoreEst).toBe(85); // 23/27
    expect(a.passed).toBe(true);
    expect(a.gradingStatus).toBe("done");
    delete process.env.MONGODB_URI;
  });
});
