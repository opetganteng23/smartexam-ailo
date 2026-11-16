import { describe, it, expect, afterAll, vi } from "vitest";
import { courseInput } from "@/lib/course-schemas";
import { classInput } from "@/lib/class-schemas";

const oid = "a".repeat(24);

describe("skema course dan kelas umum", () => {
  it("course umum boleh tanpa level; course ITP wajib punya level", () => {
    expect(courseInput.safeParse({ track: "general", title: "Struktur Data" }).success).toBe(true);
    expect(courseInput.safeParse({ track: "itp", title: "Reading" }).success).toBe(false);
    expect(courseInput.safeParse({ title: "Reading" }).success).toBe(false); // bawaan itp
    expect(courseInput.safeParse({ title: "Reading", levelId: oid }).success).toBe(true);
  });
  it("menolak id bukan ObjectId, track liar, dan daftar berlebihan", () => {
    expect(courseInput.safeParse({ track: "general", title: "x", categoryId: "$ne" }).success).toBe(false);
    expect(courseInput.safeParse({ track: "general", title: "x", institutionIds: [{ $ne: null }] }).success).toBe(false);
    expect(courseInput.safeParse({ track: "admin", title: "x" }).success).toBe(false);
    expect(courseInput.safeParse({ track: "general", title: "x", institutionIds: Array(201).fill(oid) }).success).toBe(false);
    expect(courseInput.safeParse({ track: "general", title: "x", accessMode: "free" }).success).toBe(false);
  });
  it("kelas boleh tanpa level", () => {
    expect(classInput.safeParse({ name: "Kelas A", capacity: 30 }).success).toBe(true);
    expect(classInput.safeParse({ name: "Kelas A", capacity: 30, levelId: null }).success).toBe(true);
    expect(classInput.safeParse({ name: "Kelas A", capacity: 30, levelId: "zzz" }).success).toBe(false);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("kategori dan course umum (API admin, database in-memory)", () => {
  it("otorisasi, nama kembar, hapus kategori terpakai, dan course umum tanpa level", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_kategori_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { Course } = await import("@/models/Course");
    const { User } = await import("@/models/User");
    const cats = await import("@/app/api/admin/categories/route");
    const cat = await import("@/app/api/admin/categories/[id]/route");
    const courses = await import("@/app/api/admin/courses/route");
    const course = await import("@/app/api/admin/courses/[id]/route");
    const mkUser = (role: "admin" | "participant" | "content_editor") => User.create({ email: `${new Types.ObjectId()}@t.id`, role, status: "active" });
    const admin = await mkUser("admin"), participant = await mkUser("participant"), editor = await mkUser("content_editor");
    const post = (url: string, body: unknown, method = "POST") => new Request(`http://x${url}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    // Otorisasi: peserta dan content_editor tidak boleh mengelola kategori; tanpa login 401.
    current = null;
    expect((await cats.GET()).status).toBe(401);
    for (const u of [participant, editor]) { current = u as never; expect((await cats.POST(post("/", { name: "X" }))).status).toBe(403); expect((await cats.GET()).status).toBe(403); }

    current = admin as never;
    const r1 = await cats.POST(post("/", { name: "Struktur Data" }));
    expect(r1.status).toBe(201);
    const id = (await r1.json()).id as string;
    expect((await cats.POST(post("/", { name: "  struktur   data " }))).status).toBe(409); // kembar tanpa memandang huruf besar dan spasi
    expect((await cats.POST(post("/", { name: "" }))).status).toBe(400);
    expect((await cats.POST(post("/", { name: "x".repeat(81) }))).status).toBe(400);
    expect((await cats.POST(post("/", { name: { $gt: "" } }))).status).toBe(400);

    // Course umum tanpa level, rujukan kategori diperiksa.
    expect((await courses.POST(post("/", { track: "general", title: "SD", categoryId: String(new Types.ObjectId()) }))).status).toBe(400);
    expect((await courses.POST(post("/", { track: "general", title: "SD", institutionIds: [String(new Types.ObjectId())] }))).status).toBe(400);
    expect((await courses.POST(post("/", { track: "itp", title: "Tanpa level" }))).status).toBe(400);
    const r2 = await courses.POST(post("/", { track: "general", title: "Struktur Data", categoryId: id }));
    expect(r2.status).toBe(201);
    const cid = (await r2.json()).id as string;
    const saved = await Course.findById(cid).lean();
    expect(saved?.levelId).toBeUndefined();
    expect(saved?.track).toBe("general");

    // Kategori yang dipakai tidak bisa dihapus; setelah course dilepas baru bisa.
    const ctx = { params: { id } };
    expect((await cat.DELETE(new Request("http://x"), ctx)).status).toBe(409);
    expect((await course.PATCH(post(`/${cid}`, { track: "general", title: "Struktur Data", categoryId: null }, "PATCH"), { params: { id: cid } })).status).toBe(200);
    expect((await Course.findById(cid).lean())?.categoryId).toBeUndefined();
    expect((await cat.DELETE(new Request("http://x"), ctx)).status).toBe(200);
    expect((await cat.DELETE(new Request("http://x"), { params: { id: "bukan-id" } })).status).toBe(404);

    // Course lama tanpa field track dibaca ITP di daftar admin.
    await Course.collection.insertOne({ title: "Lama", levelId: new Types.ObjectId(), active: true, order: 0 });
    const list = await (await courses.GET()).json();
    expect(list.courses.find((c: { title: string }) => c.title === "Lama").track).toBe("itp");
  });
});
