import { describe, it, expect, afterAll, vi } from "vitest";

// Perbaikan tinjauan keamanan tahap 2: rute lain tidak boleh membocorkan atau mengubah soal di koleksi yang tidak terlihat.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("IDOR soal lintas koleksi (database in-memory)", () => {
  it("ekspor, riwayat, duplikat, ubah, perakit tes, dan deteksi duplikat menghormati visibilitas", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_koleksi2_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Question, QuestionCollection } = await import("@/models/Question");
    const exp = await import("@/app/api/admin/questions/export/route");
    const ver = await import("@/app/api/admin/questions/[id]/versions/route");
    const dup = await import("@/app/api/admin/questions/[id]/duplicate/route");
    const one = await import("@/app/api/admin/questions/[id]/route");
    const { validateTestQuestions } = await import("@/lib/test-validate");
    const { dropDuplicates } = await import("@/lib/import-save");
    const { questionSchema } = await import("@/lib/admin-schemas");

    const mk = (email: string, role: "admin" | "academic_admin" | "content_editor") => User.create({ email, role, status: "active" });
    const owner = await mk("o@t.id", "content_editor"), other = await mk("x@t.id", "content_editor"), acad = await mk("a@t.id", "academic_admin"), admin = await mk("ad@t.id", "admin");
    const priv = await QuestionCollection.create({ name: "P", ownerId: owner._id, visibility: "private" });
    const glob = await QuestionCollection.create({ name: "G", ownerId: acad._id, visibility: "global" });
    const mkQ = (stem: string, collectionId: import("mongoose").Types.ObjectId) => Question.create({ section: "umum", type: "x", stem, options: ["a", "b"], answerKey: 0, status: "published", collectionId });
    const secret = await mkQ("RAHASIA pemilik", priv._id), shared = await mkQ("BERSAMA global", glob._id);
    const as = (u: unknown) => { current = u as never; };
    const p = (id: unknown) => ({ params: { id: String(id) } });
    const post = () => new Request("http://x", { method: "POST" });
    const patch = (body: unknown) => new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    // Ekspor CSV: tidak memuat soal pribadi orang lain.
    as(other);
    const csv = await (await exp.GET(new Request("http://x/api/admin/questions/export"))).text();
    expect(csv).toContain("BERSAMA global");
    expect(csv).not.toContain("RAHASIA");
    as(owner);
    expect(await (await exp.GET(new Request("http://x/api/admin/questions/export"))).text()).toContain("RAHASIA");

    // Riwayat dan duplikat: soal tak terlihat dijawab 404.
    as(other);
    expect((await ver.GET(new Request("http://x"), p(secret._id))).status).toBe(404);
    expect((await dup.POST(post(), p(secret._id))).status).toBe(404);
    // Duplikat soal global oleh editor: boleh, tetapi salinan tidak masuk koleksi global yang tidak boleh ditulisnya.
    const d = await dup.POST(post(), p(shared._id));
    expect(d.status).toBe(201);
    expect((await Question.findById((await d.json()).id).lean())?.collectionId).toBeUndefined();

    // Ubah soal di koleksi global: editor biasa ditolak (hanya admin, academic_admin, atau pemilik); academic_admin boleh.
    const body = { section: "umum", type: "x", stem: "diubah", options: ["a", "b"], answerKey: 0, status: "draft" };
    expect((await one.PATCH(patch(body), p(shared._id))).status).toBe(403);
    as(acad);
    expect((await one.PATCH(patch(body), p(shared._id))).status).toBe(200);
    // Memindahkan soal antar koleksi tercatat di audit.
    as(admin);
    expect((await one.PATCH(patch({ ...body, collectionId: String(priv._id) }), p(shared._id))).status).toBe(200);
    const { AuditLog } = await import("@/models/AuditLog");
    expect(await AuditLog.countDocuments({ action: "question.update", "meta.collectionTo": String(priv._id) })).toBe(1);

    // Perakit tes: soal pribadi orang lain dianggap tidak ada.
    await expect(validateTestQuestions([{ name: "umum", questionIds: [String(secret._id)] }], other)).rejects.toThrow(/not found/);
    await expect(validateTestQuestions([{ name: "umum", questionIds: [String(secret._id)] }], admin)).resolves.toBeUndefined();

    // Deteksi duplikat saat impor tidak menjadi oracle: soal pribadi orang lain tidak dianggap duplikat.
    const parsed = { label: "q", data: questionSchema.parse({ section: "umum", type: "x", stem: "RAHASIA pemilik", options: ["a", "b"], answerKey: 0, status: "draft" }) };
    expect((await dropDuplicates([parsed], other)).dups).toHaveLength(0);
    expect((await dropDuplicates([parsed], owner)).dups).toHaveLength(1);
  });
});
