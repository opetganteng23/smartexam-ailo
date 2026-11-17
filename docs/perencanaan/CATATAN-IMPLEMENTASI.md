# Catatan implementasi Smartexam Umum

Dikerjakan otonom di cabang `feat/umum` (mulai 16 Nov 2026). Berkas ini mencatat selisih rencana dengan kode, keputusan otonom, dan bukti checklist keamanan.

## Selisih rencana dengan kode

| No | Rencana | Kode sebenarnya | Penanganan |
|---|---|---|---|
| S1 | Alur ITP/AirNav masih hidup dan harus tetap sama | Sebagian besar alur ITP sudah dibuang pada 30 Okt 2026 (placement, ujian resmi, sertifikat ITP mati lewat saklar fitur, bawaan mati). Model dan rute level/placement masih ada | Perilaku course ITP dijaga lewat tes regresi (`tests/umum-akses.test.ts`); tidak ada kode ITP yang dihapus atau diubah perilakunya |
| S2 | `GET /api/courses` ikut saklar modul Learning | Halaman `/learn` sudah dijaga `gatePage("learning")`, tetapi API belum | API sekarang mengembalikan daftar kosong bila `featuresFor(me).learning` mati (saklar global DAN modul institusi). Halaman sudah 404 saat mati, jadi tidak ada perubahan yang terlihat untuk ITP |
| S3 | `Course.track` di data lama | Course lama tidak punya field `track` | Tanpa migrasi: kode membaca `track ?? "itp"`; query memakai `track: { $ne: "general" }` untuk jalur ITP |

## Keputusan otonom

| No | Keputusan | Alasan |
|---|---|---|
| A1 | `needsPlacement` bernilai true hanya bila peserta tidak punya course umum DAN placement ITP belum ada | Peserta course umum tidak boleh dipaksa placement; tanpa course umum perilaku lama tetap |
| A2 | Course `accessMode: "paid"` tidak pernah masuk daftar peserta (jalur ditetapkan) | K6: pembayaran belum dibangun; data disiapkan saja |
| A3 | Peserta tanpa institusi hanya melihat course umum yang tidak dibatasi institusi (`institutionIds` kosong); tanpa kelas hanya yang `classIds`-nya kosong | Pilihan paling aman (menolak bila ragu) |
| A4 | Materi yang hanya dipakai course umum yang tidak boleh dibuka peserta disembunyikan dari daftar dan dari tautan langsung (`restrictedMaterialIds`) | Materi berdiri sendiri di perpustakaan; tanpa ini tautan slug membocorkan isi course institusi lain |
| A5 | Kategori memakai `nameKey` (huruf kecil, spasi dirapatkan) yang unik | Mencegah kategori kembar tanpa migrasi |

## Checklist keamanan (bukti tes)

Diisi per tahap.

| Item | Tes |
|---|---|
| Otorisasi dan IDOR course, unit, materi (tahap 1) | `tests/umum-akses.test.ts` (filter per institusi, kelas, level; rute `/api/courses` dan `/api/units/[id]`; materi terbatas), `tests/umum-kategori.test.ts` (peran, 401/403) |
| Validasi zod ketat (tahap 1) | `tests/umum-kategori.test.ts` (ObjectId, operator `$`, enum, batas daftar) |
| CSRF | Pengecekan Origin global di `middleware.ts` berlaku untuk semua mutasi baru; tidak ada rute baru di luar `/api/` |
| Audit log (tahap 1) | `category.create/update/delete` dan `course.*` memanggil `audit()` |
| Otorisasi koleksi dan bank soal (tahap 2) | `tests/umum-koleksi.test.ts`, `tests/umum-koleksi2.test.ts` (koleksi private/institusi/global, IDOR ekspor, riwayat, duplikat, perakit tes, impor) |
| Kebocoran kunci jawaban | `tests/umum-tes.test.ts`, `umum-tes2.test.ts`, `umum-stem.test.ts`, `umum-prepost.test.ts` (soal peserta tanpa `answerKey`, `accepted`, `rubric`); smoke `ONLY=umum` memeriksa JSON soal |
| XSS (HTML soal, materi, komentar, tugas) | `tests/umum-stem.test.ts`, `import-umum.test.ts` (HTML soal disanitasi), `umum-diskusi.test.ts` (komentar teks polos), `umum-presets.test.ts` (preset materi) |
| Impor XML (XXE, DOCTYPE, ukuran) | `tests/import-umum.test.ts` (DOCTYPE/ENTITY ditolak, batas ukuran, duplikat) |
| Unggah video (sniff byte, ukuran, otorisasi, token) | `tests/umum-video.test.ts`, `umum-video2.test.ts` (bukan MP4 ditolak, Range, token 1 jam terikat pengguna, peserta tanpa hak ditolak) |
| Unggah tugas (sniff, Content-Length, akses unit) | `tests/umum-tugas.test.ts` |
| Akses tes umum (course, prasyarat, jendela harian, balapan start) | `tests/umum-tes.test.ts`, `umum-tes2.test.ts`, `umum-prepost.test.ts` |
| Sertifikat course (idempoten, verifikasi publik, nama disamarkan) | `tests/umum-sertifikat.test.ts` |
| Statistik butir (otorisasi, peserta uji dikecualikan, snapshot) | `tests/umum-butir.test.ts` |
| Akses materi bawaan free, saklar itpPack | `tests/umum-materi-akses.test.ts`, `tests/umum-templat.test.ts` (gate server di course-templates dan scaffold) |
| CSP | Tidak dilonggarkan; YouTube di iframe materi ditunda (lihat TODO) |
| npm audit | `npm audit --omit=dev`: 12 temuan (baseline 13), `npm audit fix` tidak dijalankan |
| Bukti belum ada | Ekspor Excel tes umum (perbaikan tinjauan tahap 7) belum punya tes otomatis; hanya diperiksa lewat typecheck dan tinjauan kode |

