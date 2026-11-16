import { describe, it, expect, afterAll, vi } from "vitest";
import { SignJWT } from "jose";
import { isMp4, parseEmbed, signVideoToken, verifyVideoToken, injectVideoTokens, videoLimit, MAX_VIDEO_BYTES } from "@/lib/video-store";
import { sanitizeRich } from "@/lib/sanitize";

const mp4 = (extra = 3000) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(extra, 1)]);
const ID = "a".repeat(24);

describe("deteksi MP4 dan tautan embed", () => {
  it("MP4 dikenali dari byte awal, bukan nama atau tipe klaim", () => {
    expect(isMp4(mp4())).toBe(true);
    expect(isMp4(Buffer.from("<svg onload=alert(1)>padding padding"))).toBe(false);
    expect(isMp4(Buffer.from("MZ" + "x".repeat(40)))).toBe(false);
    expect(isMp4(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isMp4(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypXXXX")]))).toBe(false); // merek tak dikenal
    expect(isMp4(Buffer.alloc(0))).toBe(false);
    expect(isMp4(Buffer.from("ftyp"))).toBe(false);
  });
  it("YouTube dan Vimeo diterima dengan pola ketat; selain itu ditolak", () => {
    expect(parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", externalId: "dQw4w9WgXcQ" });
    expect(parseEmbed("https://youtu.be/dQw4w9WgXcQ?t=5")).toEqual({ provider: "youtube", externalId: "dQw4w9WgXcQ" });
    expect(parseEmbed("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(parseEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.externalId).toBe("dQw4w9WgXcQ");
    expect(parseEmbed("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", externalId: "123456789" });
    expect(parseEmbed("https://player.vimeo.com/video/123456789")?.provider).toBe("vimeo");
    for (const bad of ["javascript:alert(1)", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://evil.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch?v=dQw4w9WgXcQ\"onload=x", "https://vimeo.com/abc", "data:text/html,<x>", "", "bukan url", "https://vimeo.com.evil.io/123456789"]) expect(parseEmbed(bad), bad).toBeNull();
  });
  it("batas unggahan 100 MB tidak bisa dinaikkan lewat env", () => {
    const old = process.env.VIDEO_MAX_BYTES;
    process.env.VIDEO_MAX_BYTES = String(MAX_VIDEO_BYTES * 10);
    expect(videoLimit()).toBe(MAX_VIDEO_BYTES);
    process.env.VIDEO_MAX_BYTES = "1000";
    expect(videoLimit()).toBe(1000);
    if (old === undefined) delete process.env.VIDEO_MAX_BYTES; else process.env.VIDEO_MAX_BYTES = old;
  });
});

describe("sanitasi video di materi (XSS)", () => {
  it("hanya <video src=/api/video/<id>> yang bertahan; atribut lain dan sumber luar dibuang", () => {
    const ok = sanitizeRich(`<video src="/api/video/${ID}" onerror="alert(1)" autoplay poster="https://e.x/p.png" class="x" width="640"></video>`);
    expect(ok).toContain(`src="/api/video/${ID}"`);
    expect(ok).toContain('controls="controls"');
    expect(ok).toContain('width="640"');
    expect(ok).not.toMatch(/onerror|autoplay|poster|class=/i);
    for (const bad of [`<video src="https://evil.example/a.mp4"></video>`, `<video src="javascript:alert(1)"></video>`, `<video src="/api/video/zzz"></video>`, `<video src="//evil.example/a.mp4"></video>`, `<video><source src="https://e.x/a.mp4" onerror="x()"></video>`, `<video src="data:video/mp4;base64,AAAA"></video>`, `<video src="/api/video/${ID}/../../x"></video>`]) {
      const out = sanitizeRich(bad).toLowerCase();
      expect(out, bad).not.toMatch(/evil|javascript|data:|onerror|<source|zzz|\.\./);
    }
  });
  it("iframe: YouTube dan Vimeo boleh, host lain dibuang", () => {
    expect(sanitizeRich(`<iframe src="https://player.vimeo.com/video/123456789"></iframe>`)).toContain("player.vimeo.com");
    expect(sanitizeRich(`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>`)).toContain("youtube-nocookie.com");
    expect(sanitizeRich(`<iframe src="https://evil.example/x"></iframe>`)).not.toContain("evil");
    expect(sanitizeRich(`<iframe src="https://vimeo.com.evil.io/video/1"></iframe>`)).not.toContain("evil");
  });
});

describe("tautan bertanda tangan untuk materi HTML", () => {
  it("terikat ke satu klip dan menolak token rusak atau kedaluwarsa", async () => {
    const t = await signVideoToken(ID, "user1");
    expect(await verifyVideoToken(t, ID)).toBe("user1");
    expect(await verifyVideoToken(t, "b".repeat(24))).toBeNull();
    expect(await verifyVideoToken(t + "x", ID)).toBeNull();
    expect(await verifyVideoToken(null, ID)).toBeNull();
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    const old = await new SignJWT({ vid: ID, p: "video" }).setSubject("u").setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(key);
    expect(await verifyVideoToken(old, ID)).toBeNull();
    const audio = await new SignJWT({ vid: ID, p: "audio" }).setSubject("u").setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(key);
    expect(await verifyVideoToken(audio, ID)).toBeNull(); // tujuan token lain tidak dipakai ulang
  });
  it("injectVideoTokens menambahkan token ke setiap klip yang dirujuk", async () => {
    const html = `<video src="/api/video/${ID}"></video><video src='/api/video/${ID}'></video><video src="/api/video/${"c".repeat(24)}"></video>`;
    const out = await injectVideoTokens(html, "user1");
    expect([...out.matchAll(/\?t=/g)]).toHaveLength(3);
    const tok = /api\/video\/a{24}\?t=([^"']+)/.exec(out)![1];
    expect(await verifyVideoToken(tok, ID)).toBe("user1");
    expect(await injectVideoTokens("<p>tanpa video</p>", "u")).toBe("<p>tanpa video</p>");
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("unggah dan alirkan video (database in-memory)", () => {
  it("unggahan aman, Range benar, otorisasi sama dengan materi dan tes, hapus dijaga", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_video_test");
    process.env.VIDEO_MAX_BYTES = String(20_000);
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const mongoose = (await import("mongoose")).default;
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Material } = await import("@/models/Material");
    const { Question, QuestionGroup } = await import("@/models/Question");
    const { Test, Attempt } = await import("@/models/Test");
    const { Video } = await import("@/models/Video");
    const { AuditLog } = await import("@/models/AuditLog");
    const up = await import("@/app/api/admin/videos/route");
    const upId = await import("@/app/api/admin/videos/[id]/route");
    const play = await import("@/app/api/video/[id]/route");

    const I = await Institution.create({ name: "I", code: "III" });
    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const editor = await User.create({ email: "e@t.id", role: "content_editor", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active", institutionId: I._id });
    const other = await User.create({ email: "o@t.id", role: "participant", status: "active", institutionId: I._id });
    const as = (u: unknown) => { current = u as never; };
    const post = (body: BodyInit | ReadableStream | null, headers: Record<string, string>, qs = "?title=Klip") =>
      up.POST(new Request(`http://x/api/admin/videos${qs}`, { method: "POST", headers, body, ...(body && typeof body === "object" && "getReader" in body ? { duplex: "half" } : {}) } as never));
    const mp4Headers = { "content-type": "video/mp4" };

    // Otorisasi unggah
    as(null); expect((await post(mp4(), mp4Headers)).status).toBe(401);
    as(stu); expect((await post(mp4(), mp4Headers)).status).toBe(403);
    as(editor); expect((await post(mp4(), mp4Headers)).status).toBe(403); // hanya admin dan academic_admin

    // Berkas buruk: tipe palsu, kepala bukan MP4, kosong, terlalu besar (header dan aliran), judul kosong.
    as(admin);
    expect((await post("x", { "content-type": "text/html" })).status).toBe(415);
    expect((await post(Buffer.from("<html>" + "x".repeat(3000)), mp4Headers)).status).toBe(415); // berlabel video/mp4 tetapi isinya HTML
    expect((await post(new Uint8Array(0), mp4Headers)).status).toBe(400);
    expect((await post(mp4(), mp4Headers, "?title=")).status).toBe(400);
    expect((await post(mp4(), { ...mp4Headers, "content-length": "999999" })).status).toBe(413);
    const big = mp4(30_000);
    const stream = new ReadableStream({ start(c) { for (let i = 0; i < big.length; i += 5000) c.enqueue(new Uint8Array(big.subarray(i, i + 5000))); c.close(); } });
    expect((await post(stream, mp4Headers)).status).toBe(413); // melewati batas saat mengalir
    expect(await Video.countDocuments()).toBe(0);
    const files = mongoose.connection.db!.collection("video.files"), chunks = mongoose.connection.db!.collection("video.chunks");
    expect(await files.countDocuments({ "metadata.ownerId": String(admin._id), length: { $gt: 20_000 } })).toBe(0);
    expect(await chunks.countDocuments()).toBe(await chunks.countDocuments({ files_id: { $in: (await files.find().toArray()).map((f) => f._id) } })); // tidak ada potongan yatim

    // Unggahan sah dan embed.
    const good = mp4(8000);
    const ok = await post(good, mp4Headers, "?title=Pengantar");
    expect(ok.status).toBe(201);
    const vid = (await ok.json()).id as string;
    expect((await Video.findById(vid).lean())?.size).toBe(good.length);
    const emb = await up.POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "YT", url: "https://youtu.be/dQw4w9WgXcQ" }) }));
    expect(emb.status).toBe(201);
    const embId = (await emb.json()).id as string;
    for (const url of ["javascript:alert(1)", "https://evil.com/x"]) expect((await up.POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "x", url }) }))).status).toBe(400);
    expect(await AuditLog.countDocuments({ action: { $in: ["video.upload", "video.embed"] } })).toBe(2);

    // Aliran: penuh, Range, suffix, dan Range tidak sah.
    const get = (id: string, range?: string, qs = "") => play.GET(new Request(`http://x/api/video/${id}${qs}`, { headers: range ? { range } : {} }), { params: { id } });
    const full = await get(vid);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await full.arrayBuffer()).equals(good)).toBe(true);
    const part = await get(vid, "bytes=10-109");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 10-109/${good.length}`);
    expect(Buffer.from(await part.arrayBuffer()).equals(good.subarray(10, 110))).toBe(true);
    const tail = await get(vid, "bytes=-50");
    expect(tail.status).toBe(206);
    expect(Buffer.from(await tail.arrayBuffer()).equals(good.subarray(good.length - 50))).toBe(true);
    expect((await get(vid, `bytes=${good.length + 5}-`)).status).toBe(416);
    expect((await get(vid, "bytes=abc")).status).toBe(416);
    expect((await get(vid, "bytes=50-10")).status).toBe(416);
    expect((await get(embId)).status).toBe(404); // embed tidak dialirkan dari server
    expect((await get("bukan-id")).status).toBe(404);
    expect((await get("b".repeat(24))).status).toBe(404);

    // Otorisasi peserta: tanpa materi atau tes yang memakainya = 404.
    as(stu);
    expect((await get(vid)).status).toBe(404);
    as(null);
    expect((await get(vid)).status).toBe(404);

    // Materi terbit yang memuat klip: peserta boleh; materi draf atau preview tidak membuka akses.
    const m = await Material.create({ title: "M", slug: "m-video", kind: "rich", status: "draft", contentHtml: `<video src="/api/video/${vid}"></video>` });
    as(stu); expect((await get(vid)).status).toBe(404);
    await Material.updateOne({ _id: m._id }, { status: "published" });
    // cache keputusan 60 detik: pengguna lain (belum di-cache) memastikan keputusan baru
    as(other); expect((await get(vid)).status).toBe(200);
    // Materi milik institusi lain tidak membuka akses.
    const J = await Institution.create({ name: "J", code: "JJJ" });
    await Material.updateOne({ _id: m._id }, { institutionId: J._id });
    const third = await User.create({ email: "t@t.id", role: "participant", status: "active", institutionId: I._id });
    as(third); expect((await get(vid)).status).toBe(404);
    await Material.updateOne({ _id: m._id }, { $unset: { institutionId: 1 } });

    // Tautan bertanda tangan (materi HTML tanpa cookie): berlaku untuk klip itu saja.
    as(null);
    const token = await signVideoToken(vid, String(stu._id));
    expect((await get(vid, undefined, `?t=${token}`)).status).toBe(200);
    expect((await get(vid, undefined, `?t=${token}x`)).status).toBe(404);

    // Grup soal berbasis video: hanya selama peserta mengerjakan tes yang memuatnya.
    as(admin);
    const v2 = await post(mp4(2500), mp4Headers, "?title=Untuk soal");
    const v2id = (await v2.json()).id as string;
    const grp = await QuestionGroup.create({ section: "umum", videoId: v2id });
    const q = await Question.create({ section: "umum", type: "x", stem: "s", options: ["a", "b"], answerKey: 0, status: "published", groupId: grp._id });
    const test = await Test.create({ name: "T", kind: "general", sections: [{ name: "umum", durationSec: 600, questionIds: [q._id] }] });
    const fourth = await User.create({ email: "f@t.id", role: "participant", status: "active", institutionId: I._id });
    as(fourth); expect((await get(v2id)).status).toBe(404);
    const at = await Attempt.create({ userId: fourth._id, testId: test._id, kind: "general", status: "in_progress", startedAt: new Date(), sectionStartedAt: new Date() });
    const fifth = await User.create({ email: "g@t.id", role: "participant", status: "active", institutionId: I._id });
    as(fourth);
    expect((await get(v2id)).status).toBe(200);
    as(fifth); expect((await get(v2id)).status).toBe(404); // peserta lain tanpa percobaan
    await Attempt.updateOne({ _id: at._id }, { status: "submitted" });
    const sixth = await User.create({ email: "h@t.id", role: "participant", status: "active", institutionId: I._id });
    await Attempt.create({ userId: sixth._id, testId: test._id, kind: "general", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date() });
    as(sixth); expect((await get(v2id)).status).toBe(404); // sudah selesai: tidak lagi berhak

    // Hapus: dijaga bila masih dipakai; bersih bila tidak, termasuk berkas di GridFS.
    as(admin);
    const ctx = (id: string) => ({ params: { id } });
    expect((await upId.DELETE(new Request("http://x", { method: "DELETE" }), ctx(v2id))).status).toBe(409); // dipakai grup
    expect((await upId.DELETE(new Request("http://x", { method: "DELETE" }), ctx(vid))).status).toBe(409); // dipakai materi
    await Material.deleteMany({});
    const before = await files.countDocuments();
    expect((await upId.DELETE(new Request("http://x", { method: "DELETE" }), ctx(vid))).status).toBe(200);
    expect(await files.countDocuments()).toBe(before - 1);
    expect((await upId.PATCH(new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "" }) }), ctx(v2id))).status).toBe(400);
  });
});
