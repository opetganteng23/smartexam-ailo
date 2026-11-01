// Sekali pakai: tambahkan 45 soal pilihan ganda (diacak dari 95 soal di dua berkas Moodle XML) ke ujian UTS Struktur Data.
// Jalankan: tsx scripts/add-uts-pilgan.ts <xml-1> <xml-2> [--apply]   (tanpa --apply hanya simulasi)
import { readFileSync } from "fs";
import { Types } from "mongoose";

const NAME = "UTS Struktur Data (CAK2EAB4) - S1 Informatika Ganjil 2026/2027";
const PICK = 45, MCQ_SEC = 30 * 60, ESSAY_SEC = 22.5 * 60; // 30 + 4 x 22,5 = 120 menit

const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const toText = (h: string) => dec(dec(h).replace(/<\/p>|<br\s*\/?>|<\/pre>|<\/li>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

type Item = { stem: string; options: string[]; answerKey: number };
function parse(file: string): Item[] {
  const x = readFileSync(file, "utf8");
  return (x.match(/<question type="multichoice">[\s\S]*?<\/question>/g) ?? []).map((q) => {
    const stem = toText(/<questiontext[^>]*>\s*<text>([\s\S]*?)<\/text>/.exec(q)![1]);
    const ans = [...q.matchAll(/<answer fraction="(-?[\d.]+)"[^>]*>\s*<text>([\s\S]*?)<\/text>/g)].map((m) => ({ ok: Number(m[1]) === 100, t: toText(m[2]) }));
    if (ans.length !== 4 || ans.filter((a) => a.ok).length !== 1) throw new Error("Soal tidak 4 opsi / satu kunci: " + stem.slice(0, 60));
    return { stem, options: ans.map((a) => a.t), answerKey: ans.findIndex((a) => a.ok) };
  });
}

async function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const all = files.flatMap(parse);
  const seen = new Set<string>(), uniq = all.filter((i) => (seen.has(i.stem) ? false : (seen.add(i.stem), true)));
  // Kunci di bank soal condong ke satu huruf; acak urutan opsi, kecuali opsi yang merujuk posisi/opsi lain ("semua benar", "A dan B").
  const POSISI = /semua|di atas|keduanya|tidak ada|[A-D]\s*(dan|&|,)\s*[A-D]/i;
  const pick = [...uniq].sort(() => Math.random() - 0.5).slice(0, PICK).map((p) => {
    if (p.options.some((o) => POSISI.test(o))) return p;
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    return { stem: p.stem, options: order.map((i) => p.options[i]), answerKey: order.indexOf(p.answerKey) };
  });
  console.log(`${all.length} soal terbaca (${uniq.length} unik), terpilih ${pick.length}; kunci A-D:`, [0, 1, 2, 3].map((k) => pick.filter((p) => p.answerKey === k).length).join("/"));
  if (pick.length !== PICK) throw new Error("Soal kurang dari " + PICK);
  if (!apply) { console.log("Contoh:\n" + pick[0].stem + "\n" + pick[0].options.map((o, i) => "ABCD"[i] + ". " + o).join("\n") + "\nKunci: " + "ABCD"[pick[0].answerKey]); console.log("SIMULASI selesai. Tidak ada yang ditulis."); return; }

  const { connectDB } = await import("../lib/db");
  const { Question } = await import("../models/Question");
  const { Test, Attempt } = await import("../models/Test");
  const { questionSchema } = await import("../lib/admin-schemas");
  await connectDB();
  const test = await Test.findOne({ name: NAME }).lean();
  if (!test) throw new Error("Ujian UTS tidak ditemukan");
  if (await Attempt.exists({ testId: test._id })) throw new Error("Sudah ada pengerjaan, batal");
  if (test.sections.some((s) => s.name === "pilgan")) throw new Error("Bagian pilgan sudah ada, batal");

  const ids: Types.ObjectId[] = [];
  for (const p of pick) {
    const d = questionSchema.parse({ difficulty: "medium", status: "published", section: "pilgan", type: "Pilihan ganda", kind: "mcq", points: 1, stem: p.stem, options: p.options, answerKey: p.answerKey, tags: [{ skill: "struktur-data", topic: "pilihan-ganda" }] });
    ids.push((await Question.create(d))._id);
  }
  const sections = [{ name: "pilgan", durationSec: MCQ_SEC, questionIds: ids }, ...test.sections.map((s) => ({ name: s.name, durationSec: ESSAY_SEC, questionIds: s.questionIds }))];
  await Test.updateOne({ _id: test._id }, { $set: { sections } });
  console.log(`Ditambahkan ${ids.length} soal; total bagian ${sections.length}, durasi ${sections.reduce((n, s) => n + s.durationSec, 0) / 60} menit`);
  process.exit(0);
}
main().catch((e) => { console.error("GAGAL:", e instanceof Error ? e.message : e); process.exit(1); });