## Tinjauan independen tahap 1

Dua subagent (keamanan, QA/regresi) tidak menemukan celah berat atau regresi ITP. Diperbaiki (tes: `tests/umum-review1.test.ts`):
- Hapus kelas atau institusi kini mencabut id-nya dari `Course.classIds` / `institutionIds` (sebelumnya course jadi tak terlihat siapa pun).
- Course umum selalu disimpan tanpa `levelId` (skema); PATCH tanpa `track` tidak lagi mengubah course umum menjadi ITP.

Dicatat, belum dikerjakan: judul course prasyarat dari cakupan lain bisa tampil pada pesan "Finish X first" (konfigurasi admin); heartbeat `/api/events` menerima `refId` sembarang (sudah ada sebelumnya, hanya mengotori analitik); rute aset gambar belum diperiksa terhadap `restrictedMaterialIds`; `restrictedMaterialIds` memuat semua unit course umum per permintaan (aman untuk skala kecil); tes rute untuk jalur `itpBlocked` dan `ClassMember` nonaktif belum ada.

## Terhalang

`npm install --save-exact fast-xml-parser@5.12.1` ditolak oleh pengklasifikasi izin; U2.2 (impor Moodle XML) menunggu izin dari pemilik. Tahap 2 lainnya belum dimulai.

## Tinjauan independen tahap 2

Dua subagent menemukan IDOR nyata (rute yang belum memakai filter visibilitas koleksi) dan beberapa regresi tampilan. Semua temuan berat diperbaiki dan diuji (`tests/umum-koleksi2.test.ts`):
- Ekspor CSV, riwayat versi dan pemulihan, duplikat, rute `generate`, perakit tes (`validateTestQuestions`), dan deteksi duplikat impor kini memakai visibilitas koleksi; soal tak terlihat dijawab 404 atau dianggap tidak ada (tidak menjadi oracle keberadaan).
- Mengubah soal yang berada di koleksi butuh hak tulis atas koleksinya; berpindah koleksi tercatat di audit (`collectionFrom`/`collectionTo`).
- Soal berformat HTML tampil sebagai teks di Test Builder, daftar pratinjau tes, halaman audio, dan ekspor CSV; "Check first" pada impor XML memeriksa gambar sama ketatnya dengan impor nyata.

Dicatat, tidak dikerjakan: tidak ada indeks unik `contentHash` (dua admin yang mengimpor berkas sama bersamaan bisa menggandakan; klik ganda di UI dicegah `busy`); gambar yang sudah tersimpan tetap ada bila soalnya kemudian gagal atau duplikat (aset memang dipakai ulang lewat sidik); impor ulang CSV dari ekspor tidak membawa `stemFormat`/jenis non-pilihan-ganda (ekspor hanya pilihan ganda, sebagaimana sebelumnya); opsi bergambar Moodle diratakan menjadi teks; `question-versions` belum menampilkan `stemFormat`/`categoryId` pada diff.

Keputusan otonom: rute aset gambar (`/api/assets/<id>`) tidak dibuat sadar-course. Aset non-sensitif memang publik dan dicache `immutable`; pembatasan hanya berarti bila anonim juga ditolak, yang merusak landing dan cache. ID aset tidak dapat dienumerasi lewat API mana pun. Risiko diterima dan dicatat.

## Tinjauan independen tahap 3

