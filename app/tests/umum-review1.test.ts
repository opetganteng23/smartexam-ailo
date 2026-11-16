import { describe, it, expect, afterAll, vi } from "vitest";
import { courseInput } from "@/lib/course-schemas";

describe("skema course umum", () => {
  it("course umum selalu tanpa level walau klien mengirim levelId", () => {
    const r = courseInput.parse({ track: "general", title: "SD", levelId: "a".repeat(24) });
    expect(r.levelId).toBeNull();
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("perbaikan tinjauan tahap 1 (database in-memory)", () => {
  it("PATCH tanpa track tidak mengubah course umum; hapus kelas dan institusi membersihkan rujukan", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_review1_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Course } = await import("@/models/Course");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { ClassGroup } = await import("@/models/Cluster");
    const course = await import("@/app/api/admin/courses/[id]/route");
    const cls = await import("@/app/api/admin/classes/[id]/route");
    const inst = await import("@/app/api/admin/institutions/[id]/route");
    current = (await User.create({ email: "a@t.id", role: "admin", status: "active" })) as never;
    const I = await Institution.create({ name: "I", code: "III" });
    const K = await ClassGroup.create({ name: "K", institutionId: I._id, capacity: 10 });
    const c = await Course.create({ title: "SD", track: "general", active: true, institutionIds: [I._id], classIds: [K._id] });
    const req = (body: unknown) => new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    expect((await course.PATCH(req({ title: "SD baru" }), { params: { id: String(c._id) } })).status).toBe(200);
    expect((await Course.findById(c._id).lean())?.track).toBe("general");

    expect((await cls.DELETE(new Request("http://x"), { params: { id: String(K._id) } })).status).toBe(200);
    expect((await Course.findById(c._id).lean())?.classIds).toEqual([]);
    expect((await inst.DELETE(new Request("http://x"), { params: { id: String(I._id) } })).status).toBe(200);
    expect((await Course.findById(c._id).lean())?.institutionIds).toEqual([]);
  });
});
