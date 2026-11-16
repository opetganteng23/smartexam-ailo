import { describe, it, expect, afterAll, vi } from "vitest";

// U2.5: soal berformat HTML disanitasi di server pada semua keluaran, termasuk bila data sudah kotor di database.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

const DIRTY = `<p>Halo<script>alert(1)</script><img src=x onerror=alert(1)><svg onload=alert(1)></svg></p><pre><code>if (a &lt; b) { x(); }</code></pre>`;

describe.skipIf(!safe)("teks soal HTML (database in-memory)", () => {
  it("pratinjau tes, daftar bank soal, dan simpan melalui skema membersihkan HTML; format dipertahankan saat duplikat", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_stem_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Question } = await import("@/models/Question");
    const { Test } = await import("@/models/Test");
    const preview = await import("@/app/api/admin/tests/[id]/preview/route");
    const list = await import("@/app/api/admin/questions/route");
    const dup = await import("@/app/api/admin/questions/[id]/duplicate/route");
    const { questionSchema } = await import("@/lib/admin-schemas");

    current = (await User.create({ email: "a@t.id", role: "admin", status: "active" })) as never;
    // Disimpan lewat skema: bersih sejak awal.
    const clean = questionSchema.parse({ section: "umum", type: "x", stem: DIRTY, stemFormat: "html", options: ["a", "b"], answerKey: 0, status: "draft" });
    expect(clean.stem).not.toMatch(/script|onerror|onload|svg/i);
    expect(clean.stem).toContain("<pre><code>");
    // Data kotor yang lolos ke database (mis. dari skrip lama) tetap dibersihkan saat dikirim.
    const raw = await Question.collection.insertOne({ section: "umum", type: "x", stem: DIRTY, stemFormat: "html", kind: "mcq", options: ["a", "b"], answerKey: 0, status: "draft", assetIds: [], tags: [] });
    const t = await Test.create({ name: "T", kind: "practice", sections: [{ name: "umum", durationSec: 600, questionIds: [raw.insertedId] }] });

    const res = await preview.GET(new Request("http://x"), { params: { id: String(t._id) } });
    const q = (await res.json()).sections[0].questions[0];
    expect(q.stemFormat).toBe("html");
    expect(q.stem).not.toMatch(/script|onerror|onload|<svg/i);
    expect(q.stem).toContain("<pre><code>");

    // Daftar bank soal mengirim ringkasan teks, bukan HTML.
    const l = await (await list.GET(new Request("http://x/api/admin/questions"))).json();
    expect(l.items[0].stem).not.toMatch(/<\/?(p|pre|code|img|script)/);
    expect(l.items[0].stem).toContain("if (a < b)");

    // Duplikat mempertahankan format HTML.
    const d = await dup.POST(new Request("http://x", { method: "POST" }), { params: { id: String(raw.insertedId) } });
    expect(d.status).toBe(201);
    const copy = await Question.findById((await d.json()).id).lean();
    expect(copy?.stemFormat).toBe("html");
  });
});