Tidak ada celah berat. Diperbaiki (tes: `tests/umum-tes2.test.ts`): start ganda bersamaan (periksa ulang setelah membuat, yang paling awal menang; batas `maxAttempts` dan `maxPerDay` ikut), prasyarat course berlaku di rute start dan daftar tes, validasi penarikan memakai blok passage/audio yang sebenarnya, soal yang sudah ditarik ke percobaan tidak bisa dihapus, percobaan `general` (skala persen) tidak bercampur dengan riwayat ITP di beranda, hasil, dan tampilan staf, monitor institusi menyertakan `general`, input topik di editor penarikan.

Dicatat, tidak dikerjakan: tidak ada indeks unik parsial untuk percobaan `in_progress` (indeks baru bisa gagal dibangun di data produksi yang sudah punya duplikat; pemeriksaan ulang di atas menutup kasus praktisnya); penarikan tidak memfilter `Question.section` (koleksi lintas bagian memang boleh); soal tetap pada bagian setelah bagian draw tidak dikeluarkan dari kolam tarikan; `?pre=` pada laporan pre/post bebas memilih tes umum (hanya peran akademik pusat yang bisa mengakses); tes harian menghitung jendela dari jam sistem sehingga tes `umum-tes.test.ts` bisa goyah tepat di pergantian menit.

## Tinjauan independen tahap 4

Tidak ada celah berat. Diperbaiki (tes: `tests/umum-video.test.ts`, `tests/umum-video2.test.ts`): tautan bertanda tangan berlaku 1 jam (bukan 3), hanya dipakai pemiliknya bila pengguna sedang masuk, tamu diverifikasi tanda tangannya sebelum dihitung rate limit, header `Referrer-Policy: no-referrer` pada klip; galat tulis GridFS tidak lagi menjadi uncaught exception dan berkas yatim dibersihkan bila metadata gagal tersimpan; PATCH grup tanpa `videoId` tidak melepas video; berkas GridFS yang hilang dijawab 404.

Dicatat, tidak dikerjakan: `canWatchVideo` memakai `$regex` pada isi materi (tanpa indeks) tiap 60 detik per pengguna per klip; solusi lanjutan adalah kolom `Material.videoIds[]` terindeks yang diisi saat simpan. Rate limit unggahan hanya per proses (satu instance PM2 sesuai K1). Rentang ganda (`bytes=a-b,c-d`) dijawab 416. Pemilih video di editor materi hanya untuk peran penulis materi (admin, academic_admin); embed Vimeo bisa dipakai pada grup soal tetapi tidak disisipkan lewat editor rich text.

Keputusan U4.3: YouTube pada materi HTML (iframe tersandbox) tidak dikerjakan. Tidak ada browser untuk membuktikan bahwa iframe tersandbox tanpa `allow-same-origin` memuat embed dengan aman, dan CSP tidak boleh dilonggarkan tanpa bukti; video dari server sendiri lewat `<video src>` dengan tautan bertanda tangan sudah tersedia. CSP aplikasi (`next.config.mjs`) hanya memuat `frame-ancestors`, `object-src`, dan `base-uri`; tidak diubah.

## Tinjauan independen tahap 5-7

Tahap 5 dan 6 ditinjau setelah masing-masing selesai (perbaikan sudah tercatat di riwayat komit: banner course ITP, regex pratinjau, halaman verifikasi publik CRS, komentar moderator lintas institusi, Content-Length unggahan tugas, akses unit untuk tugas, middleware academic_admin, batas penurunan maxPoints).

Tahap 7, keamanan: tidak ada temuan berat atau sedang. Diperbaiki: kueri snapshot statistik butir kini memakai `select` dan `sort({_id:-1})` sebelum `limit(5000)`. Dicatat saja: saklar `itpPack` hanya menyembunyikan menu, templat, dan scaffold; rute ITP lama tetap dijaga saklar dan peran masing-masing (bukan niat membatasi URL langsung).

Tahap 7, QA/regresi: dua temuan berat pada ekspor Excel tes umum, diperbaiki (komit 57bac68): kolom Level kini kosong untuk skala persen (sebelumnya skor persen dipetakan ke nama level ITP) dan data bar Total score memakai rentang 0-100 bila ada skor persen. Belum ada tes otomatis untuk ekspor Excel; ini dicatat sebagai bukti yang belum ada. Dicatat tanpa perbaikan: statistik butir tidak memberi tanda bila data terpotong 5000 percobaan; percobaan lama tanpa snapshot dan soal yang sudah dihapus tidak masuk statistik; smoke penuh hanya bermakna untuk `ONLY=umum`.

