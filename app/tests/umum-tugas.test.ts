import { describe, it, expect, afterAll, vi } from "vitest";
import { safeFileName, sniffAssignmentFile } from "@/lib/assignment-store";
import { assignmentInput } from "@/lib/assignment-schemas";

const PDF = Buffer.from("%PDF-1.4\n" + "x".repeat(400));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60)]);

describe("berkas tugas", () => {
  it("jenis dikenali dari byte awal; skrip, HTML, SVG, dan program ditolak", () => {
    expect(sniffAssignmentFile(PDF)?.mime).toBe("application/pdf");
    expect(sniffAssignmentFile(PNG)?.mime).toBe("image/png");
    expect(sniffAssignmentFile(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]))?.mime).toBe("image/jpeg");
    expect(sniffAssignmentFile(ZIP)?.ext).toBe("zip");
    for (const bad of ["<html><script>alert(1)</script></html>", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "MZ\u0090\u0000programdos", "#!/bin/sh\nrm -rf /", "GIF89a....", ""]) expect(sniffAssignmentFile(Buffer.from(bad)), bad).toBeNull();
  });
  it("nama berkas dibersihkan dari jalur dan karakter berbahaya", () => {
    expect(safeFileName("../../etc/passwd.pdf", "pdf")).toBe("passwd.pdf");
    expect(safeFileName('C:\\Users\\x\\tugas "akhir".pdf', "pdf")).toBe("tugas _akhir_.pdf");
    expect(safeFileName("<script>.png", "png")).not.toMatch(/[<>]/);
    expect(safeFileName("", "pdf")).toBe("submission.pdf");
    expect(safeFileName("a".repeat(300) + ".pdf", "pdf").length).toBeLessThanOrEqual(84);
  });
  it("skema tugas: batas dan rujukan wajib", () => {
    const base = { courseId: "a".repeat(24), title: "Tugas 1" };
    expect(assignmentInput.safeParse(base).success).toBe(true);
    expect(assignmentInput.safeParse({ ...base, kind: "test" }).success).toBe(false);
    expect(assignmentInput.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(assignmentInput.safeParse({ ...base, maxPoints: 0 }).success).toBe(false);
    expect(assignmentInput.safeParse({ ...base, maxSubmissions: 21 }).success).toBe(false);
    expect(assignmentInput.safeParse({ ...base, courseId: "$ne" }).success).toBe(false);
    expect(assignmentInput.safeParse({ ...base, instructions: "x".repeat(3001) }).success).toBe(false);
  });
});

