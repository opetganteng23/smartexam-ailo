import { describe, it, expect, afterAll, vi } from "vitest";

// B4: tiap course umum punya bank bawaan; tes umum memilih bank, soal manual dibatasi ke bank itu dan bank lain yang sengaja diizinkan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("bank bawaan course dan bank pada tes (database in-memory)", () => {
  it("course umum, bank bawaan, pembatasan soal manual, dan aturan nama bagian", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_bank_tes_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Category } = await import("@/models/Category");
    const { Course } = await import("@/models/Course");
    const { Question, QuestionCollection } = await import("@/models/Question");
    const { Test } = await import("@/models/Test");
    const courses = await import("@/app/api/admin/courses/route");
    const courseBank = await import("@/app/api/admin/courses/[id]/bank/route");
    const tests = await import("@/app/api/admin/tests/route");
    const { validateTestQuestions } = await import("@/lib/test-validate");

    const admin = await User.create({ email: "ad@t.id", role: "admin", status: "active" });
    const editor = await User.create({ email: "e@t.id", role: "content_editor", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active" });
    const cat = await Category.create({ name: "Struktur Data", nameKey: "struktur data" });
    const json = (method: string, body?: unknown) => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const p = (id: unknown) => ({ params: { id: String(id) } });
    current = admin as never;

    // Course umum baru otomatis punya bank bawaan yang dinamai seperti course, di bawah mata pelajarannya.
    const made = await courses.POST(json("POST", { track: "general", title: "Struktur Data Dasar", categoryId: String(cat._id) }));
    expect(made.status).toBe(201);
    const course = await Course.findById((await made.json()).id).lean();
    expect(course?.bankId).toBeTruthy();
    expect(await QuestionCollection.findById(course!.bankId).lean()).toMatchObject({ name: "Struktur Data Dasar", categoryId: cat._id, visibility: "global" });
    const listed = await (await courses.GET()).json();
    expect(listed.courses.find((c: { id: string }) => c.id === String(course!._id)).bankId).toBe(String(course!.bankId));
    // Course ITP tidak mendapat bank.
    const itp = await courses.POST(json("POST", { track: "itp", title: "ITP", levelId: String((await (await import("@/models/Config")).Level.findOne().lean())!._id) }));
    expect((await Course.findById((await itp.json()).id).lean())?.bankId).toBeFalsy();

    // Course lama tanpa bank: rute bank membuatnya sekali (idempoten), hanya untuk course umum dan hanya staf akademik.
    const old = await Course.create({ track: "general", title: "Lama", categoryId: cat._id });
    const r1 = await (await courseBank.POST(json("POST"), p(old._id))).json();
    const r2 = await (await courseBank.POST(json("POST"), p(old._id))).json();
    expect(r1.bankId).toBe(r2.bankId);
    expect(await QuestionCollection.countDocuments({ name: "Lama" })).toBe(1);
    expect((await courseBank.POST(json("POST"), p(course!._id))).status).toBe(200);
    const itpCourse = await Course.create({ track: "itp", title: "Lama ITP" });
    expect((await courseBank.POST(json("POST"), p(itpCourse._id))).status).toBe(400);
    expect((await courseBank.POST(json("POST"), p("bukan-id"))).status).toBe(404);
    current = editor as never; expect((await courseBank.POST(json("POST"), p(old._id))).status).toBe(403);
    current = stu as never; expect((await courseBank.POST(json("POST"), p(old._id))).status).toBe(403);
    current = null; expect((await courseBank.POST(json("POST"), p(old._id))).status).toBe(401);
    current = admin as never;

    // Mengubah course tanpa mengganti mata pelajaran tidak menyentuh bank bawaan; mengganti mata pelajaran memindahkan bank dan soalnya.
    const courseRoute = await import("@/app/api/admin/courses/[id]/route");
    const bd = await Category.create({ name: "Basis Data", nameKey: "basis data" });
    const inBank = await Question.create({ section: "struktur_data", type: "x", stem: "Soal bank bawaan", options: ["a", "b"], answerKey: 0, status: "published", collectionId: course!.bankId, categoryId: cat._id });
    const patchCourse = (categoryId: string | null) => courseRoute.PATCH(json("PATCH", { track: "general", title: "Struktur Data Dasar", categoryId }), p(course!._id));
    expect((await patchCourse(String(cat._id))).status).toBe(200);
    expect(await QuestionCollection.findById(course!.bankId).lean()).toMatchObject({ categoryId: cat._id });
    expect(await Question.findById(inBank._id).lean()).toMatchObject({ section: "struktur_data", categoryId: cat._id });
    expect((await patchCourse(String(bd._id))).status).toBe(200);
    expect(await QuestionCollection.findById(course!.bankId).lean()).toMatchObject({ categoryId: bd._id });
    expect(await Question.findById(inBank._id).lean()).toMatchObject({ section: "basis_data", categoryId: bd._id });
    expect((await patchCourse(String(cat._id))).status).toBe(200); // kembalikan untuk uji berikutnya
    expect(await Question.findById(inBank._id).lean()).toMatchObject({ section: "struktur_data" });

    // Tes umum: soal manual hanya dari bank tes; bank lain hanya lewat pilihan eksplisit; nama bagian bebas.
    const bankA = course!.bankId as import("mongoose").Types.ObjectId, bankB = await QuestionCollection.create({ name: "Bank B", categoryId: cat._id, ownerId: admin._id, visibility: "global" });
    const secret = await QuestionCollection.create({ name: "Rahasia", categoryId: cat._id, ownerId: editor._id, visibility: "private" });
    const mk = (collectionId: import("mongoose").Types.ObjectId, section = "struktur_data") => Question.create({ section, type: "x", stem: "S" + Math.random(), options: ["a", "b"], answerKey: 0, status: "published", collectionId });
    const qa = await mk(bankA), qb = await mk(bankB._id);
    const sec = (ids: unknown[]) => [{ name: "bebas", durationSec: 600, questionIds: ids.map((x) => String((x as { _id: unknown })._id)) }];
    const body = (extra: Record<string, unknown>) => ({ name: "UTS", kind: "general", purpose: "midterm", sections: sec([qa]), ...extra });

    expect((await tests.POST(json("POST", body({ bankId: String(bankA) })))).status).toBe(201); // nama bagian "bebas" tidak harus sama dengan section soal
    expect((await tests.POST(json("POST", body({ bankId: String(bankA), sections: sec([qa, qb]) })))).status).toBe(400); // qb di bank lain
    expect((await tests.POST(json("POST", body({ bankId: String(bankA), extraBankIds: [String(bankB._id)], sections: sec([qa, qb]) })))).status).toBe(201);
    expect((await tests.POST(json("POST", body({ sections: sec([qa, qb]) })))).status).toBe(400); // tanpa bank tes: nama bagian "bebas" tidak cocok dengan section soal (aturan lama)
    expect((await tests.POST(json("POST", body({ sections: [{ name: "struktur_data", durationSec: 600, questionIds: [String(qa._id), String(qb._id)] }] })))).status).toBe(201); // nama bagian = section soal: boleh
    // Bank yang tidak terlihat pengguna ditolak (IDOR) dan bank tidak ada ditolak; masukan tidak sah ditolak.
    current = (await User.create({ email: "ac@t.id", role: "academic_admin", status: "active" })) as never;
    expect((await tests.POST(json("POST", body({ bankId: String(secret._id), sections: sec([]) })))).status).toBe(400);
    expect((await tests.POST(json("POST", body({ bankId: String(new Types.ObjectId()) })))).status).toBe(400);
    expect((await tests.POST(json("POST", body({ bankId: "$ne" })))).status).toBe(400);
    expect((await tests.POST(json("POST", body({ extraBankIds: Array(11).fill("a".repeat(24)) })))).status).toBe(400);

    // Tes non-umum tetap mencocokkan nama bagian dengan section soal (alur ITP tidak berubah).
    await expect(validateTestQuestions([{ name: "listening", questionIds: [String(qa._id)] }], admin as never, { kind: "practice" })).rejects.toThrow(/cannot be added/);
    await expect(validateTestQuestions([{ name: "struktur_data", questionIds: [String(qa._id)] }], admin as never, { kind: "practice" })).resolves.toBeUndefined();
    expect(await Test.countDocuments({ kind: "general" })).toBe(3);
  });
});
