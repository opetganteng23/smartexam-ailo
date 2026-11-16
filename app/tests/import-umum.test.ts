import { describe, it, expect, afterAll, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseMoodleXml, MoodleError, MOODLE_MAX_BYTES } from "@/lib/import-moodle";
import { moodleToQuestions, sniffImage } from "@/lib/import-save";
import { sanitizeQuestionHtml, htmlToText } from "@/lib/question-html";
import { questionHash } from "@/lib/question-hash";
import { mapQuestionRows } from "@/lib/import-questions";

const xml = readFileSync(path.join(__dirname, "fixtures", "moodle-sintetis.xml"), "utf8");
const ctx = { section: "umum", status: "draft" as const, defaultSkill: "struktur_data", categoryId: null, collectionId: null };
const urls = new Map([["titik.png", "/api/assets/" + "a".repeat(24)]]);

describe("parser Moodle XML", () => {
  const r = parseMoodleXml(xml);
  it("membaca lima jenis, melewati yang tidak didukung dan melaporkannya", () => {
    expect(r.total).toBe(11); // entri category tidak dihitung
    expect(r.items.map((i) => i.kind)).toEqual(["mcq", "mcq", "mcq", "short", "matching", "essay", "mcq", "mcq", "mcq"]);
    expect(r.skipped.map((s) => [s.type, s.reason])).toEqual([
      ["multichoice", "Multiple correct answers (single=false) are not supported"],
      ["numerical", 'Question type "numerical" is not supported'],
    ]);
  });
  it("memetakan kunci tiap jenis", () => {
    const [kode, , tf, short, match, essay] = r.items;
    expect(kode.options).toEqual(["4", "6", "8", "10"]); // opsi HTML jadi teks
    expect(kode.answerKey).toBe(1);
    expect(kode.tags).toEqual(["struktur-data:dasar"]);
    expect(tf.options).toEqual(["true", "false"]);
    expect(tf.answerKey).toBe(1);
    expect(short.key).toEqual({ accepted: ["push", "PUSH()"], caseSensitive: false });
    expect(short.points).toBe(2);
    expect((match.key as { pairs: unknown[] }).pairs).toHaveLength(3); // pengecoh tanpa sisi kiri dibuang
    expect(essay.key).toEqual({ rubric: [{ criterion: "Answer quality", points: 10 }], guide: "Bahas akses acak dan penyisipan." });
  });
  it("menerima BOM UTF-8", () => {
    expect(parseMoodleXml("﻿" + xml).items).toHaveLength(9);
  });
});