const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("tugas di course umum (database in-memory)", () => {
  it("akses, pengumpulan aman, tenggat, batas, unduhan, penilaian, dan penghapusan", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("umum_tugas_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const mongoose = (await import("mongoose")).default;
    const { Types } = await import("mongoose");
    const { User } = await import("@/models/User");
    const { Institution } = await import("@/models/Institution");
    const { Course, Unit } = await import("@/models/Course");
    const { Test, Attempt } = await import("@/models/Test");
    const { Submission } = await import("@/models/Assignment");
    const { AuditLog } = await import("@/models/AuditLog");
    const { Setting } = await import("@/models/Settings");
    const { FEATURE_DEFAULTS } = await import("@/lib/features");
    const adminList = await import("@/app/api/admin/assignments/route");
    const adminOne = await import("@/app/api/admin/assignments/[id]/route");
    const adminSubs = await import("@/app/api/admin/assignments/[id]/submissions/route");
    const grade = await import("@/app/api/admin/assignments/[id]/submissions/[sid]/route");
    const mine = await import("@/app/api/courses/[id]/assignments/route");
    const submit = await import("@/app/api/assignments/[id]/submit/route");
    const download = await import("@/app/api/assignments/[id]/submissions/[sid]/file/route");

    await Setting.create({ key: "features", value: { ...FEATURE_DEFAULTS, learning: true } });
    const A = await Institution.create({ name: "A", code: "AAA", modules: { learning: true } }), B = await Institution.create({ name: "B", code: "BBB", modules: { learning: true } });
    const admin = await User.create({ email: "ad@t.id", role: "admin", status: "active" });
    const a1 = await User.create({ email: "a1@t.id", role: "participant", status: "active", institutionId: A._id });
    const a2 = await User.create({ email: "a2@t.id", role: "participant", status: "active", institutionId: A._id });
    const b1 = await User.create({ email: "b1@t.id", role: "participant", status: "active", institutionId: B._id });
    const course = await Course.create({ title: "SD", track: "general", active: true, institutionIds: [A._id] });
    const otherCourse = await Course.create({ title: "Lain", track: "general", active: true });
    const itpCourse = await Course.create({ title: "ITP", levelId: new Types.ObjectId(), active: true });
    const unit = await Unit.create({ courseId: course._id, title: "U1" });
    const foreignUnit = await Unit.create({ courseId: otherCourse._id, title: "UX" });
    const gtest = await Test.create({ name: "Kuis", kind: "general", sections: [{ name: "umum", durationSec: 600, questionIds: [new Types.ObjectId()] }] });
    const ptest = await Test.create({ name: "Placement", kind: "placement", sections: [{ name: "umum", durationSec: 600, questionIds: [new Types.ObjectId()] }] });
    const as = (u: unknown) => { current = u as never; };
    const json = (b: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const ctx = (id: unknown, sid: unknown = "") => ({ params: { id: String(id), sid: String(sid) } });
    const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

    // Admin: rujukan diperiksa; peserta tidak boleh membuat tugas.
    as(admin);
    const base = { courseId: String(course._id), title: "Tugas 1", maxSubmissions: 2, dueAt: hours(1) };
    expect((await adminList.POST(json({ ...base, unitId: String(foreignUnit._id) }))).status).toBe(400);
    expect((await adminList.POST(json({ ...base, courseId: String(itpCourse._id) }))).status).toBe(400);
    expect((await adminList.POST(json({ ...base, kind: "test", testId: String(ptest._id) }))).status).toBe(400);
    expect((await adminList.POST(json({ ...base, kind: "test" }))).status).toBe(400);
    as(a1); expect((await adminList.POST(json(base))).status).toBe(403);
    as(admin);
    const mk = async (extra: Record<string, unknown>) => (await (await adminList.POST(json({ ...base, unitId: String(unit._id), ...extra }))).json()).id as string;
    const t1 = await mk({});
    const tLate = await mk({ title: "Lewat", dueAt: hours(-2) });
    const tLateOk = await mk({ title: "Lewat boleh", dueAt: hours(-2), allowLate: true });
    const tMany = await mk({ title: "Banyak", maxSubmissions: 0, dueAt: null });
    const tOne = await mk({ title: "Satu", maxSubmissions: 1, dueAt: null });
    const tTest = await mk({ title: "Berbasis soal", kind: "test", testId: String(gtest._id), dueAt: null });

    const form = (fields: Record<string, string | File>) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.set(k, v); return new Request("http://x", { method: "POST", body: fd }); };
    const send = async (u: unknown, id: string, fields: Record<string, string | File>) => { as(u); const r = await submit.POST(form(fields), ctx(id)); return { status: r.status, body: await r.json() }; };
    const file = (data: Buffer | string, name: string) => new File([data as BlobPart], name);

    // Institusi lain: tidak melihat, tidak mengumpulkan, tidak mengunduh.
    as(b1); expect((await mine.GET(new Request("http://x"), ctx(course._id))).status).toBe(404);
    expect((await send(b1, t1, { text: "intip" })).status).toBe(404);

    // Pengumpulan: teks, berkas sah, batas, kosong, tipe palsu, terlalu besar.
    const s1 = await send(a1, t1, { text: "Jawaban <script>alert(1)</script>saya" });
    expect(s1.status).toBe(201);
    expect((await Submission.findById(s1.body.id).lean())?.text).toBe("Jawaban saya");
    const s2 = await send(a1, t1, { file: file(PDF, "../../tugas \"akhir\".pdf") });
    expect(s2.status).toBe(201);
    expect(s2.body.attemptNo).toBe(2);
    expect((await send(a1, t1, { text: "ketiga" })).status).toBe(403); // batas 2
    expect((await send(a2, tMany, {})).status).toBe(400);
    expect((await send(a2, tMany, { file: file("<html><script>alert(1)</script></html>", "tugas.pdf") })).status).toBe(415);
    expect((await send(a2, tMany, { file: file('<svg onload="alert(1)"/>', "gambar.png") })).status).toBe(415);
    expect((await send(a2, tMany, { file: file(Buffer.concat([PDF, Buffer.alloc(11 * 1024 * 1024)]), "besar.pdf") })).status).toBe(413);
    expect((await send(a2, tMany, { text: "x".repeat(5001) })).status).toBe(400);
    expect((await send(a2, tTest, { text: "tes" })).status).toBe(409); // tugas berbasis soal dikerjakan di tesnya
    const ok2 = await send(a2, tMany, { file: file(ZIP, "laporan.docx") });
    expect(ok2.status).toBe(201);

    // Tenggat: lewat ditolak; lewat tetapi diizinkan ditandai terlambat.
    expect((await send(a1, tLate, { text: "telat" })).status).toBe(403);
    const late = await send(a1, tLateOk, { text: "telat boleh" });
    expect(late.status).toBe(201);
    expect(late.body.late).toBe(true);

    // Balapan: dua kiriman bersamaan pada tugas satu kali menyisakan satu.
    const [r1, r2] = await Promise.all([send(a2, tOne, { file: file(PDF, "a.pdf") }), send(a2, tOne, { file: file(PDF, "b.pdf") })]);
    expect([r1.status, r2.status].filter((s) => s === 201)).toHaveLength(1);
    expect([r1.status, r2.status].filter((s) => s !== 201).every((s) => s === 403 || s === 409)).toBe(true);
    expect(await Submission.countDocuments({ assignmentId: tOne, userId: a2._id })).toBe(1);
    const files = mongoose.connection.db!.collection("assignments.files");
    expect(await files.countDocuments({ "metadata.assignmentId": tOne })).toBe(1); // tidak ada berkas yatim

    // Daftar milik sendiri: nilai dan umpan balik tersembunyi sebelum dinilai.
    as(a1);
    const lst = (await (await mine.GET(new Request("http://x"), ctx(course._id))).json()).assignments as { id: string; canSubmit: boolean; reason: string | null; submissions: { points: number | null; file: { name: string } | null }[]; test: { best: number | null } | null }[];
    const row = lst.find((a) => a.id === t1)!;
    expect(row.canSubmit).toBe(false);
    expect(row.submissions).toHaveLength(2);
    expect(row.submissions[1].file?.name).toBe("tugas _akhir_.pdf");
    expect(row.submissions.every((s) => s.points === null)).toBe(true);
    expect(lst.find((a) => a.id === tLate)?.reason).toMatch(/deadline/i);
    await Attempt.create({ userId: a1._id, testId: gtest._id, kind: "general", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), scoreEst: 80 });
    expect((await (await mine.GET(new Request("http://x"), ctx(course._id))).json()).assignments.find((a: { id: string }) => a.id === tTest).test).toMatchObject({ best: 80 });

    // Unduhan: pemilik dan staf; orang lain 404; selalu attachment.
    const sub = (await Submission.findOne({ assignmentId: t1, attemptNo: 2 }).lean())!;
    const dl = (u: unknown) => { as(u); return download.GET(new Request("http://x"), ctx(t1, sub._id)); };
    const ownerDl = await dl(a1);
    expect(ownerDl.status).toBe(200);
    expect(ownerDl.headers.get("content-disposition")).toMatch(/^attachment; filename="tugas _akhir_\.pdf"$/);
    expect(ownerDl.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ownerDl.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await ownerDl.arrayBuffer()).equals(PDF)).toBe(true);
    expect((await dl(a2)).status).toBe(404);
    expect((await dl(b1)).status).toBe(404);
    expect((await dl(admin)).status).toBe(200);
    as(null); expect((await download.GET(new Request("http://x"), ctx(t1, sub._id))).status).toBe(401);

    // Penilaian: batas poin, hanya staf; setelah dinilai peserta melihat nilai dan umpan balik.
    as(a1); expect((await adminSubs.GET(new Request("http://x"), ctx(t1))).status).toBe(403);
    as(admin);
    const sl = await (await adminSubs.GET(new Request("http://x"), ctx(t1))).json();
    expect(sl.submissions).toHaveLength(2);
    expect(sl.submissions.find((s: { attemptNo: number }) => s.attemptNo === 2).file.url).toContain("/file");
    expect((await grade.PATCH(json({ points: 150 }, "PATCH"), ctx(t1, sub._id))).status).toBe(400);
    expect((await grade.PATCH(json({ points: -1 }, "PATCH"), ctx(t1, sub._id))).status).toBe(400);
    expect((await grade.PATCH(json({ points: 87.5, feedback: "Bagus" }, "PATCH"), ctx(t1, sub._id))).status).toBe(200);
    expect((await grade.PATCH(json({ points: 5 }, "PATCH"), ctx(tMany, sub._id))).status).toBe(404); // kiriman bukan milik tugas ini
    as(a1);
    const after = (await (await mine.GET(new Request("http://x"), ctx(course._id))).json()).assignments.find((a: { id: string }) => a.id === t1);
    expect(after.submissions[1]).toMatchObject({ points: 87.5, feedback: "Bagus", status: "graded" });
    expect(await AuditLog.countDocuments({ action: { $in: ["assignment.submit", "assignment.grade", "assignment.create"] } })).toBeGreaterThanOrEqual(8);

    // Hapus: dijaga bila ada kiriman; nonaktif menghilangkan dari daftar peserta.
    as(admin);
    expect((await adminOne.DELETE(json(undefined, "DELETE"), ctx(t1))).status).toBe(409);
    const upd = await adminOne.PATCH(json({ ...base, unitId: String(unit._id), active: false }, "PATCH"), ctx(t1));
    expect(upd.status).toBe(200);
    as(a1);
    expect((await (await mine.GET(new Request("http://x"), ctx(course._id))).json()).assignments.some((a: { id: string }) => a.id === t1)).toBe(false);
    as(admin);
    expect((await adminOne.DELETE(json(undefined, "DELETE"), ctx(tTest))).status).toBe(200); // tanpa kiriman: boleh
  });
});
