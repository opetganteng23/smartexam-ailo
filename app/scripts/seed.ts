// Seed untuk database nyata (butuh MONGODB_URI). Jalankan: npm run seed   (tambah --demo: institusi/akun/materi contoh)
// Membuat: level & parameter bawaan (dapat diubah admin). Opsional: --sample ujian umum contoh, --demo institusi/akun contoh (SOAL CONTOH, ganti lewat Bank Soal).
import { seedDemo } from "../lib/seed-demo";
import { seedGeneralExam } from "../lib/seed-general";
import { getLevels } from "../lib/config";
import mongoose from "mongoose";

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for seeding (put it in .env.local, then: npm run seed)");
  console.log("levels:", (await getLevels()).map((l) => l.name).join(", "));
  if (process.argv.includes("--sample")) console.log("sample exam:", await seedGeneralExam());
  if (process.argv.includes("--demo")) console.log("demo:", await seedDemo());
  else console.log("(nothing seeded; options: --sample contoh ujian umum, --demo institusi dan akun contoh)");
  console.log("Done. First admin: set ADMIN_EMAILS, then sign in with that email.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
