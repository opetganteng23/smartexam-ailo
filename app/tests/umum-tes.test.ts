import { describe, it, expect, afterAll, vi } from "vitest";
import { dailyGate, parseHM, wibDay, wibDayStart, wibMinutes } from "@/lib/daily-window";
import { drawQuestions } from "@/lib/draw";
import { canStartTest } from "@/lib/test-access";
import { testSchema } from "@/lib/admin-schemas";

describe("jendela harian (WIB)", () => {
  // 2026-11-16 00:30 UTC = 07:30 WIB
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 16, h - 7, m));
  it("buka pada [mulai, selesai) dan tutup di luarnya", () => {
    const w = { start: "07:00", end: "21:00" };
    expect(dailyGate(w, at(6, 59)).ok).toBe(false);
    expect(dailyGate(w, at(7, 0)).ok).toBe(true);
    expect(dailyGate(w, at(20, 59)).ok).toBe(true);
    expect(dailyGate(w, at(21, 0)).ok).toBe(false);
    expect(dailyGate(w, at(21, 0)).reason).toContain("07:00 to 21:00 WIB");
  });
  it("mendukung jendela yang melewati tengah malam dan jendela kosong atau tidak sah", () => {
    const w = { start: "22:00", end: "02:00" };
    expect(dailyGate(w, at(23, 0)).ok).toBe(true);
    expect(dailyGate(w, at(1, 30)).ok).toBe(true);
    expect(dailyGate(w, at(12, 0)).ok).toBe(false);
    expect(dailyGate(null, at(3, 0)).ok).toBe(true);
    expect(dailyGate({ start: "25:99", end: "07:00" }, at(3, 0)).ok).toBe(true);
    expect(dailyGate({ start: "07:00", end: "07:00" }, at(3, 0)).ok).toBe(true);
  });
  it("hari mengikuti WIB, bukan UTC", () => {
    const d = new Date("2026-11-15T18:30:00Z"); // 01:30 WIB 16 Nov
    expect(wibDay(d)).toBe("2026-11-16");
    expect(wibMinutes(d)).toBe(90);
    expect(wibDayStart(d).toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(parseHM("24:00")).toBeNull();
    expect(parseHM("09:05")).toBe(545);
  });
});

describe("penarikan soal acak", () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ _id: `q${i}`, groupId: i < 4 ? "g1" : undefined, difficulty: i % 2 ? "hard" : "easy", tags: [{ topic: i % 3 === 0 ? "Stack" : "Queue" }] }));
  it("jumlah tepat, tanpa duplikat, deterministik per benih dan berbeda antar benih", () => {
    const a = drawQuestions(pool, { count: 8 }, "attempt-1"), b = drawQuestions(pool, { count: 8 }, "attempt-1"), c = drawQuestions(pool, { count: 8 }, "attempt-2");
    expect(a.picked).toHaveLength(8);
    expect(new Set(a.picked.map((q) => q._id)).size).toBe(8);
    expect(a.picked.map((q) => q._id)).toEqual(b.picked.map((q) => q._id));
    expect(c.picked.map((q) => q._id)).not.toEqual(a.picked.map((q) => q._id));
  });
  it("soal satu grup tetap satu blok; blok yang tidak muat dilewati", () => {
    const r = drawQuestions(pool, { count: 3 }, "x");
    const inGroup = r.picked.filter((q) => q.groupId).length;
    expect(inGroup === 0 || inGroup === 4).toBe(true); // blok grup berisi 4 tidak muat di 3
    expect(inGroup).toBe(0);
  });
  it("menyaring topik (tanpa membedakan huruf) dan kesulitan", () => {
    const r = drawQuestions(pool, { count: 50, topics: ["stack"], difficulties: ["easy"] }, "x");
    expect(r.picked.every((q) => q.difficulty === "easy" && q.tags.some((t) => t.topic === "Stack"))).toBe(true);
  });
  it("N lebih besar dari isi: semua dipakai dan kekurangan dilaporkan; koleksi kosong aman", () => {
    const r = drawQuestions(pool, { count: 50 }, "x");
    expect(r.picked).toHaveLength(20);
    expect(r.short).toBe(30);
    expect(drawQuestions([], { count: 5 }, "x")).toEqual({ picked: [], short: 5 });
  });
});

