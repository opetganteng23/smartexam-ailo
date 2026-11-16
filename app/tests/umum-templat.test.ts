import { describe, it, expect, afterAll, vi } from "vitest";
import { GENERAL_TEMPLATES, TEMPLATES } from "@/lib/course-templates";

describe("templat course", () => {
  it("kunci unik, ada preset umum dan preset TOEFL ITP terpisah, tanpa unit kosong nama", () => {
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.some((t) => t.track === "itp" && t.key === "toefl-itp")).toBe(true);
    expect(GENERAL_TEMPLATES.every((t) => t.track === "general" && t.modules.length > 0 && t.modules.every((m) => m.units.length > 0 && m.units.every((u) => u.trim())))).toBe(true);
    expect(GENERAL_TEMPLATES.find((t) => t.key === "general-weekly")!.modules.flatMap((m) => m.units)).toHaveLength(14);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("templat dan jalur berbayar (database in-memory)", () => {
  it("course dari templat Preview only, rujukan diperiksa, ITP butuh level; course berbayar tidak sampai ke peserta", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_templat_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Category } = await import("@/models/Category");
    const { Course, CourseModule, Unit } = await import("@/models/Course");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const tpl = await import("@/app/api/admin/course-templates/route");
    const adminCourses = await import("@/app/api/admin/courses/route");
    const mine = await import("@/app/api/courses/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } }); // paket TOEFL ITP mati (bawaan)
    const I = await Institution.create({ name: "I", code: "III", modules: { learning: true } });
    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active", institutionId: I._id });
    const cat = await Category.create({ name: "SD", nameKey: "sd" });
    const post = (b: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

    current = stu as never; expect((await tpl.GET()).status).toBe(403);
    expect((await tpl.POST(post({ templateKey: "general-basic", title: "x" }))).status).toBe(403);
    current = admin as never;
    // Paket TOEFL ITP di balik saklar: mati, preset ITP tidak ditawarkan dan tidak bisa dibuat.
    const off = (await (await tpl.GET()).json()).templates as { key: string }[];
    expect(off.map((t) => t.key)).toEqual(expect.arrayContaining(["general-basic", "general-weekly"]));
    expect(off.map((t) => t.key)).not.toContain("toefl-itp");
    expect((await tpl.POST(post({ templateKey: "toefl-itp", levelId: String(new Types.ObjectId()) }))).status).toBe(404);
    await Setting.updateOne({ key: "features" }, { value: { ...FEATURE_DEFAULTS, learning: true, itpPack: true } });
    const list = (await (await tpl.GET()).json()).templates as { key: string }[];
    expect(list.map((t) => t.key)).toEqual(expect.arrayContaining(["general-basic", "general-weekly", "toefl-itp"]));

    const ok = await tpl.POST(post({ templateKey: "general-weekly", title: "Struktur Data", categoryId: String(cat._id), institutionIds: [String(I._id)] }));
    expect(ok.status).toBe(201);
    const r = await ok.json();
    expect(r).toMatchObject({ modules: 2, units: 14 });
    const c = (await Course.findById(r.id).lean())!;
    expect(c).toMatchObject({ track: "general", previewMode: true, title: "Struktur Data" });
    expect(await CourseModule.countDocuments({ courseId: c._id })).toBe(2);
    expect(await Unit.countDocuments({ courseId: c._id })).toBe(14);
    expect((await Unit.find({ courseId: c._id }).sort({ order: 1 }).lean()).map((u) => u.order)).toEqual(Array.from({ length: 14 }, (_, i) => i));

    // Preview only: peserta tidak melihatnya sampai dirilis.
    current = stu as never;
    expect((await (await mine.GET()).json()).courses).toEqual([]);
    await Course.updateOne({ _id: c._id }, { previewMode: false });
    expect((await (await mine.GET()).json()).courses.map((x: { title: string }) => x.title)).toEqual(["Struktur Data"]);

    // Validasi.
    current = admin as never;
    expect((await tpl.POST(post({ templateKey: "tidak-ada", title: "x" }))).status).toBe(404);
    expect((await tpl.POST(post({ templateKey: "general-basic" }))).status).toBe(400);
    expect((await tpl.POST(post({ templateKey: "general-basic", title: "x", categoryId: String(new Types.ObjectId()) }))).status).toBe(400);
    expect((await tpl.POST(post({ templateKey: "general-basic", title: "x", categoryId: "$ne" }))).status).toBe(400);
    expect((await tpl.POST(post({ templateKey: "toefl-itp" }))).status).toBe(400); // butuh level
    expect((await tpl.POST(post({ templateKey: "toefl-itp", levelId: String(new Types.ObjectId()) }))).status).toBe(404);
    expect(await Course.countDocuments()).toBe(1);

    // U6.5: jalur berbayar hanya data. Course berbayar tersimpan dengan harga tetapi tidak pernah masuk daftar peserta.
    const paid = await adminCourses.POST(post({ track: "general", title: "Berbayar", accessMode: "paid", priceIdr: 150000, previewMode: false }));
    expect(paid.status).toBe(201);
    const pid = (await paid.json()).id as string;
    await Unit.create({ courseId: pid, title: "P1" });
    expect(await Course.findById(pid).lean()).toMatchObject({ accessMode: "paid", priceIdr: 150000 });
    current = stu as never;
    expect((await (await mine.GET()).json()).courses.map((x: { title: string }) => x.title)).not.toContain("Berbayar");
  });
});
