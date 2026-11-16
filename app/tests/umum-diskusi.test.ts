import { describe, it, expect, afterAll, vi } from "vitest";
import { cleanComment, displayName } from "@/lib/comments";

describe("teks komentar", () => {
  it("membuang tag dan atribut berbahaya, mempertahankan teks biasa", () => {
    expect(cleanComment("Halo <script>alert(1)</script>dunia")).not.toMatch(/script|alert\(1\)<|<\/?\w/i);
    expect(cleanComment('<img src=x onerror="alert(1)">Gambar')).toBe("Gambar");
    expect(cleanComment('<a href="javascript:alert(1)">klik</a>')).toBe("klik");
    expect(cleanComment("<svg onload=alert(1)>x</svg><iframe src=//e.x></iframe><style>*{}</style>teks")).not.toMatch(/svg|iframe|style|onload/i);
    expect(cleanComment("a &amp; b dan 2 < 3")).toBe("a & b dan 2 < 3");
    expect(cleanComment("  spasi   banyak\t\ttab  ")).toBe("spasi banyak tab");
    expect(cleanComment("kontrol\u0000\u0007hilang")).toBe("kontrolhilang");
    expect(cleanComment("baris\n\n\n\n\nbaru")).toBe("baris\n\nbaru");
    expect(cleanComment(null)).toBe("");
    expect(cleanComment({ $ne: 1 })).toBe("");
    expect(cleanComment("   ")).toBe("");
  });
  it("nama tampil dibatasi demi privasi", () => {
    expect(displayName({ name: "Siti Rahma Dewi", email: "siti@x.id" })).toBe("Siti D.");
    expect(displayName({ name: "Budi" })).toBe("Budi");
    expect(displayName({ name: "", email: "rahasia@x.id" })).toBe("Participant");
    expect(displayName(null)).toBe("Participant");
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("diskusi per unit (database in-memory)", () => {
  it("akses, lingkup institusi, balasan, laporan, moderasi, dan batas kecepatan", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_diskusi_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit } = await import("@/models/Course");
    const { Comment } = await import("@/models/Comment");
    const { AuditLog } = await import("@/models/AuditLog");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const thread = await import("@/app/api/units/[id]/comments/route");
    const one = await import("@/app/api/comments/[id]/route");
    const report = await import("@/app/api/comments/[id]/report/route");
    const queue = await import("@/app/api/admin/comments/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const [A, B, C] = await Promise.all([
      Institution.create({ name: "A", code: "AAA", modules: { learning: true } }),
      Institution.create({ name: "B", code: "BBB", modules: { learning: true } }),
      Institution.create({ name: "C", code: "CCC", modules: { learning: false } }),
    ]);
    const admin = await User.create({ email: "ad@t.id", role: "admin", status: "active" });
    const mk = (email: string, name: string, inst: import("mongoose").Types.ObjectId) => User.create({ email, name, role: "participant", status: "active", institutionId: inst });
    const a1 = await mk("a1@t.id", "Siti Rahma Dewi", A._id), a2 = await mk("a2@t.id", "Budi Santoso", A._id), a3 = await mk("a3@t.id", "Wati", A._id);
    const b1 = await mk("b1@t.id", "Candra", B._id), c1 = await mk("c1@t.id", "Dodi", C._id);
    const closed = await Course.create({ title: "Hanya A", track: "general", active: true, institutionIds: [A._id] });
    const open = await Course.create({ title: "Terbuka", track: "general", active: true });
    const uClosed = await Unit.create({ courseId: closed._id, title: "U-A" });
    const uOpen = await Unit.create({ courseId: open._id, title: "U-open" });
    const other = await Unit.create({ courseId: open._id, title: "U-lain" });
    const as = (u: unknown) => { current = u as never; };
    const req = (b?: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) });
    const ctx = (id: unknown) => ({ params: { id: String(id) } });
    const get = async (u: unknown, unit: unknown) => { as(u); return thread.GET(new Request("http://x"), ctx(unit)); };
    const post = async (u: unknown, unit: unknown, b: unknown) => { as(u); return thread.POST(req(b), ctx(unit)); };

    // Akses: institusi lain tidak membuka unit course milik A; modul Learning mati = 404.
    expect((await get(b1, uClosed._id)).status).toBe(404);
    expect((await post(b1, uClosed._id, { body: "intip" })).status).toBe(404);
    expect((await get(c1, uOpen._id)).status).toBe(404);
    as(null); expect((await thread.GET(new Request("http://x"), ctx(uOpen._id))).status).toBe(401);
    expect((await get(a1, "bukan-id")).status).toBe(404);

    // Menulis: tag dibuang, nama disamarkan, email tidak bocor.
    const p1 = await post(a1, uClosed._id, { body: "Halo <script>alert(1)</script><b>semua</b> & selamat" });
    expect(p1.status).toBe(201);
    const stored = (await Comment.findById((await p1.json()).id).lean())!;
    expect(stored.body).toBe("Halo semua & selamat"); // isi <script> dibuang seluruhnya, tag lain dibuang dan teksnya tetap
    expect(stored.body).not.toMatch(/<|>/);
    expect((await post(a1, uClosed._id, { body: "   " })).status).toBe(400);
    expect((await post(a1, uClosed._id, { body: "x".repeat(4001) })).status).toBe(400);
    expect((await post(a1, uClosed._id, { body: { $ne: 1 } })).status).toBe(400);
    const seen = await (await get(a2, uClosed._id)).json();
    expect(seen.comments).toHaveLength(1);
    expect(seen.comments[0]).toMatchObject({ author: "Siti D.", mine: false });
    expect(JSON.stringify(seen)).not.toContain("a1@t.id");
    expect((await (await get(a1, uClosed._id)).json()).comments[0].author).toBe("You");

    // Lingkup institusi pada course terbuka: komentar A tidak terlihat peserta B.
    await post(a1, uOpen._id, { body: "dari A" });
    await post(b1, uOpen._id, { body: "dari B" });
    expect((await (await get(a2, uOpen._id)).json()).comments.map((c: { body: string }) => c.body)).toEqual(["dari A"]);
    expect((await (await get(b1, uOpen._id)).json()).comments.map((c: { body: string }) => c.body)).toEqual(["dari B"]);

    // Balasan: satu tingkat, di unit yang sama, tidak pada komentar institusi lain.
    const top = (await Comment.findOne({ unitId: uOpen._id, userId: a1._id }).lean())!;
    const r1 = await post(a2, uOpen._id, { body: "balasan", parentId: String(top._id) });
    expect(r1.status).toBe(201);
    expect((await post(a3, uOpen._id, { body: "balas balasan", parentId: (await r1.json()).id })).status).toBe(404);
    expect((await post(a3, other._id, { body: "unit lain", parentId: String(top._id) })).status).toBe(404);
    expect((await post(b1, uOpen._id, { body: "lintas", parentId: String(top._id) })).status).toBe(404);

    // Laporan: satu per peserta, bukan komentar sendiri, hanya yang berhak melihat.
    as(a2); expect((await report.POST(req(), ctx(top._id))).status).toBe(200);
    expect((await report.POST(req(), ctx(top._id))).status).toBe(200);
    expect((await Comment.findById(top._id).lean())?.reports).toHaveLength(1);
    as(a1); expect((await report.POST(req(), ctx(top._id))).status).toBe(400);
    as(b1); expect((await report.POST(req(), ctx(top._id))).status).toBe(404);

    // Moderasi: peserta tidak boleh; admin melihat antrean, menyembunyikan, dan menampilkan kembali.
    as(a2); expect((await one.PATCH(req({ hidden: true }, "PATCH"), ctx(top._id))).status).toBe(403);
    as(a3); expect((await queue.GET(new Request("http://x"))).status).toBe(403);
    as(admin);
    const q = await (await queue.GET(new Request("http://x"))).json();
    expect(q.comments).toHaveLength(1);
    expect(q.comments[0]).toMatchObject({ reports: 1, hidden: false, unit: "U-open" });
    expect((await one.PATCH(req({ hidden: true, reason: "tidak pantas" }, "PATCH"), ctx(top._id))).status).toBe(200);
    expect((await (await get(a2, uOpen._id)).json()).comments.some((c: { id: string }) => c.id === String(top._id))).toBe(false); // tersembunyi bagi peserta
    expect((await (await get(admin, uOpen._id)).json()).comments.find((c: { id: string }) => c.id === String(top._id))).toMatchObject({ hidden: true });
    expect((await post(a3, uOpen._id, { body: "balas tersembunyi", parentId: String(top._id) })).status).toBe(404);
    as(admin); expect((await one.PATCH(req({ hidden: false }, "PATCH"), ctx(top._id))).status).toBe(200);
    expect((await Comment.findById(top._id).lean())?.reports).toEqual([]);
    expect(await AuditLog.countDocuments({ action: { $in: ["comment.hide", "comment.unhide"] } })).toBe(2);

    // Hapus: milik sendiri boleh, milik orang lain tidak (404); moderator menghapus beserta balasan.
    as(a2); expect((await one.DELETE(req(undefined, "DELETE"), ctx(top._id))).status).toBe(404);
    as(admin); expect((await one.DELETE(req(undefined, "DELETE"), ctx(top._id))).status).toBe(200);
    expect(await Comment.countDocuments({ $or: [{ _id: top._id }, { parentId: top._id }] })).toBe(0);
    const mine = await post(a3, uOpen._id, { body: "punya saya" });
    as(a3); expect((await one.DELETE(req(undefined, "DELETE"), ctx((await mine.json()).id))).status).toBe(200);

    // Komentar moderator terlihat semua peserta unit itu, dari institusi mana pun, sebagai "Moderator".
    const mod = await post(admin, uOpen._id, { body: "Pengumuman dari dosen" });
    expect(mod.status).toBe(201);
    for (const u of [a2, b1]) {
      const seenMod = (await (await get(u, uOpen._id)).json()).comments.find((c: { body: string }) => c.body === "Pengumuman dari dosen");
      expect(seenMod).toMatchObject({ author: "Moderator" });
    }

    // Batas kecepatan: 10 komentar per menit per akun.
    let last = 201;
    for (let i = 0; i < 12; i++) last = (await post(a3, uOpen._id, { body: `komentar ${i}` })).status;
    expect(last).toBe(429);
  });
});