describe("keamanan impor XML", () => {
  it("menolak DOCTYPE dan entity (XXE, billion laughs)", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE quiz [<!ENTITY x SYSTEM "file:///etc/passwd">]><quiz><question type="essay"><name><text>a</text></name><questiontext><text>&x;</text></questiontext></question></quiz>`;
    expect(() => parseMoodleXml(xxe)).toThrow(MoodleError);
    const laugh = `<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><quiz><question type="essay"><questiontext><text>&b;</text></questiontext></question></quiz>`;
    expect(() => parseMoodleXml(laugh)).toThrow(/DOCTYPE/);
  });
  it("menolak berkas kosong, bukan XML, bukan Moodle, dan terlalu besar atau banyak", () => {
    expect(() => parseMoodleXml("")).toThrow(MoodleError);
    expect(() => parseMoodleXml("{ bukan xml")).toThrow(MoodleError);
    expect(() => parseMoodleXml("<html><body/></html>")).toThrow(/quiz/);
    expect(() => parseMoodleXml("<quiz></quiz>")).toThrow(/No questions/);
    expect(() => parseMoodleXml(" ".repeat(MOODLE_MAX_BYTES + 1))).toThrow(/10 MB/);
    const many = "<quiz>" + '<question type="essay"><name><text>q</text></name><questiontext><text>x</text></questiontext></question>'.repeat(501) + "</quiz>";
    expect(() => parseMoodleXml(many)).toThrow(/Maximum 500/);
  });
  it("laporan galat tidak membocorkan tumpukan", () => {
    try { parseMoodleXml("<quiz><question"); } catch (e) { expect(String((e as Error).stack ?? "").length).toBeGreaterThan(0); expect((e as Error).message).not.toMatch(/at |node_modules|\.ts/); }
  });
});

describe("HTML soal disanitasi (XSS)", () => {
  const { ok, failed } = moodleToQuestions(parseMoodleXml(xml).items, urls, ctx);
  const xss = ok.find((q) => q.label === "Soal 09 xss")!.data.stem;
  it("tidak ada vektor aktif yang tersisa, kode dan gambar sah dipertahankan", () => {
    for (const bad of ["<script", "onerror", "onclick", "javascript:", "<svg", "<iframe", "<style", "data:", "evil.example"]) expect(xss.toLowerCase()).not.toContain(bad);
    expect(xss).toContain("<pre><code>x &lt; y</code></pre>");
    const img = ok.find((q) => q.label === "Soal 10 gambar")!.data;
    expect(img.stemFormat).toBe("html");
    expect(img.stem).toContain(`src="/api/assets/${"a".repeat(24)}"`);
    expect(failed).toEqual([]);
  });
  it("sanitizer menolak payload klasik", () => {
    const payloads = ['<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '<a href="javascript:alert(1)">x</a>', '<iframe src="https://e.x"></iframe>', '<style>a{}</style>', '<img src="data:image/png;base64,AAAA">', '<img src="https://e.x/a.png">', '<p style="x:y" onmouseover="a()">t</p>'];
    for (const p of payloads) { const out = sanitizeQuestionHtml(p).toLowerCase(); expect(out).not.toMatch(/onerror|onload|javascript|<iframe|<style|data:|https?:|onmouseover|style=/); }
  });
  it("gambar yang tidak ada di berkas membuat soal gagal dengan alasan", () => {
    const { ok: o, failed: f } = moodleToQuestions(parseMoodleXml(xml).items, new Map(), ctx);
    expect(f.map((x) => x.row)).toEqual(["Soal 10 gambar"]);
    expect(o).toHaveLength(8);
  });
  it("htmlToText mempertahankan isi kode", () => expect(htmlToText("<pre><code>a &lt; b &amp;&amp; c</code></pre>")).toBe("a < b && c"));
});

describe("tipe gambar dari byte", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  it("menerima PNG, JPEG, GIF, WebP; menolak SVG, skrip, dan berkas palsu", () => {
    expect(sniffImage(png)).toBe("image/png");
    expect(sniffImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("GIF89a" + "x".repeat(20)))).toBe("image/gif");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]))).toBe("image/webp");
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from("MZ" + "x".repeat(40)))).toBeNull();
    expect(sniffImage(Buffer.from("<script>alert(1)</script> padding padding"))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe("sidik duplikat", () => {
  it("tidak peka huruf, spasi, dan urutan opsi; peka terhadap kunci", () => {
    const a = questionHash({ stem: "Apa  itu Stack?", options: ["A", "B", "C"], answerKey: 1 });
    expect(questionHash({ stem: "apa itu stack?", options: ["c", "b", "a"], answerKey: 1 })).toBe(a);
    expect(questionHash({ stem: "Apa itu Stack?", options: ["A", "B", "C"], answerKey: 0 })).not.toBe(a);
    expect(questionHash({ kind: "short", stem: "x", key: { accepted: ["Push"] } })).toBe(questionHash({ kind: "short", stem: "X ", key: { accepted: ["push"] } }));
  });
});

describe("impor CSV semua jenis dan kategori bebas", () => {
  const head = ["section", "type", "stem", "A", "B", "answer", "kind", "points", "pairs", "accepted", "rubric", "guide"];
  it("menerima kategori bebas dan membaca jenis mencocokkan, isian, dan essay", () => {
    const rows = mapQuestionRows([head,
      ["Struktur Data", "dasar", "Pilih", "x", "y", "B", "", "", "", "", "", ""],
      ["struktur_data", "pasangan", "Pasangkan", "", "", "", "matching", "2", "Stack=LIFO; Queue=FIFO", "", "", ""],
      ["struktur_data", "isian", "Isi", "", "", "", "short", "1", "", "push|PUSH", "", ""],
      ["struktur_data", "uraian", "Jelaskan", "", "", "", "essay", "10", "", "", "Konsep:6; Contoh:4", "panduan"],
      ["struktur_data", "x", "Salah", "", "", "", "aneh", "", "", "", "", ""],
      ["1abc", "x", "Salah bagian", "a", "b", "A", "", "", "", "", "", ""],
      ["struktur_data", "x", "Rubrik salah", "", "", "", "essay", "10", "", "", "Konsep:6", ""],
    ]);
    expect(rows.map((r) => r.ok)).toEqual([true, true, true, true, false, false, false]);
    const ok = rows.filter((r) => r.ok) as Extract<(typeof rows)[number], { ok: true }>[];
    expect(ok[0].data.section).toBe("struktur_data");
    expect(ok.map((r) => r.data.kind)).toEqual(["mcq", "matching", "short", "essay"]);
  });
  it("berkas kosong atau tanpa kolom wajib ditolak dengan pesan jelas", () => {
    expect(mapQuestionRows([["foo", "bar"]])[0]).toMatchObject({ ok: false, row: 1 });
    expect(mapQuestionRows([head])).toEqual([]);
  });
});

// ---- Rute impor terhadap MongoDB in-memory ----
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });
let current: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => current }));

describe.skipIf(!safe)("rute impor soal (database in-memory)", () => {
  it("impor XML, idempoten, duplikat, otorisasi, dan batas", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("import_umum_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Question, QuestionCollection } = await import("@/models/Question");
    const { Category } = await import("@/models/Category");
    const { Asset } = await import("@/models/Asset");
    const route = await import("@/app/api/admin/questions/import/route");

    const admin = await User.create({ email: "a@t.id", role: "admin", status: "active" });
    const editor = await User.create({ email: "e@t.id", role: "content_editor", status: "active" });
    const learner = await User.create({ email: "p@t.id", role: "participant", status: "active" });
    const cat = await Category.create({ name: "Struktur Data", nameKey: "struktur data" });
    const mine = await QuestionCollection.create({ name: "UTS", categoryId: cat._id, ownerId: admin._id, visibility: "private" });
    const send = async (user: unknown, content: BlobPart, name: string, fields: Record<string, string> = {}, dry = false) => {
      current = user as never;
      const fd = new FormData();
      fd.set("file", new File([content], name));
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await route.POST(new Request(`http://x/api/admin/questions/import${dry ? "?dry=1" : ""}`, { method: "POST", body: fd }));
      return { status: res.status, body: await res.json() };
    };

    expect((await send(learner, xml, "a.xml")).status).toBe(403);
    current = null;
    expect((await send(null, xml, "a.xml")).status).toBe(401);

    // Pratinjau tidak menulis apa pun.
    const dry = await send(admin, xml, "bank.xml", { collectionId: String(mine._id) }, true);
    expect(dry.status).toBe(200);
    expect(dry.body).toMatchObject({ dry: true, total: 11, created: 8, duplicates: 1 });
    expect(await Question.countDocuments()).toBe(0);
    expect(await Asset.countDocuments()).toBe(0);

    const r1 = await send(admin, xml, "bank.xml", { collectionId: String(mine._id) });
    expect(r1.body).toMatchObject({ created: 8, duplicates: 1 });
    expect(r1.body.skipped.map((s: { type: string }) => s.type)).toEqual(["multichoice", "numerical"]);
    expect(await Question.countDocuments({ collectionId: mine._id, categoryId: cat._id })).toBe(8);
    expect(await Asset.countDocuments()).toBe(1);
    const html = await Question.findOne({ stemFormat: "html", stem: /pre/ }).lean();
    expect(html?.contentHash).toBeTruthy();

    // Impor ulang tidak menggandakan: semua dikenali sebagai duplikat.
    const r2 = await send(admin, xml, "bank.xml", { collectionId: String(mine._id) });
    expect(r2.body.created).toBe(0);
    expect(r2.body.duplicates).toBe(9);
    expect(await Question.countDocuments()).toBe(8);
    expect(await Asset.countDocuments()).toBe(1); // gambar dipakai ulang

    // Soal lama tanpa sidik tetap dikenali lewat teks yang sama.
    await Question.collection.updateMany({}, { $unset: { contentHash: "" } });
    expect((await send(admin, xml, "bank.xml")).body.created).toBe(0);

    // Koleksi pribadi milik admin tidak bisa diisi editor.
    expect((await send(editor, xml, "bank.xml", { collectionId: String(mine._id) })).status).toBe(403);
    // ID liar ditolak.
    expect((await send(admin, xml, "bank.xml", { categoryId: "$ne" })).status).toBe(400);
    expect((await send(admin, xml, "bank.xml", { collectionId: String(new (await import("mongoose")).Types.ObjectId()) })).status).toBe(404);

    // Berkas buruk: kosong, DOCTYPE, bukan XML. Pesan tanpa jejak tumpukan.
    for (const [content, re] of [["", /No questions|valid XML|Moodle|file is required/i], ['<!DOCTYPE q [<!ENTITY x "y">]><quiz/>', /DOCTYPE/], ["bukan xml", /valid XML|Moodle|quiz/i]] as const) {
      const r = await send(admin, content, "buruk.xml");
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(re);
      expect(JSON.stringify(r.body)).not.toMatch(/node_modules|\sat\s/);
    }
    // Editor selalu menghasilkan draft walau diminta published.
    await Question.deleteMany({});
    await send(editor, xml, "bank.xml", { status: "published" });
    expect(await Question.countDocuments({ status: { $ne: "draft" } })).toBe(0);

    // CSV dengan BOM dan banyak jenis.
    await Question.deleteMany({});
    const csv = "﻿section,type,stem,A,B,answer,kind,points,pairs,accepted,rubric,guide\r\nstruktur_data,dasar,Pilih satu,x,y,B,,,,,,\r\nstruktur_data,isian,Isi titik,,,,short,1,,push|PUSH,,\r\n";
    const c = await send(admin, csv, "soal.csv");
    expect(c.body).toMatchObject({ created: 2, failed: [], duplicates: 0 });
    expect((await send(admin, csv, "soal.csv")).body).toMatchObject({ created: 0, duplicates: 2 });
  });
});

describe("impor Word dengan jenis soal lain", () => {
  it("direktif Kind, Points, Pairs, Accepted, Rubric terbaca", async () => {
    const { docxTextToTable } = await import("@/lib/import-docx");
    const t = docxTextToTable([
      "Section: struktur_data", "Status: draft", "",
      "1. Pasangkan.", "Kind: matching", "Points: 2", "Pairs: Stack=LIFO; Queue=FIFO", "",
      "2. Operasi tambah pada stack disebut ...", "Kind: short", "Accepted: push|PUSH", "",
      "3. Jelaskan array.", "Kind: essay", "Points: 10", "Rubric: Konsep:6; Contoh:4", "Guide: bahas indeks", "",
      "4. Pilih satu.", "A. x", "B. y", "Answer: B",
    ].join("\n"));
    const rows = mapQuestionRows(t);
    expect(rows.map((r) => (r.ok ? r.data.kind : r.error))).toEqual(["matching", "short", "essay", "mcq"]);
  });
});
