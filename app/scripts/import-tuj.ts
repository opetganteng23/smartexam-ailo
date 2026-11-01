// Sekali pakai: impor peserta TUJ 25-01 dan 25-02 ke institusi "TUJ" lewat importMembers (jalur yang sama dengan Admin > Add participants).
// Setiap peserta baru langsung dikirimi email undangan. Jalankan: tsx --env-file=.env.local scripts/import-tuj.ts <berkas-25-01.xlsx> <berkas-25-02.xlsx> [--apply]
// Tanpa --apply hanya simulasi: tidak ada yang ditulis dan tidak ada email dikirim.
import ExcelJS from "exceljs";
import { Types } from "mongoose";

async function rows(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const out: { row: number; email: string; givenName: string; surname: string }[] = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const t = (c: number) => String(r.getCell(c).text ?? "").trim();
    out.push({ row: i, givenName: t(1), surname: t(2), email: t(4).toLowerCase() });
  });
  return out;
}

async function main() {
  const [f1, f2] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const a = await rows(f1), b = await rows(f2);
  const seen = new Set(a.map((r) => r.email));
  const dup = b.filter((r) => seen.has(r.email));
  const bUnique = b.filter((r) => !seen.has(r.email));
  console.log(`25-01: ${a.length} baris | 25-02: ${b.length} baris | email ganda antar berkas (hanya di 25-01): ${dup.length}`);
  for (const r of dup) console.log(`  ganda: baris ${r.row} di 25-02, ${r.email.replace(/^(.{3}).*(@.*)$/, "$1***$2")}`);
  if (!apply) { console.log("SIMULASI selesai. Tidak ada yang ditulis."); return; }

  const { connectDB } = await import("../lib/db");
  const { Institution } = await import("../models/Institution");
  const { User } = await import("../models/User");
  const { importMembers } = await import("../lib/import-members");
  await connectDB();
  const now = new Date(), end = new Date(+now + 365 * 864e5);
  const inst = await Institution.findOneAndUpdate(
    { code: "TUJ2025" },
    { $setOnInsert: { name: "TUJ", code: "TUJ2025", seats: 80, seatsUsed: 0, contractStart: now, contractEnd: end, status: "active", batch: "2025" } },
    { upsert: true, returnDocument: "after" }
  );
  const actor = new Types.ObjectId();
  for (const [label, list] of [["TUJ 25-01", a], ["TUJ 25-02", bUnique]] as const) {
    const rep = await importMembers(inst!._id, list, actor);
    await User.updateMany({ email: { $in: list.map((r) => r.email) }, institutionId: inst!._id }, { $set: { branch: label } });
    console.log(`${label}: dibuat ${rep.created}, dikirim ulang ${rep.resent}, gagal ${rep.failed.length}`);
    for (const f of rep.failed) console.log(`  gagal baris ${f.row}: ${f.reason}`);
  }
  const left = await Institution.findById(inst!._id).select("seats seatsUsed").lean();
  console.log(`Kursi terpakai: ${left?.seatsUsed}/${left?.seats}`);
  process.exit(0);
}
main().catch((e) => { console.error("GAGAL:", e instanceof Error ? e.message : e); process.exit(1); });