## Tahap 8 - Perapihan bank soal dan sisa ITP

Keputusan otonom: (1) bank soal = koleksi, mata pelajaran = kategori; section diturunkan dari mata pelajaran bank (`lib/section-key.ts`, `lib/question-bank.ts`); (2) soal bagian ITP (listening, structure, reading) tetap boleh tanpa bank; (3) soal lama tanpa bank tidak dimigrasi otomatis, harus dipindah massal; (4) bank bawaan course bersifat global dan ikut mata pelajaran course (hanya saat berubah); (5) tes umum dengan bank: soal manual hanya dari bank itu dan `extraBankIds`, nama bagian bebas; tanpa bank perilaku lama; bank tes dikunci setelah ada percobaan; (6) menu Analytics disembunyikan tanpa paket ITP karena skalanya 310-677.

Bukti keamanan (tes): `umum-bank` (bank wajib, section turunan, filter belum dikelompokkan, pindah massal dengan IDOR, peran, masukan tidak sah), `umum-bank-tes` (bank bawaan course, bank tes, bank lain eksplisit, bank tak terlihat ditolak, sinkron kategori), `import-umum` (bank wajib pada impor), `umum-ekspor` (tanpa level ITP di Excel).

Tinjauan independen Tahap 8. Keamanan: tidak ada temuan berat; diperbaiki (tes: `umum-bank-tes`): tes umum tanpa bank kembali mencocokkan nama bagian, sinkron bank bawaan hanya saat mata pelajaran course berubah, bank tes dikunci setelah ada percobaan, pindah massal ke bank tanpa mata pelajaran melepas mata pelajaran lama. QA: "Draft with AI" kini menyimpan ke bank terpilih (tombol disembunyikan tanpa bank); pesan galat soal lama tanpa bank menunjuk ke "Not grouped yet". Dicatat tanpa perbaikan: restore versi soal dapat membawa section lama setelah bank pindah mata pelajaran; duplikat soal dari bank yang tak boleh ditulis jatuh ke "Belum dikelompokkan"; sinkron kategori bank dan pindah massal tidak menulis riwayat versi per soal; pickCourse di pembuat tes memakai nilai lama setelah menunggu jaringan; tes umum baru tanpa bank tidak dibatasi (perilaku lama dipertahankan); audit global judul audio pada impor (sudah ada sebelum Tahap 8).

Sisa ITP yang tidak dikerjakan (B6), dengan alasan: Charts/SegmentAnalytics/ResultReport memakai skala 310-677 untuk data ITP (halaman Analytics disembunyikan, ResultReport sudah mendukung persen); halaman Scoring, Coaching, Official Exam, Class Results, Cycles, dan Certificates ITP sudah di balik saklar fitur/paket (disembunyikan, rute tetap dijaga peran dan saklar); teks "Progress updates: Placement result, level-ups" di profil peserta dan opsi saklar Coaching/Official Exam di Settings tidak diubah (saklar fitur memang menyebut nama fitur); kata "Listening" pada data tes ITP tetap muncul bila tes ITP lama dipakai.

QA visual (B8): tidak dilakukan, tidak ada browser (ekstensi Chrome terputus, browser bawaan tidak tersedia). Tidak ada item 🔄 visual yang ditutup.

## Gerbang Akhir (G.1): GAGAL, `main` tidak disentuh

Hasil pada komit akhir `feat/umum`:
- Lulus: `tsc --noEmit` bersih; `npm run lint` hanya peringatan lama (`TestAudio.tsx`); 288 tes hijau (49 berkas); build produksi sukses; `npm audit --omit=dev` 12 temuan (baseline 13); smoke `ONLY=umum` hijau (23 pemeriksaan); diff `main...feat/umum` tanpa rahasia dan tanpa berkas data (satu-satunya XML adalah fixture sintetis); `git status` hanya `Logo AILO Squared.png` tidak terlacak.
- Gagal: kriteria "setiap item ✅ atau ⏭️ beralasan" tidak terpenuhi. Item berstatus 🔄 pada UI (antara lain U1.1, U1.6, U2.5, U2.6, U3.2, U3.5, U4.1-U4.3, U5.x, U6.1, U6.2, U6.4, U7.4, U7.6) belum diuji visual di browser, dan U7.2 (ekspor Excel) belum punya tes otomatis. Smoke penuh lama (placement/coaching ITP) tidak bisa dijalankan di lingkungan uji.
- Akibat: tidak ada merge ke `main`, tidak ada tag `umum-v1`. Langkah berikutnya: jalankan `docs/panduan/QA_Panduan_Uji_Umum.md` di staging, tutup item 🔄, lalu ulangi G.1.
