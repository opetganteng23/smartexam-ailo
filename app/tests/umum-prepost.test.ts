import { describe, it, expect, afterAll, vi } from "vitest";
import { buildPrePost, bestPerUser } from "@/lib/prepost";

const t = (topic: string, correct: number, total: number) => ({ skill: "sd", topic, correct, total });

describe("laporan selisih pre/post (murni)", () => {
  it("memakai percobaan terbaik, menghitung selisih per peserta dan per topik", () => {
    const pre = [
      { userId: "u1", scoreEst: 40, topicScores: [t("stack", 2, 5), t("queue", 2, 5)] },
      { userId: "u1", scoreEst: 30, topicScores: [t("stack", 0, 5), t("queue", 0, 5)] }, // lebih rendah: diabaikan
      { userId: "u2", scoreEst: 60, topicScores: [t("stack", 3, 5), t("queue", 3, 5)] },
      { userId: "u3", scoreEst: 50, topicScores: [t("stack", 5, 10)] }, // tidak mengerjakan post-test
    ];
    const post = [
      { userId: "u1", scoreEst: 80, topicScores: [t("stack", 4, 5), t("queue", 4, 5)] },
      { userId: "u2", scoreEst: 50, topicScores: [t("stack", 2, 5), t("queue", 3, 5)] },
      { userId: "u4", scoreEst: 70, topicScores: [t("stack", 7, 10)] }, // tidak mengerjakan pre-test
    ];
    const r = buildPrePost(pre, post);
    const row = (id: string) => r.rows.find((x) => x.userId === id)!;
    expect(row("u1")).toMatchObject({ pre: 40, post: 80, delta: 40 });
    expect(row("u1").topics.map((x) => [x.topic, x.pre, x.post, x.delta]).sort()).toEqual([["queue", 40, 80, 40], ["stack", 40, 80, 40]]);
    expect(row("u2")).toMatchObject({ delta: -10 });
    expect(row("u3")).toMatchObject({ pre: 50, post: null, delta: null });
    expect(row("u4")).toMatchObject({ pre: null, post: 70, delta: null });
    expect(r.summary).toMatchObject({ participants: 4, withBoth: 2, avgPre: 50, avgPost: 65, avgDelta: 15, improved: 1, declined: 1 });
    // Topik kohort hanya dari peserta yang punya kedua hasil; urut dari yang paling turun.
    expect(r.topics[0]).toMatchObject({ topic: "stack", n: 2, pre: 50, post: 60, delta: 10 });
    expect(r.topics[1].delta).toBeGreaterThan(r.topics[0].delta);
  });
  it("kasus tepi: kosong, tanpa skor, topik tanpa soal", () => {
    expect(buildPrePost([], [])).toMatchObject({ rows: [], summary: { participants: 0, withBoth: 0, avgDelta: null }, topics: [] });
    expect(bestPerUser([{ userId: "a", scoreEst: null }]).size).toBe(0);
    const r = buildPrePost([{ userId: "a", scoreEst: 10, topicScores: [t("x", 0, 0)] }], [{ userId: "a", scoreEst: 20, topicScores: [] }]);
    expect(r.rows[0]).toMatchObject({ delta: 10, topics: [] });
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("rute laporan pre/post (database in-memory)", () => {
  it("otorisasi, pasangan wajib, dan peserta uji dikecualikan", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_prepost_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Test, Attempt } = await import("@/models/Test");
    const route = await import("@/app/api/admin/tests/[id]/prepost/route");
    const adminTests = await import("@/app/api/admin/tests/route");
    const { Question } = await import("@/models/Question");

    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active", name: "Siti" });
    const qa = await User.create({ email: "q@t.id", role: "participant", status: "active", qaTester: true });
    const q = await Question.create({ section: "umum", type: "x", stem: "s", options: ["a", "b"], answerKey: 0, status: "published" });
    const sec = [{ name: "umum", durationSec: 600, questionIds: [q._id] }];
    const pre = await Test.create({ name: "Pre", kind: "general", purpose: "pretest", sections: sec });
    const mkPost = (extra: Record<string, unknown>) => Test.create({ name: "Post", kind: "general", purpose: "posttest", sections: sec, ...extra });
    const post = await mkPost({ pairedTestId: pre._id });
    const lonely = await mkPost({});
    const ctx = (id: unknown) => ({ params: { id: String(id) } });
    const get = (id: unknown, qs = "") => route.GET(new Request("http://x" + qs), ctx(id));
    const done = (userId: import("mongoose").Types.ObjectId, testId: import("mongoose").Types.ObjectId, scoreEst: number) => Attempt.create({ userId, testId, kind: "general", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), scoreEst, topicScores: [{ skill: "sd", topic: "stack", correct: scoreEst / 10, total: 10 }] });
    await done(stu._id, pre._id, 40); await done(stu._id, post._id, 70);
    await done(qa._id, pre._id, 10); await done(qa._id, post._id, 90); await done(admin._id, post._id, 100);

    current = null; expect((await get(post._id)).status).toBe(401);
    current = stu as never; expect((await get(post._id)).status).toBe(403);
    current = admin as never;
    expect((await get("bukan-id")).status).toBe(404);
    expect((await get(new Types.ObjectId())).status).toBe(404);
    expect((await get(lonely._id)).status).toBe(400); // tanpa pre-test pasangan
    expect((await get(post._id, "?pre=zzz")).status).toBe(400);
    const ok = await (await get(post._id)).json();
    expect(ok.summary).toMatchObject({ participants: 1, withBoth: 1, avgDelta: 30 }); // QA tester dan admin tidak ikut
    expect(ok.rows[0]).toMatchObject({ name: "Siti", pre: 40, post: 70, delta: 30 });
    expect(ok.topics[0]).toMatchObject({ topic: "stack", delta: 30 });

    // Menautkan pasangan harus ke pre-test yang sah.
    const base = { name: "Post baru", kind: "general", purpose: "posttest", sections: [{ name: "umum", durationSec: 600, questionIds: [String(q._id)] }] };
    const mkReq = (b: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    expect((await adminTests.POST(mkReq({ ...base, pairedTestId: String(pre._id) }))).status).toBe(201);
    expect((await adminTests.POST(mkReq({ ...base, pairedTestId: String(post._id) }))).status).toBe(400); // pasangan bukan pre-test
    expect((await adminTests.POST(mkReq({ ...base, purpose: "midterm", pairedTestId: String(pre._id) }))).status).toBe(400);
  });
});
