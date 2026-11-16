import { describe, it, expect, afterAll, vi } from "vitest";
import type { Types as T } from "mongoose";

// Tahap 1 (Smartexam Umum): akses course umum per institusi dan kelas, dijaga di level query dan di rute.
// MongoDB in-memory; tidak menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("akses course umum (database in-memory)", () => {
  it("peserta hanya melihat course institusi dan kelasnya; alur ITP lama tetap", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_akses_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { Course, Unit } = await import("@/models/Course");
    const { Institution } = await import("@/models/Institution");
    const { ClassGroup, ClassMember } = await import("@/models/Cluster");
    const { Material } = await import("@/models/Material");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const { participantCourseFilter, restrictedMaterialIds } = await import("@/lib/course-scope");
    const { LIVE } = await import("@/lib/course-access");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const [A, B, C] = await Promise.all([
      Institution.create({ name: "A", code: "AAA", modules: { learning: true } }),
      Institution.create({ name: "B", code: "BBB", modules: { learning: true } }),
      Institution.create({ name: "C", code: "CCC", modules: { learning: false } }),
    ]);
    const [kx, ky] = await Promise.all([
      ClassGroup.create({ name: "X", institutionId: A._id, capacity: 30 }), // kelas tanpa level
      ClassGroup.create({ name: "Y", institutionId: A._id, capacity: 30 }),
    ]);
    const level = new Types.ObjectId(), level2 = new Types.ObjectId();
    const mat = await Material.create({ title: "m", slug: "m-sd", kind: "rich", status: "published", contentHtml: "<p>x</p>" });
    const matB = await Material.create({ title: "mb", slug: "m-b", kind: "rich", status: "published", contentHtml: "<p>x</p>" });
    const mk = async (title: string, extra: Record<string, unknown>, materialIds: T.ObjectId[] = []) => {
      const c = await Course.create({ title, active: true, ...extra });
      await Unit.create({ courseId: c._id, title: `${title} U1`, materialIds });
      return c;
    };
    await mk("Umum semua", { track: "general" });
    await mk("Umum A", { track: "general", institutionIds: [A._id] }, [mat._id]);
    await mk("Umum A kelas X", { track: "general", institutionIds: [A._id], classIds: [kx._id] });
    await mk("Umum B", { track: "general", institutionIds: [B._id] }, [matB._id]);
    await mk("Umum berbayar", { track: "general", accessMode: "paid", priceIdr: 50000 });
    await mk("Umum draft", { track: "general", previewMode: true });
    await mk("Umum arsip", { track: "general", archived: true });
    await mk("ITP lama tanpa track", { levelId: level });
    await mk("ITP level lain", { levelId: level2, track: "itp" });

    const a1 = { _id: new Types.ObjectId(), institutionId: A._id, role: "participant" }; // institusi A tanpa kelas
    const a2 = { _id: new Types.ObjectId(), institutionId: A._id, role: "participant" }; // kelas X
    const a3 = { _id: new Types.ObjectId(), institutionId: A._id, role: "participant" }; // kelas Y
    const b1 = { _id: new Types.ObjectId(), institutionId: B._id, role: "participant" };
    const noInst = { _id: new Types.ObjectId(), role: "participant" };
    const itp = { _id: new Types.ObjectId(), institutionId: A._id, currentLevelId: level, role: "participant" };
    await ClassMember.create({ classId: kx._id, userId: a2._id, method: "manual" });
    await ClassMember.create({ classId: ky._id, userId: a3._id, method: "manual" });
    const seen = async (u: Parameters<typeof participantCourseFilter>[0], opts?: { itp?: boolean }) =>
      (await Course.find({ ...LIVE, ...(await participantCourseFilter(u, opts)) }).lean()).map((c) => c.title).sort();

    expect(await seen(a1)).toEqual(["Umum A", "Umum semua"]);
    expect(await seen(a2)).toEqual(["Umum A", "Umum A kelas X", "Umum semua"]);
    expect(await seen(a3)).toEqual(["Umum A", "Umum semua"]); // kelas lain tidak melihat course kelas X
    expect(await seen(b1)).toEqual(["Umum B", "Umum semua"]);
    expect(await seen(noInst)).toEqual(["Umum semua"]);
    // ITP: tepat seperti sebelumnya (course di level peserta, termasuk course lama tanpa field track), tanpa course umum A kelas X.
    expect(await seen(itp)).toEqual(["ITP lama tanpa track", "Umum A", "Umum semua"]);
    expect(await seen(itp, { itp: false })).toEqual(["Umum A", "Umum semua"]);
    // Course berbayar, draft, dan arsip tidak pernah masuk jalur ditetapkan.
    for (const u of [a1, a2, b1, itp]) expect((await seen(u)).filter((t) => /berbayar|draft|arsip/.test(t))).toEqual([]);

    // Materi yang hanya dipakai course umum institusi lain tidak boleh dibuka; milik sendiri boleh.
    expect((await restrictedMaterialIds(b1)).map(String)).toEqual([String(mat._id)]);
    expect((await restrictedMaterialIds(a1)).map(String)).toEqual([String(matB._id)]);

    // ---- Rute: tidak bisa membuka course atau unit lain lewat ID (IDOR) ----
    const { GET: courses } = await import("@/app/api/courses/route");
    const { GET: unitGet } = await import("@/app/api/units/[id]/route");
    const { User } = await import("@/models/User");
    const mkUser = (extra: Record<string, unknown>) => User.create({ email: `${new Types.ObjectId()}@t.id`, role: "participant", status: "active", ...extra });
    const uA2 = await mkUser({ institutionId: A._id });
    const uB1 = await mkUser({ institutionId: B._id });
    const uC1 = await mkUser({ institutionId: C._id });
    const uItp = await mkUser({ institutionId: A._id, currentLevelId: level, placementAttemptId: new Types.ObjectId() });
    const uNone = await mkUser({ institutionId: B._id });
    await ClassMember.create({ classId: kx._id, userId: uA2._id, method: "manual" });
    const titles = async (u: unknown) => { current = u as Record<string, unknown>; const j = await (await courses()).json(); return { needsPlacement: j.needsPlacement, titles: (j.courses as { title: string }[]).map((c) => c.title).sort() }; };

    expect(await titles(uA2)).toEqual({ needsPlacement: false, titles: ["Umum A", "Umum A kelas X", "Umum semua"] });
    expect(await titles(uB1)).toEqual({ needsPlacement: false, titles: ["Umum B", "Umum semua"] });
    expect(await titles(uItp)).toEqual({ needsPlacement: false, titles: ["ITP lama tanpa track", "Umum A", "Umum semua"] });
    // Modul Learning institusi mati: tidak ada course sama sekali.
    expect(await titles(uC1)).toEqual({ needsPlacement: false, titles: [] });
    // Peserta tanpa course umum dan tanpa placement: tetap diarahkan ke placement (perilaku lama).
    await Course.updateMany({ track: "general" }, { $set: { institutionIds: [new Types.ObjectId()] } });
    expect(await titles(uNone)).toEqual({ needsPlacement: true, titles: [] });

    // Unit course institusi lain tidak bisa dibuka dengan menebak ID.
    await Course.updateMany({ title: "Umum A" }, { $set: { institutionIds: [A._id] } });
    const unitOf = async (title: string) => String((await Unit.findOne({ title: `${title} U1` }).lean())!._id);
    const open = async (u: unknown, title: string) => { current = u as Record<string, unknown>; return (await unitGet(new Request("http://x"), { params: { id: await unitOf(title) } })).status; };
    expect(await open(uA2, "Umum A")).toBe(200);
    expect(await open(uB1, "Umum A")).toBe(404);
    expect(await open(uA2, "Umum A kelas X")).toBe(404); // course kelas X dibatasi ke institusi lain pada langkah di atas
    expect(await open(uItp, "ITP level lain")).toBe(404);
    expect(await open(uItp, "ITP lama tanpa track")).toBe(200);
    expect(await open(uItp, "Umum berbayar")).toBe(404);
    expect(await open(uA2, "Umum draft")).toBe(404);
    expect(await open(uA2, "Umum arsip")).toBe(404);
  });
});
