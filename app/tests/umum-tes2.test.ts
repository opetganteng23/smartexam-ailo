import { describe, it, expect, afterAll, vi } from "vitest";

// Perbaikan tinjauan tahap 3: balapan start, kunci course, validasi blok passage, dan soal yang sudah ditarik.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("tes umum: perbaikan tinjauan (database in-memory)", () => {
  it("start ganda hanya membuat satu percobaan, course terkunci menolak, blok passage divalidasi, soal tertarik tidak bisa dihapus", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_tes2_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit } = await import("@/models/Course");
    const { Question, QuestionCollection, QuestionGroup } = await import("@/models/Question");
    const { Test, Attempt } = await import("@/models/Test");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const start = await import("@/app/api/tests/[id]/start/route");
    const testsRoute = await import("@/app/api/tests/route");
    const adminTests = await import("@/app/api/admin/tests/route");
    const delQ = await import("@/app/api/admin/questions/[id]/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const I = await Institution.create({ name: "I", code: "III", modules: { learning: true } });
    const admin = await User.create({ email: "ad@t.id", role: "admin", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active", institutionId: I._id });
    const col = await QuestionCollection.create({ name: "K", ownerId: admin._id, visibility: "global" });
    const mkQ = (stem: string, extra: Record<string, unknown> = {}) => Question.create({ section: "umum", type: "x", stem, options: ["a", "b"], answerKey: 0, status: "published", collectionId: col._id, ...extra });
    const solo = await mkQ("solo");
    const grp = await QuestionGroup.create({ section: "umum", passageHtml: "<p>bacaan</p>" });
    await Promise.all([mkQ("g1", { groupId: grp._id }), mkQ("g2", { groupId: grp._id }), mkQ("g3", { groupId: grp._id })]);
    const req = (b: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const as = (u: unknown) => { current = u as never; };
    const sec = (count: number) => [{ name: "umum", durationSec: 600, questionIds: [], draw: { collectionId: String(col._id), count } }];

    // Validasi memakai penarikan sebenarnya: 4 soal (1 solo + blok 3) bisa 1, 3, atau 4, tetapi tidak 2 yang pas bila hanya blok 3 tersisa.
    as(admin);
    expect((await adminTests.POST(req({ name: "ok4", kind: "general", sections: sec(4) }))).status).toBe(201);
    expect((await adminTests.POST(req({ name: "lebih", kind: "general", sections: sec(5) }))).status).toBe(400);

    // Balapan: dua start bersamaan pada tes satu percobaan menyisakan satu percobaan.
    const single = await Test.create({ name: "Sekali", kind: "general", maxAttempts: 1, sections: [{ name: "umum", durationSec: 600, questionIds: [solo._id] }] });
    as(stu);
    const [r1, r2] = await Promise.all([start.POST(req({}), { params: { id: String(single._id) } }), start.POST(req({}), { params: { id: String(single._id) } })]);
    expect([r1.status, r2.status].every((s) => s === 201 || s === 200 || s === 403)).toBe(true);
    expect(await Attempt.countDocuments({ userId: stu._id, testId: single._id })).toBe(1);

    // Course terkunci oleh prasyarat: tes di dalamnya tidak bisa dimulai dan terlihat terkunci di daftar.
    const pre = await Course.create({ title: "Dasar", track: "general", active: true });
    await Unit.create({ courseId: pre._id, title: "U1" });
    const locked = await Course.create({ title: "Lanjut", track: "general", active: true, prerequisiteCourseIds: [pre._id] });
    await Unit.create({ courseId: locked._id, title: "U2" });
    const lt = await Test.create({ name: "Di course terkunci", kind: "general", courseId: locked._id, sections: [{ name: "umum", durationSec: 600, questionIds: [solo._id] }] });
    const blocked = await start.POST(req({}), { params: { id: String(lt._id) } });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toMatch(/Finish Dasar first/);
    const listed = ((await (await testsRoute.GET()).json()).tests as { id: string; unlocked: boolean }[]).find((t) => t.id === String(lt._id));
    expect(listed?.unlocked).toBe(false);

    // Soal yang sudah ditarik ke percobaan tidak bisa dihapus.
    await Attempt.create({ userId: stu._id, testId: single._id, kind: "general", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), sections: [{ name: "umum", durationSec: 600, questionIds: [new Types.ObjectId(String(solo._id))] }] });
    as(admin);
    const del = await delQ.DELETE(req(undefined, "DELETE"), { params: { id: String(solo._id) } });
    expect(del.status).toBe(409);
    expect(await Question.exists({ _id: solo._id })).toBeTruthy();
  });
});
