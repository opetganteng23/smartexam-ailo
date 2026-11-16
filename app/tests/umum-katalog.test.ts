import { describe, it, expect, afterAll, vi } from "vitest";
import { courseInput } from "@/lib/course-schemas";

describe("field katalog course (skema)", () => {
  const base = { track: "general", title: "Struktur Data" };
  it("video pengantar hanya YouTube atau Vimeo dan dinormalkan ke URL embed", () => {
    expect(courseInput.parse({ ...base, previewVideoUrl: "https://youtu.be/dQw4w9WgXcQ" }).previewVideoUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(courseInput.parse({ ...base, previewVideoUrl: "https://vimeo.com/123456789" }).previewVideoUrl).toBe("https://player.vimeo.com/video/123456789");
    expect(courseInput.parse({ ...base, previewVideoUrl: "" }).previewVideoUrl).toBeNull();
    for (const bad of ["javascript:alert(1)", "https://evil.example/x.mp4", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"]) expect(courseInput.safeParse({ ...base, previewVideoUrl: bad }).success, bad).toBe(false);
  });
  it("batas daftar dan panjang teks; tag dirapikan", () => {
    expect(courseInput.safeParse({ ...base, whatYouLearn: Array(9).fill("x") }).success).toBe(false);
    expect(courseInput.safeParse({ ...base, requirements: ["x".repeat(161)] }).success).toBe(false);
    expect(courseInput.safeParse({ ...base, targetAudience: "x".repeat(301) }).success).toBe(false);
    expect(courseInput.safeParse({ ...base, tags: ["a".repeat(31)] }).success).toBe(false);
    expect(courseInput.safeParse({ ...base, tags: Array(9).fill("t") }).success).toBe(false);
    expect(courseInput.parse({ ...base, tags: ["Stack", "stack", " Queue "] }).tags).toEqual(["stack", "queue"]);
    expect(courseInput.safeParse({ ...base, whatYouLearn: [{ $ne: 1 }] }).success).toBe(false);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("katalog course lewat API (database in-memory)", () => {
  it("disimpan, dihapus, dan tampil bagi peserta yang berhak saja", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_katalog_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit } = await import("@/models/Course");
    const { Category } = await import("@/models/Category");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const list = await import("@/app/api/admin/courses/route");
    const one = await import("@/app/api/admin/courses/[id]/route");
    const mine = await import("@/app/api/courses/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const A = await Institution.create({ name: "A", code: "AAA", modules: { learning: true } }), B = await Institution.create({ name: "B", code: "BBB", modules: { learning: true } });
    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const ua = await User.create({ email: "ua@t.id", role: "participant", status: "active", institutionId: A._id });
    const ub = await User.create({ email: "ub@t.id", role: "participant", status: "active", institutionId: B._id });
    const cat = await Category.create({ name: "Struktur Data", nameKey: "struktur data" });
    const req = (b: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    current = admin as never;
    const created = await list.POST(req({ track: "general", title: "SD", categoryId: String(cat._id), institutionIds: [String(A._id)], whatYouLearn: ["Stack", "Queue"], requirements: ["Dasar pemrograman"], targetAudience: "Mahasiswa S1", tags: ["Stack", "Queue"], previewVideoUrl: "https://youtu.be/dQw4w9WgXcQ", previewMode: false }));
    expect(created.status).toBe(201);
    const id = (await created.json()).id as string;
    await Unit.create({ courseId: id, title: "U1" });
    expect((await list.POST(req({ track: "general", title: "x", previewVideoUrl: "https://evil.example/v" }))).status).toBe(400);

    const row = (await (await list.GET()).json()).courses.find((c: { id: string }) => c.id === id);
    expect(row).toMatchObject({ whatYouLearn: ["Stack", "Queue"], requirements: ["Dasar pemrograman"], targetAudience: "Mahasiswa S1", tags: ["stack", "queue"], previewVideoUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });

    // Peserta yang berhak melihat katalog lengkap; peserta institusi lain tidak melihat course sama sekali.
    current = ua as never;
    const mj = (await (await mine.GET()).json()).courses[0];
    expect(mj).toMatchObject({ category: "Struktur Data", whatYouLearn: ["Stack", "Queue"], targetAudience: "Mahasiswa S1", tags: ["stack", "queue"], previewVideo: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    current = ub as never;
    expect((await (await mine.GET()).json()).courses).toEqual([]);

    // Mengosongkan video dan target pembaca menghapusnya dari dokumen.
    current = admin as never;
    const patch = await one.PATCH(req({ track: "general", title: "SD", categoryId: String(cat._id), institutionIds: [String(A._id)], previewVideoUrl: null, targetAudience: "", previewMode: false }, "PATCH"), { params: { id } });
    expect(patch.status).toBe(200);
    const doc = await Course.findById(id).lean();
    expect(doc?.previewVideoUrl).toBeUndefined();
    expect(doc?.targetAudience).toBeUndefined();
    expect(doc?.whatYouLearn).toEqual([]);
  });
});
