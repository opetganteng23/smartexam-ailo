import { connectDB } from "./db";
import { Institution } from "@/models/Institution";
import { createMember } from "./participants";
import { User } from "@/models/User";

/** Data contoh untuk pengembangan/demo. Idempoten. JANGAN dijalankan di produksi tanpa sadar. */
export async function seedDemo() {
  await connectDB();

  await Institution.updateOne(
    { code: "DEMO2026" },
    { $setOnInsert: { name: "Sample University", code: "DEMO2026", seats: 120, batch: "Batch 2026", contactEmail: "coordinator@example.ac.id", contractStart: new Date(), contractEnd: new Date(Date.now() + 365 * 86_400_000), status: "active" } },
    { upsert: true }
  );
  // Akun contoh diundang (email undangan dicetak ke konsol di dev). Masuk dengan OTP ke email ini.
  const inst = await Institution.findOne({ code: "DEMO2026" });
  const demo: { email: string; name: string; role: "coach" | "inst_admin" | "participant" }[] = [
    { email: "coach@demo.local", name: "Demo Coach", role: "coach" },
    { email: "instadmin@demo.local", name: "Demo Institution Admin", role: "inst_admin" },
    { email: "peserta1@demo.local", name: "Participant One", role: "participant" },
    { email: "peserta2@demo.local", name: "Participant Two", role: "participant" },
    { email: "peserta3@demo.local", name: "Participant Three", role: "participant" },
  ];
  for (const d of demo) if (inst && !(await User.exists({ email: d.email }))) await createMember(inst._id, d);

  return { institution: "DEMO2026" };
}
