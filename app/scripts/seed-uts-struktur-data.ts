// Sekali pakai: ujian UTS CAK2EAB4 Struktur Data (4 soal essay a-d, 120 poin), sesi 2 Nov 2026, peserta institusi TUJ2025.
// Jalankan: tsx scripts/seed-uts-struktur-data.ts [--apply]   (tanpa --apply hanya simulasi)
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { Types } from "mongoose";

type R = [string, number][];
type Q = { section: string; stem: string; points: number; rubric: R; guide: string };
const q = (section: string, stem: string, rubric: R, guide: string): Q => ({ section, stem, points: rubric.reduce((n, r) => n + r[1], 0), rubric, guide });

// Soal tampil sebagai gambar halaman asli naskah (docx > PDF > PNG), supaya persis sama. Pertanyaan a-d juga ditulis di soal (dari scripts/uts-naskah.json).
const NASKAH: Record<string, { title: string; parts: string[] }> = JSON.parse(readFileSync(join(process.cwd(), "scripts", "uts-naskah.json"), "utf8"));
const HALAMAN: Record<string, number[]> = { sll: [2, 3, 4], dll: [5, 6, 7], stack: [8, 9, 10, 11], queue: [12, 13, 14] };

const PARTS: Q[] = [
  q("sll", "1a. Buatlah definisi struktur datanya!\nLengkapi: type Buku <...>, type Infotype, type Address, type ElmList <...>, type List <...>", [["Definisi tipe Buku (kode, judul, stok)", 2], ["Infotype dan Address (pointer ke ElmList)", 2], ["ElmList (info, next) dan List (first)", 2]], "Buku <kode: string, judul: string, stok: integer>; Infotype: Buku; Address: pointer to ElmList; ElmList <info: Infotype, next: Address>; List: <first: Address>."),
  q("sll", "1b. Buatlah prosedur untuk menampilkan judul semua buku yang stoknya 0!\n\nprocedure tampilStokHabis (in L : List)\n{I.S. Terdefinisi sebuah list buku yang mungkin kosong.\n F.S. Judul semua buku yang stoknya 0 ditampilkan berurutan mulai dari elemen pertama.\n    Berdasarkan ilustrasi, ditampilkan: Basis Data, Sistem Operasi.}", [["Traversal dari first sampai NIL (aman untuk list kosong)", 2], ["Kondisi stok = 0 dengan akses info yang benar", 3], ["Menampilkan judul berurutan", 1]], "Traversal P ← first; while P ≠ NIL: if info(P).stok = 0 then output(info(P).judul); P ← next(P)."),
  q("sll", "1c. Buatlah prosedur untuk menghapus buku berdasarkan kode buku!\n\nprocedure hapusBuku (in/out L : List, in kode : string)\n{I.S. Terdefinisi sebuah list buku yang mungkin kosong dan kode buku yang akan dihapus.\n F.S. Jika ada, elemen buku berkode tersebut dilepas dari list dan memorinya dibebaskan.\n    Jika list kosong atau kode tidak ditemukan, list tidak berubah. Jika kode = \"B101\" maka list berawal dari B102; jika kode = \"B104\" maka B103 menunjuk ke B105.}\nDictionary: procedure deallocate (in/out P : Address) {Mengembalikan memori elemen yang ditunjuk P ke sistem.}", [["Kasus list kosong dan kode tidak ditemukan (list tidak berubah)", 2], ["Hapus elemen pertama (first dimajukan)", 3], ["Hapus elemen tengah/akhir dengan pointer penelusur sebelumnya", 3], ["Memanggil deallocate dan pointer next terhubung benar", 2]], "Cari dengan dua pointer (P dan Prev). Jika P = first maka first ← next(first). Selain itu next(Prev) ← next(P). Lalu deallocate(P)."),
  q("sll", "1d. Buatlah prosedur untuk memisahkan buku berdasarkan ketersediaan stok!\n\nprocedure pisahStok (in/out L : List, in/out LAda : List, in/out LHabis : List)\n{I.S. Terdefinisi sebuah list buku L yang mungkin kosong.\n F.S. L menjadi kosong. Semua elemen berstok > 0 dipindahkan ke LAda dengan urutan yang sama seperti di L, dan semua elemen berstok 0 dipindahkan ke LHabis dengan urutan terbalik dari urutan di L. Berdasarkan ilustrasi: LAda = B101, B103, B105 dan LHabis = B104, B102.}\nDictionary: createList() → List; isEmpty(L) → Boolean; insertFirst(in/out L, in P); deleteFirst(in/out L, in/out P)\nKetentuan: hanya boleh memanggil prosedur/fungsi pada Dictionary (insertLast tidak tersedia). Dilarang memanggil allocate/deallocate dan dilarang mengubah pointer next atau first secara langsung. Anda boleh menambahkan variabel list pada Dictionary.", [["Perulangan deleteFirst sampai L kosong", 2], ["Elemen stok 0 dimasukkan ke LHabis dengan insertFirst (urutan terbalik)", 2], ["Elemen stok > 0 menghasilkan LAda berurutan sama (mis. via list bantu lalu dipindah balik)", 3], ["Hanya memakai subprogram Dictionary", 1]], "Karena insertLast tidak ada, kumpulkan elemen stok > 0 dengan insertFirst ke list bantu (urutan terbalik), lalu deleteFirst dari list bantu dan insertFirst ke LAda sehingga urutan kembali sama."),

  q("dll", "2a. Buatlah definisi struktur datanya!\nLengkapi: type FileMusik <...>, type Infotype, type Address, type ElmList <...>, type List <...>", [["Tipe FileMusik (judul, artis, durasi)", 2], ["Infotype, Address, ElmList (info, next, prev)", 2], ["List (first, last, now_playing)", 2]], "FileMusik <judul: string, artis: string, durasi: integer>; ElmList <info, next, prev>; List <first, last, now_playing: Address>."),
  q("dll", "2b. Buatlah fungsi untuk mencari lagu berdasarkan judul, dengan penelusuran dimulai dari lagu terakhir!\n\nfunction cariLagu (L : List, cari : string) → Address\n{Mengembalikan alamat elemen lagu berjudul cari yang pertama ditemukan saat penelusuran dari lagu terakhir menuju lagu pertama; NIL jika list kosong atau judul tidak ditemukan.}", [["Penelusuran dimulai dari last", 2], ["Bergerak mundur dengan prev sampai NIL", 2], ["Mengembalikan alamat yang ditemukan atau NIL (termasuk list kosong)", 2]], "P ← last(L); while P ≠ NIL and info(P).judul ≠ cari: P ← prev(P); return P."),
  q("dll", "2c. Buatlah prosedur untuk menyisipkan lagu baru tepat setelah lagu yang sedang diputar!\n\nprocedure insertNext (in/out L : List, in P : Address)\n{I.S. Terdefinisi sebuah playlist yang mungkin kosong dan P adalah alamat elemen lagu baru yang next dan prev-nya bernilai NIL.\n F.S. P disisipkan tepat setelah lagu yang sedang diputar (now_playing); lagu yang sedang diputar tidak berubah. Jika playlist kosong, P menjadi satu-satunya lagu dan menjadi lagu yang sedang diputar. Jika lagu \"Embun\" disisipkan, urutannya menjadi Senja, Pagi, Embun, Hujan, Malam.}", [["Kasus playlist kosong (first, last, now_playing = P)", 2], ["Kasus now_playing adalah last (last diperbarui)", 2], ["Kasus di tengah: keempat pointer (next/prev P dan tetangga) benar", 4], ["now_playing tidak berubah", 2]], "Kosong: first=last=now_playing=P. Jika now_playing = last: next(last)←P, prev(P)←last, last←P. Selain itu: next(P)←next(np); prev(P)←np; prev(next(np))←P; next(np)←P."),
  q("dll", "2d. Buatlah prosedur untuk membalik urutan seluruh lagu dalam playlist!\n\nprocedure balikPlaylist (in/out L : List)\n{I.S. Terdefinisi sebuah playlist yang mungkin kosong.\n F.S. Urutan seluruh lagu terbalik: elemen yang semula pertama menjadi terakhir, dan sebaliknya. Pembalikan dilakukan dengan mengubah pointer next dan prev setiap elemen (tidak membuat elemen baru dan tidak menyalin info). Lagu yang sedang diputar tetap sama (now_playing tetap menunjuk elemen yang sama). Urutan menjadi Malam, Hujan, Pagi, Senja dan now_playing tetap menunjuk \"Pagi\".}", [["Menelusuri semua elemen dan menukar next dan prev tiap elemen", 3], ["Menukar first dan last", 2], ["Kasus list kosong/satu elemen dan now_playing tidak berubah", 2], ["Tanpa elemen baru dan tanpa menyalin info", 1]], "Untuk tiap P: tukar next(P) dan prev(P) (hati-hati menyimpan next lama sebelum menukar). Akhirnya tukar first dan last."),

  q("stack", "3a. Pemain menekan tombol pungut satu kali. Tuliskan isi akhir B dan L (berurutan dari dasar sampai top) beserta nilai top, dan tuliskan tampilan di layar!", [["Isi akhir B benar beserta top", 2], ["Isi akhir L benar beserta top", 2], ["Dua baris tampilan di layar benar", 2]], "B (top=10): Susu, Apel, Roti, Sabun, Kecap, Teh, Mie, Saus, Sereal, Jus. L (top=2): Telur, Keju. Layar: \"Barang terangkat: 3\" dan \"Tangan penuh, sisa barang di lantai: 2\"."),
  q("stack", "3b. Buatlah prosedur push dan pop untuk ADT Stack di atas!\n\nprocedure push (in/out S : Stack, in P : Infotype)\n{I.S. Terdefinisi stack S yang mungkin penuh dan sebuah P.\n F.S. P menjadi elemen teratas S jika stack S belum penuh.}\nDictionary: function isFull (S : Stack) → Boolean\n\nprocedure pop (in/out S : Stack, in/out P : Infotype)\n{I.S. Terdefinisi stack S yang mungkin kosong dan sebuah P.\n F.S. Bila S tidak kosong, P menyimpan elemen teratas yang dihapus dari S dan jumlah elemen stack berkurang satu.}\nDictionary: function isEmpty (S : Stack) → Boolean", [["push: cek isFull sebelum menambah", 1], ["push: top bertambah dan info[top] diisi", 2], ["pop: cek isEmpty sebelum mengambil", 1], ["pop: P menerima info[top] dan top berkurang", 2]], "push: if not isFull(S) then top←top+1; info[top]←P. pop: if not isEmpty(S) then P←info[top]; top←top-1."),
  q("stack", "3c. Buatlah prosedur yang menjalankan satu kali proses memungut sesuai aturan memungut dan tampilan di layar!\n\nprocedure angkatBarang (in/out B : Stack, in/out L : Stack)\n{I.S. Terdefinisi stack B (mungkin kosong atau penuh) dan stack L (mungkin kosong).\n F.S. Barang dipindahkan satu per satu dari top L ke top B sampai B penuh atau L kosong. Ditampilkan \"Barang terangkat: <n>\", n banyak barang yang dipindahkan pada pemanggilan ini. Jika L kosong, ditampilkan \"Lantai bersih\"; jika tidak, ditampilkan \"Tangan penuh, sisa barang di lantai: <banyak barang di L>\".}\nDictionary: isEmpty(S), isFull(S), size(S) → Index, push(S, P), pop(S, P)\nGUNAKAN SUBPROGRAM ADT STACK, DILARANG MENGAKSES INDEKS/ELEMEN ARRAY LANGSUNG.", [["Perulangan dengan syarat berhenti B penuh atau L kosong", 3], ["Memindahkan dengan pop L lalu push B", 2], ["Menghitung n hanya untuk pemanggilan ini", 2], ["Baris pertama tampilan benar", 1], ["Baris kedua: kedua kasus benar (termasuk L kosong dan B penuh bersamaan)", 2]], "n←0; while not isFull(B) and not isEmpty(L): pop(L,x); push(B,x); n←n+1. output(\"Barang terangkat: \", n). If isEmpty(L) output \"Lantai bersih\" else output(\"Tangan penuh, sisa barang di lantai: \", size(L))."),
  q("stack", "3d. Pemain memakai scroll wheel untuk berganti barang yang siap ditaruh di rak. Satu kali scroll memindahkan barang di top B ke posisi paling bawah, sedangkan barang lainnya naik satu posisi dengan urutan tetap. Buatlah prosedur untuk satu kali scroll!\n\nprocedure scrollItem (in/out B : Stack)\n{I.S. Terdefinisi stack B yang mungkin kosong.\n F.S. Jika B tidak kosong, barang di top B berpindah ke posisi paling bawah dan barang lain naik satu posisi dengan urutan tetap. Jika B kosong atau hanya berisi satu barang, isi B tidak berubah. Tidak ada tampilan ke layar.}\nDictionary: createStack() → Stack; isEmpty(S); push(S, P); pop(S, P)\nBoleh memakai stack bantu bertipe Stack. DILARANG mengakses indeks/elemen array langsung.", [["Menyimpan barang top B dan menangani B kosong/satu elemen", 2], ["Memindahkan sisa elemen ke stack bantu sampai B kosong", 2], ["Memasukkan barang top tadi sebagai dasar B", 2], ["Mengembalikan elemen dari stack bantu ke B dengan urutan tetap", 1], ["Hanya memakai subprogram ADT", 1]], "pop(B,x); T←createStack(); while not isEmpty(B): pop(B,y); push(T,y). push(B,x). while not isEmpty(T): pop(T,y); push(B,y)."),

  q("queue", "4a. Buatlah prosedur untuk menambahkan elemen baru ke dalam queue!\n\nprocedure enqueue (in/out Q : Queue, in P : Address)\n{I.S. Terdefinisi queue Q yang mungkin kosong dan sebuah P yang tidak NIL.\n F.S. P menjadi elemen terakhir Q.}\nDictionary: function isEmpty (Q : Queue) → Boolean", [["Kasus kosong: head dan tail = P", 2], ["Kasus tidak kosong: next(tail), prev(P), tail diperbarui", 3], ["next(P) = NIL", 1]], "if isEmpty(Q): head←P; tail←P else next(tail)←P; prev(P)←tail; tail←P."),
  q("queue", "4b. Buatlah prosedur untuk menghapus elemen dari queue!\n\nprocedure dequeue (in/out Q : Queue, in/out P : Address)\n{I.S. Terdefinisi queue Q yang mungkin kosong dan sebuah pointer P.\n F.S. Bila Q tidak kosong, P menyimpan elemen pertama yang dihapus dari Q dan jumlah elemen queue berkurang satu. Bila Q kosong, P bernilai NIL.}\nDictionary: function isEmpty (Q : Queue) → Boolean", [["Q kosong: P = NIL", 1], ["Satu elemen: head dan tail menjadi NIL", 2], ["Lebih dari satu: head maju dan prev(head) = NIL", 2], ["P terlepas (next(P) = NIL)", 1]], "if isEmpty(Q): P←NIL else P←head; if head=tail: head←NIL; tail←NIL else head←next(P); prev(head)←NIL; next(P)←NIL."),
  q("queue", "4c. Buatlah prosedur untuk mendaftarkan pelanggan baru ke antrean dengan ketentuan: satu nama hanya boleh satu kali di antrean, dan antrean berisi paling banyak 5 pelanggan. Contoh: \"Bima\" ditolak karena namanya sudah ada, sedangkan \"Eka\" boleh mendaftar karena antrean baru berisi 4 pelanggan.\n\nprocedure daftarAntrean (in/out Q : Queue, in plg : Infotype)\n{I.S. Terdefinisi sebuah antrean Q yang mungkin kosong dan data pelanggan plg.\n F.S. Jika nama plg sudah ada di antrean, ditampilkan \"Sudah mengantre\". Jika belum, tetapi antrean sudah berisi 5 pelanggan, ditampilkan \"Antrean penuh\". Selain itu, plg ditambahkan ke Q sebagai elemen terakhir.}\nDictionary: createNewElm(x : Infotype) → Address; enqueue(in/out Q, in P)", [["Menelusuri antrean untuk memeriksa nama yang sama", 3], ["Menghitung jumlah elemen antrean", 3], ["Urutan pemeriksaan: nama ganda dulu, lalu penuh; pesan benar", 1], ["createNewElm dan enqueue pada kasus lolos", 2], ["Menangani antrean kosong", 1]], "Telusuri dari head, hitung n dan tandai ada jika nama sama. If ada: output \"Sudah mengantre\"; else if n = 5: output \"Antrean penuh\"; else enqueue(Q, createNewElm(plg))."),
  q("queue", "4d. Buatlah prosedur untuk menyimulasikan layanan bergiliran (round robin)!\n\nprocedure layaniRR (in/out Q : Queue, in kuantum : integer)\n{I.S. Terdefinisi sebuah antrean Q yang mungkin kosong dan kuantum > 0 (menit). Setiap pelanggan memiliki sisa > 0. Layanan dimulai pada menit ke-0.\n F.S. Pelanggan terdepan dilayani paling lama sebesar kuantum menit. Jika sisa waktunya <= kuantum, pelanggan selesai: ditampilkan nama dan menit selesainya, lalu elemennya dibebaskan dari memori. Jika belum selesai, sisa waktunya dikurangi sebesar kuantum dan pelanggan dimasukkan kembali sebagai elemen terakhir. Proses berhenti saat antrean kosong. Dengan kuantum = 15, ditampilkan: Bima 25, Dito 55, Ayu 65, Citra 90.}\nDictionary: isEmpty(Q); dequeue(in/out Q, in/out P); enqueue(in/out Q, in P); deallocate(in/out P)", [["Perulangan sampai antrean kosong dengan dequeue", 2], ["Pencatatan waktu berjalan", 2], ["Selesai: tampilkan nama dan waktu, lalu deallocate", 2], ["Belum selesai: kurangi sisa dan enqueue kembali", 2]], "t←0; while not isEmpty(Q): dequeue(Q,P); if sisa(P) <= kuantum: t←t+sisa(P); output(nama(P), t); deallocate(P) else sisa(P)←sisa(P)-kuantum; t←t+kuantum; enqueue(Q,P)."),
];

