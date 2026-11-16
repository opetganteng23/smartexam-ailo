import { describe, it, expect, afterAll, vi } from "vitest";
import { computeItemStats, type StatAttempt, type StatItem } from "@/lib/item-stats";

const mcq = (qid: string, extra: Partial<StatItem> = {}): StatItem => ({ qid, kind: "mcq", points: 1, answerKey: 0, stem: `Soal ${qid}`, options: 4, ...extra });

// 40 peserta: indeks 0-19 kuat, 20-39 lemah. A mudah, B sulit, C membedakan, D terbalik, E sering kosong.
function cohort(): StatAttempt[] {
  const items = [mcq("A"), mcq("B"), mcq("C"), mcq("D"), mcq("E"), mcq("F")];
  return Array.from({ length: 40 }, (_, i) => {
    const strong = i < 20;
    const ans = (qid: string, correct: boolean | null, wrong = 1) => (correct === null ? [] : [{ qid, choice: correct ? 0 : wrong }]);
    return {
      items,
      answers: [
        ...ans("A", true), // semua benar
        ...ans("B", i === 0 ? true : false, 2), // hampir semua salah (pilih C)
        ...ans("C", strong), // kuat benar, lemah salah
        ...ans("D", !strong), // lemah benar, kuat salah
        ...ans("E", i % 4 === 0 ? true : null), // 75% kosong
        ...ans("F", strong), // penentu kemampuan: kuat benar, lemah salah (agar total kuat > lemah)
      ],
    };
  });
}

describe("statistik butir soal (murni)", () => {
  const { rows, attempts } = computeItemStats(cohort());
  const row = (q: string) => rows.find((r) => r.qid === q)!;
  it("kesulitan nyata, pemakaian, dan sebaran pilihan", () => {
    expect(attempts).toBe(40);
    expect(row("A")).toMatchObject({ used: 40, answered: 40, p: 1 });
    expect(row("B").p).toBe(0.03); // 1 dari 40 (dibulatkan 2 desimal)
    expect(row("C").p).toBe(0.5);
    expect(row("B").distribution).toEqual([1, 0, 39, 0]);
    expect(row("A").distribution).toEqual([40, 0, 0, 0]);
  });
  it("daya beda: positif, nol bila semua benar, negatif bila terbalik", () => {
    expect(row("C").discrimination).toBe(1);
    expect(row("D").discrimination).toBe(-1);
    expect(row("A").discrimination).toBe(0);
  });
  it("penanda mutu hanya muncul dengan cukup data", () => {
    expect(row("A").flags).toEqual(expect.arrayContaining(["too_easy", "weak_discrimination"]));
    expect(row("B").flags).toContain("too_hard");
    expect(row("D").flags).toContain("negative_discrimination");
    expect(row("E").flags).toContain("many_blank");
    expect(row("C").flags).toEqual([]);
    const few = computeItemStats(cohort().slice(0, 8));
    expect(few.rows.every((r) => r.flags.length === 0 && r.discrimination === null)).toBe(true); // 8 percobaan: belum ada daya beda atau penanda
    expect(computeItemStats(cohort().slice(0, 3)).rows.every((r) => r.p === null)).toBe(true);
  });
  it("urutan: tersulit dulu, tanpa data cukup di akhir", () => {
    const ps = rows.map((r) => r.p);
    expect(ps).toEqual([...ps].sort((a, b) => (a ?? 2) - (b ?? 2)));
  });
});

describe("jenis soal lain dan tes acak", () => {
  it("pasangan sebagian, isian, dan essay belum dinilai tidak menggembungkan statistik", () => {
    const items: StatItem[] = [
      { qid: "M", kind: "matching", points: 2, key: { pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }], partial: true }, stem: "m" },
      { qid: "S", kind: "short", points: 1, key: { accepted: ["push"] }, stem: "s" },
      { qid: "Es", kind: "essay", points: 4, key: { rubric: [{ criterion: "x", points: 4 }] }, stem: "e" },
    ];
    const attempts: StatAttempt[] = Array.from({ length: 10 }, (_, i) => ({
      items,
      answers: [{ qid: "M", response: i % 2 ? [0, 1] : [0, 5] }, { qid: "S", response: i < 5 ? " PUSH " : "pop" }, { qid: "Es", response: "jawaban panjang" /* belum dinilai */ }],
    }));
    const { rows } = computeItemStats(attempts);
    const by = (q: string) => rows.find((r) => r.qid === q)!;
    expect(by("M").p).toBe(0.75); // separuh penuh, separuh setengah
    expect(by("S").p).toBe(0.5);
    expect(by("Es").p).toBeNull(); // semua pending: tidak dihitung
    expect(by("Es").answered).toBe(10);
    expect(by("M").distribution).toBeNull();
  });
  it("tes dengan soal acak per percobaan: tiap butir dihitung dari percobaan yang memuatnya", () => {
    const pool = ["a", "b", "c", "d"].map((q) => mcq(q));
    const attempts: StatAttempt[] = Array.from({ length: 12 }, (_, i) => {
      const items = i % 2 ? [pool[0], pool[1]] : [pool[2], pool[3]];
      return { items, answers: items.map((it) => ({ qid: it.qid, choice: 0 })) };
    });
    const { rows } = computeItemStats(attempts);
    expect(rows.map((r) => [r.qid, r.used]).sort()).toEqual([["a", 6], ["b", 6], ["c", 6], ["d", 6]]);
    expect(computeItemStats([]).rows).toEqual([]);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("rute statistik butir (database in-memory)", () => {
  it("otorisasi, peserta uji dikecualikan, dan memakai snapshot soal", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_butir_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Question } = await import("@/models/Question");
    const { Test, Attempt, AttemptSnapshot } = await import("@/models/Test");
    const route = await import("@/app/api/admin/tests/[id]/item-stats/route");

    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active" });
    const qa = await User.create({ email: "q@t.id", role: "participant", status: "active", qaTester: true });
    const q = await Question.create({ section: "umum", type: "x", stem: "Stem asli", options: ["a", "b"], answerKey: 0, status: "published" });
    const test = await Test.create({ name: "T", kind: "general", sections: [{ name: "umum", durationSec: 600, questionIds: [q._id] }] });
    const mk = async (userId: import("mongoose").Types.ObjectId, choice: number) => {
      const a = await Attempt.create({ userId, testId: test._id, kind: "general", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), answers: [{ qid: q._id, choice }] });
      await AttemptSnapshot.create({ attemptId: a._id, items: [{ qid: q._id, section: "umum", type: "x", stem: "Stem asli", kind: "mcq", points: 1, answerKey: 0, options: ["a", "b"] }] });
    };
    for (let i = 0; i < 6; i++) await mk(stu._id, i < 4 ? 0 : 1);
    await mk(qa._id, 1); await mk(admin._id, 1); // peserta uji tidak dihitung
    await Question.updateOne({ _id: q._id }, { answerKey: 1, stem: "Diubah kemudian" }); // kunci berubah setelah tes: snapshot tetap benar

    const get = (id: unknown) => route.GET(new Request("http://x"), { params: { id: String(id) } });
    current = null; expect((await get(test._id)).status).toBe(401);
    current = stu as never; expect((await get(test._id)).status).toBe(403);
    current = admin as never;
    expect((await get("bukan-id")).status).toBe(404);
    expect((await get(new Types.ObjectId())).status).toBe(404);
    const j = await (await get(test._id)).json();
    expect(j.attempts).toBe(6);
    expect(j.rows[0]).toMatchObject({ qid: String(q._id), used: 6, p: 0.67, stem: "Stem asli", distribution: [4, 2] });
  });
});
