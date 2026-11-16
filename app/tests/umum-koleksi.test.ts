import { describe, it, expect, afterAll, vi } from "vitest";

// U2.6: koleksi bank soal, pemilik, dan visibilitas (pribadi, institusi, global) dijaga di level query.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("koleksi bank soal (database in-memory)", () => {
  it("visibilitas, otorisasi tulis, IDOR soal, hapus, dan audit", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_koleksi_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Category } = await import("@/models/Category");
    const { Question } = await import("@/models/Question");
    const { AuditLog } = await import("@/models/AuditLog");
    const cols = await import("@/app/api/admin/collections/route");
    const col = await import("@/app/api/admin/collections/[id]/route");
    const qs = await import("@/app/api/admin/questions/route");
    const q1 = await import("@/app/api/admin/questions/[id]/route");
    const pick = await import("@/app/api/admin/questions/pick/route");
    const cat = await import("@/app/api/admin/categories/[id]/route");

    const I1 = await Institution.create({ name: "I1", code: "ONE" }), I2 = await Institution.create({ name: "I2", code: "TWO" });
    const mk = (email: string, role: "admin" | "academic_admin" | "content_editor", inst?: import("mongoose").Types.ObjectId) => User.create({ email, role, status: "active", ...(inst ? { institutionId: inst } : {}) });
    const admin = await mk("a@t.id", "admin"), acad = await mk("c@t.id", "academic_admin", I1._id), edA = await mk("e1@t.id", "content_editor", I1._id), edB = await mk("e2@t.id", "content_editor", I2._id);
    const category = await Category.create({ name: "SD", nameKey: "sd" });
    const req = (body?: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const as = (u: unknown) => { current = u as never; };
    const create = async (u: unknown, body: Record<string, unknown>) => { as(u); const r = await cols.POST(req({ name: "K", categoryId: String(category._id), ...body })); return { status: r.status, id: (await r.json()).id as string }; };
    const names = async (u: unknown) => { as(u); return ((await (await cols.GET(new Request("http://x/api/admin/collections"))).json()).collections as { name: string }[]).map((c) => c.name).sort(); };

    const priv = await create(edA, { name: "Pribadi A", visibility: "private" });
    const inst1 = await create(edA, { name: "Institusi 1", visibility: "institution", institutionId: String(I1._id) });
    const glob = await create(acad, { name: "Global", visibility: "global" });
    expect(priv.status).toBe(201);
    // Visibilitas: pribadi hanya pemilik dan admin; institusi hanya institusi itu; global semua staf.
    expect(await names(edA)).toEqual(["Global", "Institusi 1", "Pribadi A"]);
    expect(await names(edB)).toEqual(["Global"]);
    expect(await names(acad)).toEqual(["Global", "Institusi 1"]); // academic_admin tidak melihat koleksi pribadi orang lain
    expect(await names(admin)).toEqual(["Global", "Institusi 1", "Pribadi A"]);

    // Aturan pembuatan: editor tidak boleh membuat koleksi global; institusi wajib dipilih; id liar ditolak.
    expect((await create(edA, { visibility: "global" })).status).toBe(403);
    expect((await create(edA, { visibility: "institution" })).status).toBe(400);
    expect((await create(edA, { categoryId: String(new Types.ObjectId()) })).status).toBe(400);
    expect((await create(edA, { name: { $ne: "" } })).status).toBe(400);

    // Soal di koleksi: tulis hanya bila boleh menulis koleksinya.
    const post = async (u: unknown, collectionId: string, stem: string) => { as(u); const r = await qs.POST(req({ section: "umum", type: "x", stem, options: ["a", "b"], answerKey: 0, collectionId })); return { status: r.status, id: (await r.json()).id as string }; };
    const own = await post(edA, priv.id, "soal pribadi");
    expect(own.status).toBe(201);
    expect((await post(edB, priv.id, "serobot")).status).toBe(403); // koleksi milik orang lain
    expect((await post(edA, glob.id, "ke global oleh editor")).status).toBe(403); // global hanya ditulis admin, academic_admin, atau pemilik
    expect((await post(acad, glob.id, "soal global")).status).toBe(201);
    const globalQ = await Question.findOne({ stem: "soal global" }).lean();

    // IDOR: soal di koleksi pribadi tidak terlihat orang lain (daftar, rincian, pick), tetapi soal global terlihat.
    const list = async (u: unknown, query = "") => { as(u); return ((await (await qs.GET(new Request("http://x/api/admin/questions" + query))).json()).items as { stem: string }[]).map((i) => i.stem).sort(); };
    expect(await list(edA)).toContain("soal pribadi");
    expect(await list(edB)).toEqual(["soal global"]);
    expect(await list(acad)).toEqual(["soal global"]);
    expect(await list(admin)).toEqual(["soal global", "soal pribadi"]);
    as(edB);
    expect((await q1.GET(new Request("http://x"), { params: { id: own.id } })).status).toBe(404);
    expect((await q1.GET(new Request("http://x"), { params: { id: String(globalQ!._id) } })).status).toBe(200);
    expect((await qs.GET(new Request(`http://x/api/admin/questions?collectionId=${priv.id}`))).status).toBe(404);
    expect((await qs.GET(new Request("http://x/api/admin/questions?collectionId=zzz"))).status).toBe(400);
    expect(await list(edA, `?collectionId=${priv.id}`)).toEqual(["soal pribadi"]);
    await Question.updateMany({}, { $set: { status: "published" } });
    as(edB);
    const picked = await (await pick.POST(req({ section: "umum", count: 10 }))).json();
    expect(JSON.stringify(picked)).not.toContain("soal pribadi");

    // Ubah visibilitas: hanya pemilik atau admin; tercatat di audit.
    as(edB);
    expect((await col.PATCH(req({ name: "X", visibility: "private" }, "PATCH"), { params: { id: priv.id } })).status).toBe(404);
    as(edA);
    expect((await col.PATCH(req({ name: "Pribadi A", visibility: "institution", institutionId: String(I1._id) }, "PATCH"), { params: { id: priv.id } })).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: "collection.visibility", target: priv.id })).toBe(1);
    expect(await list(acad)).toContain("soal pribadi"); // kini dibagikan ke institusi 1

    // Hapus: ditolak bila masih berisi soal; kosong boleh. Kategori yang dipakai koleksi tidak bisa dihapus.
    as(edA);
    expect((await col.DELETE(req(undefined, "DELETE"), { params: { id: priv.id } })).status).toBe(409);
    expect((await col.DELETE(req(undefined, "DELETE"), { params: { id: inst1.id } })).status).toBe(200);
    as(admin);
    expect((await cat.DELETE(req(undefined, "DELETE"), { params: { id: String(category._id) } })).status).toBe(409);
  });
});
