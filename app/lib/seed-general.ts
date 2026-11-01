import { connectDB } from "./db";
import { Question } from "@/models/Question";
import { Test } from "@/models/Test";
import { ScoringProfile } from "@/models/Scoring";
import { questionSchema } from "./admin-schemas";

// CONTOH ujian umum (bukan bahasa Inggris): Matematika dan Logika dengan keempat jenis soal, skor persentase, dan batas lulus.
// Dipakai untuk uji coba dan sebagai bukti bahwa Smartexam tidak terikat pada TOEFL ITP. Ganti lewat Bank Soal.
export const GENERAL_TEST_NAME = "Contoh Ujian Umum (sample)";

type Draft = Record<string, unknown>;
const tag = (skill: string, topic: string) => [{ skill, topic }];
const mcq = (section: string, type: string, topic: string, stem: string, options: string[], answerKey: number, explanation: string): Draft =>
  ({ section, type, stem, options, answerKey, explanation, tags: tag(section, topic) });

const math: Draft[] = [
  mcq("math", "aritmetika", "perkalian", "Berapa hasil dari 12 × 8?", ["86", "96", "106", "98"], 1, "12 × 8 = 96."),
  mcq("math", "aljabar", "persamaan-linear", "Jika 3x + 5 = 20, nilai x adalah ...", ["3", "5", "7", "15"], 1, "3x = 15, jadi x = 5."),
  mcq("math", "aritmetika", "persen", "25% dari 240 adalah ...", ["50", "60", "70", "80"], 1, "240 × 0,25 = 60."),
  mcq("math", "geometri", "luas", "Luas persegi panjang dengan panjang 8 cm dan lebar 5 cm adalah ...", ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], 2, "Luas = panjang × lebar = 40 cm²."),
  { section: "math", type: "pengetahuan umum", kind: "matching", points: 4, stem: "Pasangkan daerah dengan alat musik tradisionalnya.", tags: tag("math", "budaya"),
    key: { pairs: [{ left: "Jawa Barat", right: "Angklung" }, { left: "Sumatra Barat", right: "Talempong" }, { left: "Papua", right: "Tifa" }, { left: "Jawa Tengah", right: "Gamelan" }], partial: true }, explanation: "Angklung dari Jawa Barat, talempong dari Minangkabau, tifa dari Papua, gamelan dari Jawa." },
  { section: "math", type: "geometri", kind: "matching", points: 2, stem: "Pasangkan bangun datar dengan jumlah sisinya.", tags: tag("math", "bangun-datar"),
    key: { pairs: [{ left: "Segitiga", right: "3 sisi" }, { left: "Persegi", right: "4 sisi" }, { left: "Segilima", right: "5 sisi" }, { left: "Segienam", right: "6 sisi" }], partial: true } },
  { section: "math", type: "aritmetika", kind: "short", points: 2, stem: "Hasil dari 15 + 27 adalah ...", tags: tag("math", "penjumlahan"), key: { accepted: ["42", "empat puluh dua"] }, explanation: "15 + 27 = 42." },
  { section: "math", type: "bilangan", kind: "short", points: 2, stem: "Bilangan prima terkecil adalah ...", tags: tag("math", "bilangan-prima"), key: { accepted: ["2", "dua"] }, explanation: "2 adalah satu-satunya bilangan prima genap." },
];

const logic: Draft[] = [
  mcq("logic", "silogisme", "deduksi", "Semua kucing adalah hewan. Tom adalah kucing. Maka ...", ["Tom adalah hewan", "Tom bukan hewan", "Semua hewan adalah kucing", "Tidak dapat disimpulkan"], 0, "Tom termasuk kucing, dan semua kucing adalah hewan."),
  mcq("logic", "pola", "barisan", "Bilangan berikutnya dari 2, 4, 8, 16, ... adalah ...", ["24", "30", "32", "64"], 2, "Setiap bilangan dikali 2."),
  mcq("logic", "kalender", "hari", "Jika hari ini Rabu, 10 hari lagi adalah hari ...", ["Sabtu", "Minggu", "Jumat", "Senin"], 0, "10 hari = 1 minggu + 3 hari, Rabu + 3 = Sabtu."),
  { section: "logic", type: "esai", kind: "essay", points: 10, stem: "Jelaskan dengan bahasa Anda sendiri mengapa semboyan Bhinneka Tunggal Ika penting bagi persatuan Indonesia. Berikan satu contoh nyata.", tags: tag("logic", "penalaran-argumen"),
    key: { rubric: [{ criterion: "Pemahaman konsep", points: 4 }, { criterion: "Contoh nyata", points: 3 }, { criterion: "Kejelasan bahasa", points: 3 }], maxWords: 200, guide: "Nilai penuh bila siswa menjelaskan arti keberagaman dalam persatuan dan memberi contoh konkret (bahasa, adat, agama, atau gotong royong)." } },
];

/** Buat ujian contoh umum (idempoten). Soal diperiksa dengan skema yang sama dengan API admin. */
export async function seedGeneralExam() {
  await connectDB();
  if (await Test.exists({ name: GENERAL_TEST_NAME })) return { generalSkipped: true };
  const make = async (list: Draft[]) => {
    const docs = list.map((d) => questionSchema.parse({ difficulty: "medium", status: "published", ...d }));
    return Question.insertMany(docs);
  };
  const m = await make(math), l = await make(logic);
  const prof = await ScoringProfile.findOneAndUpdate(
    { name: "Persentase (contoh)" },
    { $setOnInsert: { name: "Persentase (contoh)", description: "Skor = persen poin yang diperoleh. Lulus bila total minimal 60%.", mode: "linear", scale: "percent", passMark: 60, tables: {}, verified: false } },
    { upsert: true, returnDocument: "after" }
  );
  const test = await Test.create({
    name: GENERAL_TEST_NAME, kind: "practice", requirePlacement: false, scoringProfileId: prof!._id,
    sections: [{ name: "math", durationSec: 15 * 60, questionIds: m.map((q) => q._id) }, { name: "logic", durationSec: 10 * 60, questionIds: l.map((q) => q._id) }],
  });
  return { generalTestId: String(test._id), generalQuestions: m.length + l.length };
}
