import { describe, it, expect, afterAll, vi } from "vitest";
import { sectionFromSubject, isItpSection } from "@/lib/question-bank";

describe("sectionFromSubject (murni)", () => {
  it("nama mata pelajaran menjadi kunci bagian yang sah", () => {
    expect(sectionFromSubject("Struktur Data")).toBe("struktur_data");
    expect(sectionFromSubject("  Basis Data & SQL!  ")).toBe("basis_data_sql");
    expect(sectionFromSubject("Matematika Diskrit 2")).toBe("matematika_diskrit_2");
    expect(sectionFromSubject("123")).toBe("umum");
    expect(sectionFromSubject("")).toBe("umum");
    expect(sectionFromSubject(undefined)).toBe("umum");
    expect(sectionFromSubject("A".repeat(80)).length).toBeLessThanOrEqual(32);
    expect(/^[a-z][a-z0-9_]{1,31}$/.test(sectionFromSubject("Árvore de Decisão"))).toBe(true);
  });
  it("hanya bagian format ITP yang dianggap ITP", () => {
    expect(["listening", "structure", "reading"].every(isItpSection)).toBe(true);
    expect(isItpSection("struktur_data")).toBe(false);
    expect(isItpSection(undefined)).toBe(false);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("bank soal wajib di ruang kerja Umum (database in-memory)", () => {
  it("buat, ubah, filter belum dikelompokkan, dan pindah massal", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_bank_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Category } = await import("@/models/Category");
    const { Question, QuestionCollection } = await import("@/models/Question");
    const list = await import("@/app/api/admin/questions/route");
    const one = await import("@/app/api/admin/questions/[id]/route");
    const move = await import("@/app/api/admin/questions/move/route");

    const mk = (email: string, role: "admin" | "content_editor") => User.create({ email, role, status: "active" });
    const ed1 = await mk("e1@t.id", "content_editor"), ed2 = await mk("e2@t.id", "content_editor"), admin = await mk("ad@t.id", "admin");
    const sd = await Category.create({ name: "Struktur Data", nameKey: "struktur data" });
    const bd = await Category.create({ name: "Basis Data", nameKey: "basis data" });
    const bankSd = await QuestionCollection.create({ name: "UTS SD", categoryId: sd._id, ownerId: ed1._id, visibility: "private" });
    const bankBd = await QuestionCollection.create({ name: "Kuis BD", categoryId: bd._id, ownerId: ed1._id, visibility: "private" });
    const secret = await QuestionCollection.create({ name: "Rahasia", categoryId: sd._id, ownerId: ed2._id, visibility: "private" });
    const as = (u: unknown) => { current = u as never; };
    const json = (method: string, body: unknown) => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const q = (extra: Record<string, unknown> = {}) => ({ type: "dasar", stem: "Soal " + Math.random(), kind: "mcq", options: ["a", "b"], answerKey: 0, status: "draft", ...extra });
    const post = (b: unknown) => list.POST(json("POST", b));
    const p = (id: unknown) => ({ params: { id: String(id) } });

    // B3: tanpa bank ditolak; bagian ITP tanpa bank tetap boleh.
    as(ed1);
    expect((await post(q({ section: "struktur_data" }))).status).toBe(400);
    expect((await post(q())).status).toBe(400);
    expect((await post(q({ section: "listening" }))).status).toBe(201);

    // B2: section diturunkan dari bank, mata pelajaran mengikuti bank, section kiriman klien diabaikan.
    const ok = await post(q({ section: "sembarang", collectionId: String(bankSd._id) }));
    expect(ok.status).toBe(201);
    const made = await Question.findById((await ok.json()).id).lean();
    expect(made).toMatchObject({ section: "struktur_data", collectionId: bankSd._id, categoryId: sd._id });
    expect((await post(q({ collectionId: String(bankSd._id) }))).status).toBe(201); // section boleh dikosongkan
    // Mata pelajaran yang bentrok dengan bank ditolak; bank orang lain tidak bisa dipakai (IDOR).
    expect((await post(q({ collectionId: String(bankSd._id), categoryId: String(bd._id) }))).status).toBe(400);
    expect([403, 404]).toContain((await post(q({ collectionId: String(secret._id) }))).status);

    // B3: PATCH soal lama tanpa bank wajib memilih bank; setelah dipilih, section ikut bank.
    const legacy = await Question.create({ section: "umum", type: "x", stem: "Lama tanpa bank", options: ["a", "b"], answerKey: 0, status: "draft" });
    const base = { type: "x", stem: "Lama tanpa bank", options: ["a", "b"], answerKey: 0, status: "draft" };
    expect((await one.PATCH(json("PATCH", base), p(legacy._id))).status).toBe(400);
    expect((await one.PATCH(json("PATCH", { ...base, collectionId: String(bankBd._id) }), p(legacy._id))).status).toBe(200);
    expect(await Question.findById(legacy._id).lean()).toMatchObject({ section: "basis_data", collectionId: bankBd._id, categoryId: bd._id });
    // Soal di bank tetap di banknya bila PATCH tidak menyebut bank, dan tidak bisa dilepas dari bank.
    expect((await one.PATCH(json("PATCH", { ...base, stem: "Sudah diubah" }), p(legacy._id))).status).toBe(200);
    expect((await one.PATCH(json("PATCH", { ...base, collectionId: null }), p(legacy._id))).status).toBe(400);
    expect(await Question.findById(legacy._id).lean()).toMatchObject({ collectionId: bankBd._id });

    // Filter "belum dikelompokkan": hanya non-ITP tanpa bank.
    const l1 = await Question.create({ section: "umum", type: "x", stem: "Yatim 1", options: ["a", "b"], answerKey: 0, status: "draft" });
    const l2 = await Question.create({ section: "umum", type: "x", stem: "Yatim 2", options: ["a", "b"], answerKey: 0, status: "published" });
    const inSecret = await Question.create({ section: "umum", type: "x", stem: "Di bank rahasia", options: ["a", "b"], answerKey: 0, status: "draft", collectionId: secret._id });
    const none = await (await list.GET(new Request("http://x/api/admin/questions?collectionId=none"))).json();
    const stems = (none.items as { stem: string }[]).map((x) => x.stem).sort();
    expect(stems).toEqual(["Yatim 1", "Yatim 2"]); // soal listening tanpa bank (ITP) dan soal berbank tidak ikut
    expect((await list.GET(new Request("http://x/api/admin/questions?collectionId=bukan-id"))).status).toBe(400);

    // Pindah massal: editor hanya memindahkan yang boleh ia ubah (draf, tanpa bank atau di bank yang ia tulis).
    const mv = (ids: unknown[], collectionId: unknown) => move.POST(json("POST", { ids: ids.map(String), collectionId: String(collectionId) }));
    const r1 = await (await mv([l1._id, l2._id, inSecret._id], bankSd._id)).json();
    expect(r1).toEqual({ moved: 1, skipped: 2 }); // l2 terbit (editor tidak boleh), inSecret milik orang lain (IDOR)
    expect(await Question.findById(l1._id).lean()).toMatchObject({ collectionId: bankSd._id, categoryId: sd._id, section: "struktur_data" });
    expect(await Question.findById(inSecret._id).lean()).toMatchObject({ collectionId: secret._id }); // tidak tersentuh
    // Tujuan: bank orang lain tidak terlihat (404) dan bank yang tidak ada ditolak; masukan tidak sah ditolak.
    expect((await mv([l2._id], secret._id)).status).toBe(404);
    expect((await mv([l2._id], new (await import("mongoose")).Types.ObjectId())).status).toBe(404);
    expect((await move.POST(json("POST", { ids: ["$ne"], collectionId: String(bankSd._id) }))).status).toBe(400);
    expect((await move.POST(json("POST", { ids: [], collectionId: String(bankSd._id) }))).status).toBe(400);
    expect((await move.POST(json("POST", { ids: Array(501).fill("a".repeat(24)), collectionId: String(bankSd._id) }))).status).toBe(400);
    // Admin boleh memindahkan semuanya, termasuk yang terbit.
    as(admin);
    expect(await (await mv([l2._id, inSecret._id], bankBd._id)).json()).toEqual({ moved: 2, skipped: 0 });
    expect(await Question.findById(l2._id).lean()).toMatchObject({ section: "basis_data", collectionId: bankBd._id });
    // Tanpa login atau peserta: ditolak.
    as(null as never); expect((await mv([l1._id], bankSd._id)).status).toBe(401);
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active" });
    as(stu); expect((await mv([l1._id], bankSd._id)).status).toBe(403);
  });
});
