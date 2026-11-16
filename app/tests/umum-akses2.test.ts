import { describe, it, expect, afterAll, vi } from "vitest";

// Sisa tahap 1: jalur ITP yang belum lolos placement, keanggotaan kelas nonaktif/pindah, dan gerbang kelas lewat rute.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("akses course: itpBlocked dan keanggotaan kelas (database in-memory)", () => {
  it("peserta belum placement hanya melihat course umum; kelas nonaktif atau lama tidak memberi akses", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_akses2_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { Course, Unit } = await import("@/models/Course");
    const { Institution } = await import("@/models/Institution");
    const { ClassGroup, ClassMember } = await import("@/models/Cluster");
    const { Setting } = await import("@/models/Settings");
    const { User } = await import("@/models/User");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const { GET: courses } = await import("@/app/api/courses/route");
    const { GET: unitGet } = await import("@/app/api/units/[id]/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const I = await Institution.create({ name: "I", code: "III", modules: { learning: true } });
    const [kx, ky] = await Promise.all([ClassGroup.create({ name: "X", institutionId: I._id, capacity: 30 }), ClassGroup.create({ name: "Y", institutionId: I._id, capacity: 30 })]);
    const level = new Types.ObjectId();
    const mk = async (title: string, extra: Record<string, unknown>) => { const c = await Course.create({ title, active: true, ...extra }); await Unit.create({ courseId: c._id, title: `${title} U1` }); };
    await mk("Umum X", { track: "general", classIds: [kx._id] });
    await mk("Umum semua", { track: "general" });
    await mk("ITP", { levelId: level });
    const mkUser = (extra: Record<string, unknown>) => User.create({ email: `${new Types.ObjectId()}@t.id`, role: "participant", status: "active", institutionId: I._id, ...extra });
    const titles = async (u: unknown) => { current = u as never; const j = await (await courses()).json(); return { np: j.needsPlacement, t: (j.courses as { title: string }[]).map((c) => c.title).sort() }; };
    const open = async (u: unknown, title: string) => { current = u as never; return (await unitGet(new Request("http://x"), { params: { id: String((await Unit.findOne({ title: `${title} U1` }).lean())!._id) } })).status; };

    // Punya level tetapi belum placement (itpBlocked): course ITP tidak tampil dan tidak bisa dibuka; course umum tetap.
    const noPlacement = await mkUser({ currentLevelId: level });
    expect(await titles(noPlacement)).toEqual({ np: false, t: ["Umum semua"] });
    // Tanpa course umum sama sekali: perilaku lama, diarahkan ke placement.
    await Course.updateMany({ track: "general" }, { $set: { active: false } });
    expect(await titles(noPlacement)).toEqual({ np: true, t: [] });
    await Course.updateMany({ track: "general" }, { $set: { active: true } });
    const placed = await mkUser({ currentLevelId: level, placementAttemptId: new Types.ObjectId() });
    expect((await titles(placed)).t).toEqual(["ITP", "Umum semua"]);

    // Keanggotaan kelas: hanya yang aktif yang menentukan.
    const mover = await mkUser({});
    const old = await ClassMember.create({ classId: kx._id, userId: mover._id, method: "manual" });
    expect(await open(mover, "Umum X")).toBe(200);
    await ClassMember.updateOne({ _id: old._id }, { $set: { active: false } }); // dipindah: riwayat nonaktif tetap tersimpan
    await ClassMember.create({ classId: ky._id, userId: mover._id, method: "manual" });
    expect(await open(mover, "Umum X")).toBe(404);
    expect(await open(mover, "Umum semua")).toBe(200);
    expect((await titles(mover)).t).toEqual(["Umum semua"]);
  });
});
