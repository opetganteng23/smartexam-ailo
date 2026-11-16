import { describe, it, expect, afterAll, vi } from "vitest";

// U6.3: sertifikat penyelesaian course umum (bukan skala ITP), idempoten, terverifikasi, dan hanya milik pemiliknya.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("sertifikat penyelesaian course (database in-memory)", () => {
  it("terbit saat semua unit selesai, sekali saja, hanya untuk course umum, dan dapat diverifikasi", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_sertifikat_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit, CourseProgress } = await import("@/models/Course");
    const { Material } = await import("@/models/Material");
    const { Certificate } = await import("@/models/Certificate");
    const { markMaterialDone } = await import("@/lib/units");
    const { ensureCourseCertificate } = await import("@/lib/course-certificate");
    const list = await import("@/app/api/certificates/route");
    const pdf = await import("@/app/api/certificates/[id]/pdf/route");
    const verify = await import("@/app/api/certificates/verify/[number]/route");

    const I = await Institution.create({ name: "I", code: "III", modules: { learning: true } });
    const stu = await User.create({ email: "s@t.id", role: "participant", status: "active", name: "Siti Rahma Dewi", institutionId: I._id });
    const other = await User.create({ email: "o@t.id", role: "participant", status: "active", name: "Budi", institutionId: I._id });
    const mat = (n: string) => Material.create({ title: n, slug: `m-${n}`, kind: "rich", status: "published", contentHtml: "<p>x</p>" });
    const [m1, m2, m3, m4] = await Promise.all([mat("1"), mat("2"), mat("3"), mat("4")]);

    // Course umum dua unit.
    const course = await Course.create({ title: "Struktur Data", track: "general", active: true });
    await Unit.create({ courseId: course._id, title: "U1", materialIds: [m1._id], order: 1 });
    await Unit.create({ courseId: course._id, title: "U2", materialIds: [m2._id], order: 2 });
    await markMaterialDone(stu as never, m1._id);
    expect(await Certificate.countDocuments()).toBe(0); // baru satu unit
    await markMaterialDone(stu as never, m2._id);
    expect(await Certificate.countDocuments({ type: "course_completion" })).toBe(1);
    await markMaterialDone(stu as never, m2._id); // diulang: tidak menggandakan
    await ensureCourseCertificate(stu._id, course._id);
    expect(await Certificate.countDocuments()).toBe(1);
    const cert = (await Certificate.findOne().lean())!;
    expect(cert.number).toMatch(/^SMX-CRS-\d{4}-\d{6}$/);
    expect(cert.data).toMatchObject({ courseTitle: "Struktur Data" });

    // Course ITP (tanpa track) dan course tanpa unit tidak menerbitkan sertifikat; ujian per bagian wajib belum lulus menahannya.
    const itp = await Course.create({ title: "Reading", levelId: new Types.ObjectId(), active: true });
    await Unit.create({ courseId: itp._id, title: "I1", materialIds: [m3._id] });
    expect(await ensureCourseCertificate(stu._id, itp._id)).toBeNull();
    const empty = await Course.create({ title: "Kosong", track: "general", active: true });
    expect(await ensureCourseCertificate(stu._id, empty._id)).toBeNull();
    const gated = await Course.create({ title: "Dengan ujian", track: "general", active: true, requireSectionTest: true, sectionTestId: new Types.ObjectId() });
    await Unit.create({ courseId: gated._id, title: "G1", materialIds: [m4._id] });
    await markMaterialDone(stu as never, m4._id);
    expect(await Certificate.countDocuments()).toBe(1);
    await CourseProgress.create({ userId: stu._id, courseId: gated._id, sectionTestPassed: true });
    expect(await ensureCourseCertificate(stu._id, gated._id)).toBeTruthy();
    expect(await Certificate.countDocuments()).toBe(2);

    // Daftar milik sendiri, PDF hanya pemilik, verifikasi publik memasker nama.
    current = stu as never;
    const mine = (await (await list.GET()).json()).certificates as { id: string; type: string; number: string }[];
    expect(mine.map((c) => c.type)).toEqual(["course_completion", "course_completion"]);
    const first = mine.find((c) => c.number === cert.number)!;
    const ok = await pdf.GET(new Request("http://x"), { params: { id: first.id } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
    current = other as never;
    expect((await list.GET().then((r) => r.json())).certificates).toEqual([]);
    expect((await pdf.GET(new Request("http://x"), { params: { id: first.id } })).status).toBe(404);

    current = null;
    const v = await verify.GET(new Request("http://x"), { params: { number: cert.number } });
    const vj = await v.json();
    expect(v.status).toBe(200);
    expect(vj).toMatchObject({ valid: true, type: "course_completion", course: "Struktur Data", official: false });
    expect(vj.holder).not.toContain("Rahma");
    expect(JSON.stringify(vj)).not.toContain("s@t.id");
    expect((await verify.GET(new Request("http://x"), { params: { number: "SMX-CRS-2026-999999" } })).status).toBe(404);
    expect((await verify.GET(new Request("http://x"), { params: { number: "../etc/passwd" } })).status).toBe(404);
  });
});