const SEC = ["sll", "dll", "stack", "queue"];
// Satu soal = bagian a-d: satu kotak jawaban, rubrik satu kriteria per bagian (rinciannya di teks kriteria), kunci per bagian di panduan.
const QS: Q[] = SEC.map((k) => {
  const ps = PARTS.filter((p) => p.section === k);
  const letter = (i: number) => "abcd"[i];
  const stem = "Kerjakan semua bagian (a sampai d). Tuliskan jawaban dalam satu kotak dan awali tiap jawaban dengan hurufnya (a., b., c., d.).\nNaskah soal lengkap ada pada gambar halaman di atas. Semua jawaban diketik di kotak ini (tidak ditulis di kertas); tabel atau gambar ditulis sebagai teks, mis. B (top=3): Susu, Apel, Roti.\n\n" + NASKAH[k].parts.map((p) => p.split("\n")[0]).join("\n");
  const rubric: R = ps.map((p, i) => [`(${letter(i)}) ${p.stem.split("\n")[0].replace(/^\d[a-d]\.\s*/, "").replace(/!$/, "")}. Rincian: ${p.rubric.map(([c, n]) => `${c} (${n})`).join("; ")}`, p.points]);
  return q(k, stem, rubric, ps.map((p, i) => `(${letter(i)}) ${p.guide}`).join("\n"));
});

