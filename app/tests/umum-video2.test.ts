import { describe, it, expect, afterAll, vi } from "vitest";

// Perbaikan tinjauan tahap 4: PATCH grup tanpa videoId, berkas GridFS hilang, dan tautan bertanda tangan milik pengguna lain.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("video: perbaikan tinjauan (database in-memory)", () => {
  it("PATCH grup mempertahankan video, berkas hilang dijawab 404, token milik orang lain ditolak bagi pengguna masuk", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_video2_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const mongoose = (await import("mongoose")).default;
    const { User } = await import("@/models/User");
    const { QuestionGroup } = await import("@/models/Question");
    const { Video } = await import("@/models/Video");
    const { signVideoToken } = await import("@/lib/video-store");
    const up = await import("@/app/api/admin/videos/route");
    const play = await import("@/app/api/video/[id]/route");
    const grp = await import("@/app/api/admin/groups/[id]/route");

    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active" });
    const other = await User.create({ email: "o@t.id", role: "participant", status: "active" });
    current = admin as never;
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(2000, 7)]);
    const r = await up.POST(new Request("http://x/api/admin/videos?title=V", { method: "POST", headers: { "content-type": "video/mp4" }, body: mp4 }));
    expect(r.status).toBe(201);
    const vid = (await r.json()).id as string;

    // PATCH grup tanpa videoId tidak boleh melepas video.
    const g = await QuestionGroup.create({ section: "umum", videoId: vid, passageHtml: "<p>a</p>" });
    const patch = await grp.PATCH(new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "umum", passageHtml: "<p>b</p>" }) }), { params: { id: String(g._id) } });
    expect(patch.status).toBe(200);
    expect(String((await QuestionGroup.findById(g._id).lean())?.videoId)).toBe(vid);
    // Dikirim null: melepas.
    await grp.PATCH(new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "umum", videoId: null }) }), { params: { id: String(g._id) } });
    expect((await QuestionGroup.findById(g._id).lean())?.videoId).toBeUndefined();

    // Tautan bertanda tangan milik stu tidak bisa dipakai pengguna masuk lain (tanpa hak sendiri), tetapi bekerja bagi tamu dan pemiliknya.
    const token = await signVideoToken(vid, String(stu._id));
    const get = (qs = "") => play.GET(new Request(`http://x/api/video/${vid}${qs}`), { params: { id: vid } });
    current = other as never;
    expect((await get(`?t=${token}`)).status).toBe(404);
    current = stu as never;
    expect((await get(`?t=${token}`)).status).toBe(200);
    current = null;
    expect((await get(`?t=${token}`)).status).toBe(200);
    expect((await get("?t=salah")).status).toBe(404);
    expect((await get()).status).toBe(404);

    // Metadata ada tetapi berkas GridFS hilang: 404 bersih, bukan aliran terputus.
    const v = (await Video.findById(vid).lean())!;
    await mongoose.connection.db!.collection("video.files").deleteOne({ _id: v.gridFsId as import("mongoose").Types.ObjectId });
    current = admin as never;
    expect((await get()).status).toBe(404);
  });
});