describe("aturan tes umum", () => {
  const user = { role: "participant" as const, placementAttemptId: null, placementRetakeAllowed: false, currentLevelId: null };
  it("tes umum tanpa placement dan level; alur ITP lama tetap", () => {
    expect(canStartTest(user, { kind: "general", levelId: null }).ok).toBe(true);
    expect(canStartTest(user, { kind: "final", levelId: null }).reason).toMatch(/placement/i); // regresi
    expect(canStartTest(user, { kind: "quiz", levelId: null, requirePlacement: false }).ok).toBe(false);
    expect(canStartTest(user, { kind: "general", levelId: null }, { blocked: "Periode ditutup" })).toEqual({ ok: false, reason: "Periode ditutup" });
  });
  const base = { name: "T", kind: "general" as const, sections: [{ name: "umum", durationSec: 600, questionIds: ["a".repeat(24)] }] };
  it("skema: purpose, course, dan jendela harian hanya untuk tes umum; draw dan soal tetap tidak bercampur", () => {
    expect(testSchema.safeParse({ ...base, purpose: "daily", daily: { start: "07:00", end: "21:00" } }).success).toBe(true);
    expect(testSchema.safeParse({ ...base, kind: "final", purpose: "daily" }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, purpose: "midterm", daily: { start: "07:00", end: "21:00" } }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, purpose: "daily", daily: { start: "7:00", end: "21:00" } }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, purpose: "daily", daily: { start: "07:00", end: "07:00" } }).success).toBe(false);
    const draw = { collectionId: "b".repeat(24), count: 5 };
    expect(testSchema.safeParse({ ...base, sections: [{ name: "umum", durationSec: 600, questionIds: [], draw }] }).success).toBe(true);
    expect(testSchema.safeParse({ ...base, sections: [{ name: "umum", durationSec: 600, questionIds: ["a".repeat(24)], draw }] }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, sections: [{ name: "umum", durationSec: 600, questionIds: [] }] }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, kind: "final", sections: [{ name: "umum", durationSec: 600, questionIds: [], draw }] }).success).toBe(false);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("tes umum utuh (database in-memory)", () => {
  it("kuis harian acak dari koleksi: akses course, jendela, batas harian, penilaian persen tanpa efek ITP", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_tes_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit } = await import("@/models/Course");
    const { Question, QuestionCollection } = await import("@/models/Question");
    const { Test, Attempt } = await import("@/models/Test");
    const { Setting } = await import("@/models/Settings");
    const { Analysis } = await import("@/models/Learning");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const { finalize } = await import("@/lib/attempts");
    const start = await import("@/app/api/tests/[id]/start/route");
    const attemptRoute = await import("@/app/api/attempts/[id]/route");
    const coursesRoute = await import("@/app/api/courses/route");
    const testsRoute = await import("@/app/api/tests/route");
    const adminTests = await import("@/app/api/admin/tests/route");
    const adminTest = await import("@/app/api/admin/tests/[id]/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const A = await Institution.create({ name: "A", code: "AAA", modules: { learning: true } }), B = await Institution.create({ name: "B", code: "BBB", modules: { learning: true } });
    const admin = await User.create({ email: "ad@t.id", role: "admin", status: "active" });
    const ua = await User.create({ email: "a@t.id", role: "participant", status: "active", institutionId: A._id });
    const ub = await User.create({ email: "b@t.id", role: "participant", status: "active", institutionId: B._id });
    const course = await Course.create({ title: "Struktur Data", track: "general", active: true, institutionIds: [A._id] });
    await Unit.create({ courseId: course._id, title: "U1" });
    const col = await QuestionCollection.create({ name: "Bank", ownerId: admin._id, visibility: "global" });
    const mk = (i: number) => Question.create({ section: "umum", type: "x", stem: `Soal ${i}`, options: ["a", "b", "c"], answerKey: i % 3, explanation: `kunci-${i}`, status: "published", collectionId: col._id, difficulty: i % 2 ? "hard" : "easy", tags: [{ skill: "sd", topic: i < 6 ? "Stack" : "Queue" }] });
    const qs = await Promise.all(Array.from({ length: 10 }, (_, i) => mk(i)));
    await Question.create({ section: "umum", type: "x", stem: "Draf", options: ["a", "b"], answerKey: 0, status: "draft", collectionId: col._id });

    // Jendela yang mencakup sekarang (WIB) dan jendela yang tidak mencakupnya.
    const hm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
    const nowM = wibMinutes(new Date());
    const open = { start: hm(nowM - 60), end: hm(nowM + 60), maxPerDay: 2 }, closed = { start: hm(nowM + 120), end: hm(nowM + 180), maxPerDay: 0 };
    const body = (extra: Record<string, unknown> = {}) => ({ name: "Kuis harian SD", kind: "general", purpose: "daily", courseId: String(course._id), daily: open, maxAttempts: 0,
      sections: [{ name: "umum", durationSec: 600, questionIds: [], draw: { collectionId: String(col._id), count: 5, topics: ["stack"], difficulties: [] } }], ...extra });
    const req = (b: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const as = (u: unknown) => { current = u as never; };

    // Admin: penarikan N melebihi isi ditolak; sah dibuat; tes bukan umum tidak boleh membawa draw.
    as(admin);
    expect((await adminTests.POST(req(body({ sections: [{ name: "umum", durationSec: 600, questionIds: [], draw: { collectionId: String(col._id), count: 7, topics: ["stack"] } }] })))).status).toBe(400); // hanya 6 soal Stack
    expect((await adminTests.POST(req(body({ courseId: String(new Types.ObjectId()) })))).status).toBe(400);
    const created = await adminTests.POST(req(body()));
    expect(created.status).toBe(201);
    const testId = (await created.json()).id as string;
    const closedRes = await adminTests.POST(req(body({ name: "Tutup", daily: closed })));
    const closedId = (await closedRes.json()).id as string;

    // Peserta B (institusi lain): tidak melihat tes, tidak bisa memulai lewat ID, course tidak terlihat.
    as(ub);
    expect((await start.POST(req({}), { params: { id: testId } })).status).toBe(404);
    expect(((await (await testsRoute.GET()).json()).tests as { id: string }[]).some((t) => t.id === testId)).toBe(false);
    expect((await (await coursesRoute.GET()).json()).courses).toEqual([]);

    // Peserta A: course memuat tes; di luar jendela ditolak; di dalam jendela dimulai.
    as(ua);
    const cs = await (await coursesRoute.GET()).json();
    const listed = cs.courses[0].tests as { id: string; unlocked: boolean; daily: { start: string } }[];
    expect(listed.find((t) => t.id === testId)?.unlocked).toBe(true);
    expect(listed.find((t) => t.id === closedId)?.unlocked).toBe(false);
    const closedStart = await start.POST(req({}), { params: { id: closedId } });
    expect(closedStart.status).toBe(403);
    expect((await closedStart.json()).error).toMatch(/open every day/);

    const s1 = await start.POST(req({}), { params: { id: testId } });
    expect(s1.status).toBe(201);
    const attemptId = (await s1.json()).attemptId as string;
    const a1 = await Attempt.findById(attemptId).lean();
    expect(a1?.sections).toHaveLength(1);
    const drawn = a1!.sections![0].questionIds.map(String);
    expect(drawn).toHaveLength(5);
    expect(new Set(drawn).size).toBe(5);
    const stack = new Set(qs.slice(0, 6).map((q) => String(q._id)));
    expect(drawn.every((id) => stack.has(id))).toBe(true); // hanya topik Stack, tidak ada draf

    // Muat ulang: percobaan yang sama dan soal yang sama; tidak ada kunci atau pembahasan di respons.
    const resumed = await start.POST(req({}), { params: { id: testId } });
    expect((await resumed.json())).toMatchObject({ attemptId, resumed: true });
    const view = await attemptRoute.GET(new Request("http://x"), { params: { id: attemptId } });
    const vj = await view.json();
    expect((vj.questions as { id: string }[]).map((q) => q.id).sort()).toEqual([...drawn].sort());
    expect(JSON.stringify(vj)).not.toMatch(/answerKey|explanation|kunci-|"key"|rubric/);

    // Jawab semua dengan benar, selesaikan: skala persen, lulus, tanpa efek level, placement, atau analisis ITP.
    const att = (await Attempt.findById(attemptId))!;
    const test = (await Test.findById(testId).lean())!;
    const keyOf = new Map(qs.map((q) => [String(q._id), q.answerKey]));
    att.answers = drawn.map((id) => ({ qid: new Types.ObjectId(id), choice: keyOf.get(id), firstChoice: keyOf.get(id), changes: 0 })) as never;
    const { withAttemptSections } = await import("@/lib/attempt-sections");
    await finalize(att as never, withAttemptSections(test, att) as never);
    const done = (await Attempt.findById(attemptId).lean())!;
    expect(done.status).toBe("submitted");
    expect(done.scoreScale).toBe("percent");
    expect(done.scoreEst).toBe(100);
    expect(done.passed).toBe(true);
    expect(done.sectionScores?.[0]).toMatchObject({ raw: 5, total: 5 });
    expect(await Analysis.countDocuments({ attemptId })).toBe(0);
    expect((await User.findById(ua._id).lean())?.currentScoreEst).toBeUndefined();

    // Hasil peserta: terbaca, berskala persen, tanpa teks soal atau kunci.
    const resultRoute = await import("@/app/api/attempts/[id]/result/route");
    as(ua);
    const rr = await resultRoute.GET(new Request("http://x"), { params: { id: attemptId } });
    expect(rr.status).toBe(200);
    const rj = JSON.stringify(await rr.json());
    expect(rj).toContain("percent");
    expect(rj).not.toMatch(/kunci-|Soal d|answerKey/);

    // Batas percobaan per hari (2): percobaan ke-2 boleh, ke-3 ditolak sampai besok.
    expect((await start.POST(req({}), { params: { id: testId } })).status).toBe(201);
    const running2 = (await Attempt.findOne({ userId: ua._id, status: "in_progress" }))!;
    await Attempt.updateOne({ _id: running2._id }, { status: "submitted", finishedAt: new Date() });
    const third = await start.POST(req({}), { params: { id: testId } });
    expect(third.status).toBe(403);
    expect((await third.json()).error).toMatch(/Come back tomorrow/);

    // Setelah ada percobaan, susunan soal terkunci (termasuk jumlah penarikan).
    as(admin);
    const lock = await adminTest.PATCH(req(body({ sections: [{ name: "umum", durationSec: 600, questionIds: [], draw: { collectionId: String(col._id), count: 4, topics: ["stack"] } }] }), "PATCH"), { params: { id: testId } });
    expect(lock.status).toBe(409);
    expect((await adminTest.PATCH(req(body({ name: "Kuis harian SD (ubah nama)" }), "PATCH"), { params: { id: testId } })).status).toBe(200);
  });
});