const NAME = "UTS Struktur Data (CAK2EAB4) - S1 Informatika Ganjil 2026/2027";

async function main() {
  const apply = process.argv.includes("--apply");
  const total = QS.reduce((n, x) => n + x.points, 0);
  console.log(`${QS.length} soal, total ${total} poin`);
  for (const x of QS) console.log(x.section, "stem", x.stem.length, "poin", x.points);
  if (total !== 120 || QS.length !== 4 || QS.some((x) => x.stem.length > 4000)) throw new Error("Harus 4 soal / 120 poin / stem <= 4000");
  if (!apply) { console.log("SIMULASI selesai. Tidak ada yang ditulis."); return; }

  const { connectDB } = await import("../lib/db");
  const { Question, QuestionGroup } = await import("../models/Question");
  const { Test } = await import("../models/Test");
  const { TestSession, TestSeat } = await import("../models/Schedule");
  const { ScoringProfile } = await import("../models/Scoring");
  const { Institution } = await import("../models/Institution");
  const { User } = await import("../models/User");
  const { questionSchema } = await import("../lib/admin-schemas");
  const { sanitizePassage } = await import("../lib/sanitize");
  await connectDB();
  if (await Test.exists({ name: NAME })) throw new Error("Ujian sudah ada, batal");

  const gid: Record<string, Types.ObjectId> = {};
  const { Asset } = await import("../models/Asset");
  for (const k of SEC) {
    const imgs: string[] = [];
    for (const n of HALAMAN[k]) {
      const buf = readFileSync(join(process.cwd(), "scripts", "uts-halaman", `p${String(n).padStart(2, "0")}.png`));
      const sha = createHash("sha256").update(buf).digest("hex");
      const a = (await Asset.findOne({ sha256: sha }).select("_id").lean()) ?? (await Asset.create({ mime: "image/png", size: buf.length, dataBase64: buf.toString("base64"), sha256: sha, name: `UTS Struktur Data hal ${n}` }));
      imgs.push(`<p><img src="/api/assets/${a._id}" alt="Naskah UTS halaman ${n}"></p>`);
    }
    gid[k] = (await QuestionGroup.create({ section: k, passageTitle: NASKAH[k].title.replace(/\s+/g, " "), passageHtml: sanitizePassage(imgs.join("")), instruction: "Naskah soal sama persis dengan lembar ujian. Jawab pada kotak jawaban di bawah." }))._id;
  }
  const ids: Record<string, Types.ObjectId[]> = { sll: [], dll: [], stack: [], queue: [] };
  for (const x of QS) {
    const d = questionSchema.parse({ difficulty: "medium", status: "published", section: x.section, type: x.section.toUpperCase(), kind: "essay", points: x.points, stem: x.stem, groupId: String(gid[x.section]),
      tags: [{ skill: "struktur-data", topic: x.section }], key: { rubric: x.rubric.map(([criterion, points]) => ({ criterion, points })), guide: x.guide } });
    const doc = await Question.create(d);
    ids[x.section].push(doc._id);
  }
  const prof = await ScoringProfile.findOneAndUpdate({ name: "Persentase UTS" },
    { $setOnInsert: { name: "Persentase UTS", description: "Skor = persen poin. Lulus bila minimal 60%.", mode: "linear", scale: "percent", passMark: 60, tables: {}, verified: false } },
    { upsert: true, returnDocument: "after" });
  const test = await Test.create({ name: NAME, kind: "final", requirePlacement: false, scoringProfileId: prof!._id, scheduled: true, maxAttempts: 1,
    sections: SEC.map((k) => ({ name: k, durationSec: 30 * 60, questionIds: ids[k] })) });
  const opensAt = new Date("2026-11-02T03:45:00Z"), closesAt = new Date("2026-11-02T05:45:00Z"); // 10.45-12.45 WIB
  const inst = await Institution.findOne({ code: "TUJ2025" });
  const users = await User.find({ institutionId: inst!._id, role: "participant" }).select("_id").lean();
  const session = await TestSession.create({ testId: test._id, label: "UTS Struktur Data, 2 Nov 2026 10.45-12.45 WIB", opensAt, closesAt, capacity: Math.max(users.length, 1) });
  await TestSeat.insertMany(users.map((u) => ({ testId: test._id, sessionId: session._id, userId: u._id })));
  console.log(`Test ${test._id}, sesi ${session._id}, kursi ${users.length}`);
  process.exit(0);
}
main().catch((e) => { console.error("GAGAL:", e instanceof Error ? e.message : e); process.exit(1); });
