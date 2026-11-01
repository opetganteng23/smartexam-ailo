import PptxGenJS from "pptxgenjs";
import { readFileSync } from "fs";
import path from "path";
import type { collectTestRows } from "./test-export";
import { SECTION_SHORT } from "./exam-format";
import { getSetting } from "@/models/Settings";
import { GENERAL_DEFAULTS } from "./public-info";

type Got = NonNullable<Awaited<ReturnType<typeof collectTestRows>>>;
type Row = Got["rows"][number];

// Ringkasan eksekutif untuk ujian umum (skala persentase). Deck TOEFL ITP (level, CEFR, target) ada di exec-summary.ts.
const C = { cloud: "F9FCFD", deep: "0A4256", teal: "00809C", orange: "F07020", ink: "1E3440", soft: "4F6670", card: "E0F3F7", line: "C3D8DE", green: "2E9E6B", red: "C2412D" };
const FONT = "Calibri";
const ID = (n: number, d = 0) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nice = (s: string) => s.replace(/\S+/g, (w) => (w.length > 2 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w));
const logo = () => `image/png;base64,${readFileSync(path.join(process.cwd(), "lib", "report-assets", "logo-smartexam.png")).toString("base64")}`;

export async function buildGeneralSummary(got: Got, o: { scopeLabel: string; passMark: number | null }) {
  const { test } = got;
  const rows = got.rows.filter((r) => !r.qa);
  const fin = rows.filter((r) => r.status === "Finished" && typeof r.score === "number");
  const scores = fin.map((r) => r.score!);
  const inst = [...new Set(rows.map((r) => r.institution).filter(Boolean))];
  const pass = o.passMark;
  const passed = pass != null ? fin.filter((r) => r.score! >= pass).length : null;
  const contact = await getSetting("general", GENERAL_DEFAULTS);

  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  p.author = "Smartexam by AILO"; p.company = "AILO Telkom University"; p.title = `Laporan ${test.name}`;
  const L = logo();
  let n = 0;
  const slide = (title: string, sub?: string) => {
    const s = p.addSlide(); n++;
    s.background = { color: C.cloud };
    s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.teal }, line: { color: C.teal, width: 0 } });
    s.addText(title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: C.deep, margin: 0 });
    if (sub) s.addText(sub, { x: 0.6, y: 1.05, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, color: C.soft, margin: 0 });
    s.addText(`Laporan ${test.name} · ${o.scopeLabel}`, { x: 0.6, y: 7.05, w: 10, h: 0.3, fontFace: FONT, fontSize: 9, color: C.soft, margin: 0 });
    s.addText(String(n + 1), { x: 12.2, y: 7.05, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.soft, align: "right", margin: 0 });
    return s;
  };
  const head = (cells: string[], align?: ("left" | "center" | "right")[]) => cells.map((c, i) => ({ text: c, options: { bold: true, color: "FFFFFF", fill: { color: C.deep }, align: align?.[i] ?? "left", fontFace: FONT, fontSize: 12 } }));
  const body = (cells: (string | number)[], align?: ("left" | "center" | "right")[]) => cells.map((c, i) => ({ text: String(c), options: { color: C.ink, align: align?.[i] ?? "left", fontFace: FONT, fontSize: 12 } }));

  // 1. Sampul
  {
    const s = p.addSlide();
    s.background = { color: C.deep };
    s.addImage({ data: L, x: 0.7, y: 0.6, w: 1.1 * 1.041, h: 1.1 });
    s.addText("LAPORAN HASIL UJIAN", { x: 0.7, y: 2.4, w: 11, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.orange, charSpacing: 4, margin: 0 });
    s.addText(test.name, { x: 0.7, y: 2.9, w: 11.6, h: 1.4, fontFace: FONT, fontSize: 40, bold: true, color: "FFFFFF", margin: 0, valign: "top" });
    s.addText([o.scopeLabel, inst.length === 1 ? inst[0] : ""].filter(Boolean).join(" · "), { x: 0.7, y: 4.5, w: 11.6, h: 0.5, fontFace: FONT, fontSize: 18, color: "BFE3EC", margin: 0 });
    s.addText(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }), { x: 0.7, y: 6.6, w: 6, h: 0.4, fontFace: FONT, fontSize: 12, color: "BFE3EC", margin: 0 });
    s.addShape(p.ShapeType.rect, { x: 0, y: 7.38, w: 6.66, h: 0.12, fill: { color: C.red }, line: { color: C.red, width: 0 } });
    s.addShape(p.ShapeType.rect, { x: 6.66, y: 7.38, w: 6.67, h: 0.12, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 } });
  }

  // 2. Ringkasan
  {
    const s = slide("Ringkasan", `${ID(fin.length)} dari ${ID(rows.length)} peserta telah menyelesaikan ujian`);
    const kpi: [string, string, string][] = [
      ["Peserta selesai", ID(fin.length), `dari ${ID(rows.length)} terdaftar`],
      ["Rata-rata skor", fin.length ? `${ID(mean(scores), 1)}%` : "-", fin.length ? `median ${ID(median(scores), 1)}%` : ""],
      ["Skor tertinggi", fin.length ? `${ID(Math.max(...scores))}%` : "-", fin.length ? `terendah ${ID(Math.min(...scores))}%` : ""],
      [pass != null ? "Lulus" : "Batas lulus", pass != null && fin.length ? `${ID(((passed ?? 0) / fin.length) * 100, 1)}%` : "-", pass != null ? `${ID(passed ?? 0)} peserta · batas ${ID(pass)}%` : "belum diatur"],
    ];
    kpi.forEach(([t, v, d], i) => {
      const x = 0.6 + i * 3.1;
      s.addShape(p.ShapeType.roundRect, { x, y: 1.9, w: 2.9, h: 2.2, fill: { color: "FFFFFF" }, line: { color: C.line, width: 1 }, rectRadius: 0.12 });
      s.addText(t, { x: x + 0.2, y: 2.05, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.soft, margin: 0 });
      s.addText(v, { x: x + 0.2, y: 2.5, w: 2.5, h: 0.9, fontFace: FONT, fontSize: 38, bold: true, color: i % 2 ? C.orange : C.teal, margin: 0 });
      s.addText(d, { x: x + 0.2, y: 3.5, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 12, color: C.soft, margin: 0 });
    });
    const mins = fin.map((r) => r.minutes).filter((m): m is number => typeof m === "number");
    const flagged = fin.filter((r) => (r.tabHidden ?? 0) + (r.fullscreenExit ?? 0) + (r.paste ?? 0) > 0).length;
    s.addText([
      { text: `Rata-rata waktu pengerjaan ${mins.length ? ID(mean(mins)) : "-"} menit.`, options: { breakLine: true } },
      { text: `${ID(flagged)} peserta (${ID(fin.length ? (flagged / fin.length) * 100 : 0, 1)}%) memiliki catatan pengawasan (pindah tab, keluar layar penuh, atau paste). Catatan ini petunjuk untuk ditinjau, bukan bukti pelanggaran.` },
    ], { x: 0.6, y: 4.6, w: 12, h: 1.4, fontFace: FONT, fontSize: 15, color: C.ink, margin: 0, valign: "top" });
  }

  // 3. Distribusi skor
  if (fin.length) {
    const s = slide("Sebaran skor", "Jumlah peserta pada tiap rentang skor persentase");
    const bins = Array.from({ length: 10 }, (_, i) => ({ l: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`, c: 0 }));
    for (const x of scores) bins[Math.min(9, Math.floor(x / 10))].c++;
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: bins.map((b) => b.l), values: bins.map((b) => b.c) }], {
      x: 0.6, y: 1.6, w: 12, h: 5.2, barDir: "col", chartColors: [C.teal], showValue: true, dataLabelFontSize: 12, dataLabelFontFace: FONT,
      catAxisLabelFontSize: 12, catAxisLabelFontFace: FONT, valAxisLabelFontSize: 11, valGridLine: { color: C.line, size: 0.5 }, showLegend: false, barGapWidthPct: 40,
    });
  }

  // 4. Rata-rata per bagian
  {
    const keys = got.sectionKeys;
    const avg = keys.map((k) => mean(fin.map((r) => r.secs?.[k]).filter((x): x is number => typeof x === "number")));
    if (keys.length && fin.length) {
      const s = slide("Kemampuan per bagian", "Rata-rata skor tiap bagian ujian (persentase poin)");
      s.addChart(p.ChartType.bar, [{ name: "Rata-rata", labels: keys.map((k) => SECTION_SHORT[k]), values: avg.map((v) => Math.round(v * 10) / 10) }], {
        x: 0.6, y: 1.6, w: 8, h: 5.2, barDir: "bar", chartColors: [C.orange], showValue: true, dataLabelFontSize: 13, dataLabelFontFace: FONT, valAxisMinVal: 0, valAxisMaxVal: 100,
        catAxisLabelFontSize: 13, catAxisLabelFontFace: FONT, valAxisLabelFontSize: 11, valGridLine: { color: C.line, size: 0.5 }, showLegend: false,
      });
      const hi = avg.indexOf(Math.max(...avg)), lo = avg.indexOf(Math.min(...avg));
      s.addText([
        { text: "Sorotan", options: { bold: true, color: C.deep, fontSize: 16, breakLine: true } },
        { text: `${SECTION_SHORT[keys[hi]]} paling kuat (${ID(avg[hi], 1)}%).`, options: { breakLine: true } },
        { text: keys.length > 1 ? `${SECTION_SHORT[keys[lo]]} paling perlu dikuatkan (${ID(avg[lo], 1)}%).` : "" },
      ], { x: 9, y: 2.2, w: 3.8, h: 2.4, fontFace: FONT, fontSize: 14, color: C.ink, margin: 0, valign: "top", paraSpaceAfter: 6 });
    }
  }

  // 5. Per kelompok (branch)
  {
    const by = new Map<string, Row[]>();
    for (const r of fin) { const k = r.branch || ""; if (k) by.set(k, [...(by.get(k) ?? []), r]); }
    if (by.size > 1) {
      const list = [...by.entries()].map(([k, rs]) => ({ k, n: rs.length, avg: mean(rs.map((r) => r.score!)), ps: pass != null ? (rs.filter((r) => r.score! >= pass).length / rs.length) * 100 : null })).sort((a, b) => b.avg - a.avg).slice(0, 14);
      const s = slide("Hasil per kelompok", "Dikelompokkan menurut branch (kelas, angkatan, atau unit)");
      s.addTable([head(["Kelompok", "Selesai", "Rata-rata", pass != null ? "Lulus" : ""], ["left", "center", "center", "center"]), ...list.map((g) => body([g.k, g.n, `${ID(g.avg, 1)}%`, g.ps != null ? `${ID(g.ps, 1)}%` : "-"], ["left", "center", "center", "center"]))], { x: 0.6, y: 1.7, w: 12, colW: [6, 2, 2, 2], border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.34 });
    }
  }

  // 6. Peserta teratas dan perlu perhatian
  if (fin.length) {
    const s = slide("Peserta teratas dan yang perlu perhatian", pass != null ? `Perlu perhatian: skor di bawah batas lulus ${ID(pass)}%, diurutkan dari yang terendah` : "Perlu perhatian: lima belas skor terendah");
    const top = [...fin].sort((a, b) => b.score! - a.score!).slice(0, 10);
    const low = [...fin].filter((r) => pass == null || r.score! < pass).sort((a, b) => a.score! - b.score!).slice(0, 10);
    const tbl = (list: Row[], x: number, color: string) => s.addTable([head(["Nama", "Skor"], ["left", "center"]).map((c) => ({ ...c, options: { ...c.options, fill: { color } } })), ...list.map((r) => body([nice(r.name), `${ID(r.score!)}%`], ["left", "center"]))], { x, y: 1.7, w: 5.9, colW: [4.6, 1.3], border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.36 });
    tbl(top, 0.6, C.teal);
    if (low.length) tbl(low, 6.8, C.orange); else s.addText("Semua peserta mencapai batas lulus.", { x: 6.8, y: 2.2, w: 5.9, h: 0.6, fontFace: FONT, fontSize: 15, color: C.green, bold: true, margin: 0 });
  }

  // 7. Topik terlemah
  {
    const m = new Map<string, { skill: string; topic: string; c: number; n: number; people: number }>();
    for (const r of fin) for (const t of r.topics) { if (!t.total) continue; const k = `${t.skill}|${t.topic}`; const a = m.get(k) ?? { skill: t.skill, topic: t.topic, c: 0, n: 0, people: 0 }; a.c += t.correct; a.n += t.total; a.people++; m.set(k, a); }
    const list = [...m.values()].filter((a) => a.n / a.people >= 1 && a.people >= 3).map((a) => ({ ...a, pct: (a.c / a.n) * 100 })).sort((a, b) => a.pct - b.pct).slice(0, 8);
    if (list.length) {
      const s = slide("Topik yang paling perlu dikuatkan", "Persentase jawaban benar per topik, terendah lebih dulu (minimal 3 peserta)");
      s.addTable([head(["Topik", "Kategori", "Benar", "Peserta"], ["left", "left", "center", "center"]), ...list.map((a) => body([a.topic.replace(/[-_]/g, " "), SECTION_SHORT[a.skill] ?? a.skill, `${ID(a.pct, 1)}%`, a.people], ["left", "left", "center", "center"]))], { x: 0.6, y: 1.7, w: 12, colW: [5.5, 3, 1.8, 1.7], border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.4 });
    }
  }

  // 8. Catatan dan kontak
  {
    const s = slide("Catatan dan kontak");
    s.addText([
      { text: "Skor dihitung sebagai persentase poin yang diperoleh. Soal essay ikut dihitung setelah dinilai penilai.", options: { bullet: true, breakLine: true } },
      { text: "Catatan pengawasan hanya mencatat aktivitas browser (pindah tab, layar penuh, copy dan paste), tanpa kamera dan mikrofon.", options: { bullet: true, breakLine: true } },
      { text: "Laporan ini dapat diunduh ulang kapan saja dari Smartexam by AILO untuk angka terbaru.", options: { bullet: true } },
    ], { x: 0.6, y: 1.6, w: 12, h: 2.4, fontFace: FONT, fontSize: 16, color: C.ink, margin: 0, valign: "top", paraSpaceAfter: 10 });
    const info = [contact.supportWhatsapp && `WhatsApp ${contact.supportWhatsapp}`, contact.supportEmail].filter(Boolean) as string[];
    if (info.length) s.addText(["Hubungi kami", ...info].join("\n"), { x: 0.6, y: 4.6, w: 8, h: 1.4, fontFace: FONT, fontSize: 15, color: C.deep, margin: 0, valign: "top" });
    s.addImage({ data: L, x: 10.6, y: 5.3, w: 1.6 * 1.041, h: 1.6 });
  }

  const buffer = Buffer.from((await p.stream({ compression: true })) as Uint8Array);
  return { buffer, name: `${test.name} - ringkasan` };
}
