// Data uji untuk QA visual: server dev lokal (:3100, DB in-memory). Pakai: LOG=dev.log node scripts/ui-seed.mjs
// Membuat: fitur Learning menyala, institusi + peserta, mata pelajaran, bank, soal, course (bank bawaan), unit, materi, dan tes umum.
// Mencetak email peserta uji. Tidak menyentuh database nyata.
import fs from "node:fs";
const U = "http://localhost:3100", LOG = process.env.LOG ?? "dev.log";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function req(jar, path, { method = "GET", json, form } = {}) {
  const h = {}; if (jar?.c) h.cookie = jar.c;
  let body; if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); } if (form) body = form;
  const r = await fetch(U + path, { method, headers: h, body, redirect: "manual" });
  const sc = r.headers.getSetCookie?.() ?? []; if (jar && sc.length) jar.c = sc.map((x) => x.split(";")[0]).join("; ");
  const ct = r.headers.get("content-type") ?? ""; const data = ct.includes("json") ? await r.json().catch(() => ({})) : null;
  return { status: r.status, data };
}
const otp = async (email) => { for (let i = 0; i < 30; i++) { await sleep(300); const m = [...fs.readFileSync(LOG, "utf8").matchAll(/to=(\S+)\nsubject=(\d{6}) is your/g)].filter((x) => x[1] === email); if (m.length) return m[m.length - 1][2]; } };
async function login(email, invite) {
  const jar = { c: "" }; await req(null, "/api/auth/request-otp", { method: "POST", json: { email } });
  const code = await otp(email); const r = await req(jar, "/api/auth/verify-otp", { method: "POST", json: { email, code, invite } });
  if (r.status !== 200) throw new Error("login gagal " + email + " " + JSON.stringify(r.data)); return jar;
}
const must = (r, n) => { if (r.status >= 300) throw new Error(`${n}: ${r.status} ${JSON.stringify(r.data)}`); return r.data; };

const admin = await login("admin@test.local");
must(await req(admin, "/api/admin/settings/features", { method: "PUT", json: { aiCounselor: false, learning: true, coaching: false, officialTest: false, certificates: true, externalResults: false, programCycles: false, aiSupport: false, itpPack: false } }), "fitur");
const inst = must(await req(admin, "/api/admin/institutions", { method: "POST", json: { name: "Kampus Uji", code: "KUJI", seats: 10, contractStart: new Date().toISOString() } }), "institusi").id;
must(await req(admin, `/api/admin/institutions/${inst}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 10, status: "active", modules: { learning: true, coaching: false } } }), "modul institusi");
const f = new FormData(); f.append("file", new Blob(["email,nama,telepon\npeserta@test.local,Siti Uji,081234567890"], { type: "text/csv" }), "p.csv");
must(await req(admin, `/api/admin/institutions/${inst}/import`, { method: "POST", form: f }), "impor peserta");
await sleep(1500);
const log = fs.readFileSync(LOG, "utf8"); const at = log.lastIndexOf("to=peserta@test.local\nsubject="); const invite = (log.slice(at, at + 1500).match(/invite=([0-9a-f]{48})/) ?? [])[1];
const stu = await login("peserta@test.local", invite);
must(await req(stu, "/api/me/consent", { method: "POST", json: { consent: true, givenName: "Siti", surname: "Uji", phone: "081234567890" } }), "consent");

const cat = must(await req(admin, "/api/admin/categories", { method: "POST", json: { name: "Struktur Data" } }), "kategori").id;
const bank = must(await req(admin, "/api/admin/collections", { method: "POST", json: { name: "UTS Struktur Data", categoryId: cat, visibility: "private" } }), "bank").id;
const tag = [{ skill: "struktur-data", topic: "dasar" }];
const mk = async (b) => must(await req(admin, "/api/admin/questions", { method: "POST", json: { collectionId: bank, type: "dasar", difficulty: "medium", status: "published", tags: tag, ...b } }), "soal").id;
const qs = [];
qs.push(await mk({ stem: "Struktur data yang memakai urutan LIFO adalah ...", options: ["Queue", "Stack", "Tree"], answerKey: 1 }));
qs.push(await mk({ stem: "Kompleksitas pencarian biner adalah ...", options: ["O(n)", "O(log n)", "O(n^2)"], answerKey: 1 }));
qs.push(await mk({ kind: "short", stem: "Operasi menambah elemen ke stack disebut ...", key: { accepted: ["push"] } }));
await req(admin, "/api/admin/questions", { method: "POST", json: { type: "dasar", stem: "Soal lama tanpa bank", options: ["a", "b"], answerKey: 0 } }); // ditolak (bank wajib)

const course = must(await req(admin, "/api/admin/courses", { method: "POST", json: { track: "general", title: "Struktur Data Dasar", categoryId: cat, institutionIds: [inst], whatYouLearn: ["Stack dan queue", "Pencarian biner"], requirements: ["Dasar pemrograman"], targetAudience: "Mahasiswa semester awal" } }), "course").id;
const mod = must(await req(admin, "/api/admin/modules", { method: "POST", json: { courseId: course, title: "Modul 1: Dasar" } }), "modul").id;
const mat = must(await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Pengantar Stack", kind: "rich", status: "published", contentHtml: "<h2>Stack</h2><p>Stack memakai prinsip <b>LIFO</b>.</p>" } }), "materi").id;
must(await req(admin, "/api/admin/units", { method: "POST", json: { courseId: course, moduleId: mod, title: "Stack dan Queue", materialIds: [mat] } }), "unit");
const courseBank = (await (await fetch(U + "/api/admin/courses", { headers: { cookie: admin.c } })).json()).courses.find((c) => c.id === course)?.bankId;
const test = must(await req(admin, "/api/admin/tests", { method: "POST", json: { name: "Kuis Struktur Data", kind: "general", purpose: "midterm", active: true, testMode: false, courseId: course, categoryId: cat, bankId: bank, sections: [{ name: "bagian_1", durationSec: 900, questionIds: qs }] } }), "tes").id;
console.log(JSON.stringify({ ok: true, inst, cat, bank, courseBank, course, test, participant: "peserta@test.local", admin: "admin@test.local" }));
