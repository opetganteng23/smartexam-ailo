# Rencana Smartexam Umum (semua mata pelajaran)

Disusun 16 November 2026 dari diskusi pemilik. Tujuan: Smartexam dipakai untuk course, kuis, pre/post-test, dan ujian semua mata pelajaran atau mata kuliah. TOEFL ITP menjadi satu paket di dalamnya, bukan dasar sistem.

Ukuran: S = setengah hari, M = 1-2 hari, L = 3-5 hari (perkiraan kasar). Status awal semua item: belum dikerjakan.

## Keputusan (16 Nov 2026)

| No | Topik | Keputusan |
|---|---|---|
| K1 | Server | Memakai server ailolabs (Biznet Gio) yang sudah ada: Caddy (kontainer Docker) meneruskan ke PM2 port 4100, MongoDB berupa kontainer bersama, hanya database `smartexam` yang dipakai, domain `smartexam.ailo.ai.id`. Satu instance PM2. Nginx di README adalah alternatif, bukan target |
| K2 | Video | Bawaan: embed YouTube tidak terdaftar atau Vimeo. Unggah sendiri hanya untuk klip pendek: MP4 H.264, maksimal 100 MB per berkas, disimpan di GridFS bucket `video` pada database `smartexam`, dikecualikan dari dump harian. Caddy `max_size` (sekarang 20MB) dinaikkan. Tinjau ulang bila disk server di atas 70% |
| K3 | Akses course | Per institusi, dipersempit per kelas bila perlu. `Course.institutionIds` (kosong = semua institusi) dan `Course.classIds` (kosong = semua kelas di institusi itu). Kelas memakai model `ClassGroup` yang sekarang mewajibkan `levelId`; harus dibuat opsional |
| K4 | Bank soal | Kategori -> Koleksi -> Soal. Koleksi punya pemilik dan visibilitas (pribadi, institusi, global). Impor ke koleksi, deteksi duplikat, tes mengambil soal dari koleksi (tetap atau acak N per topik atau kesulitan). Workflow draft/review/published yang ada dipertahankan |
| K5 | Kuis harian | Kuis dengan jendela buka-tutup harian; soal diambil acak N dari koleksi tiap percobaan (bawaan) atau tetap. Batas satu percobaan per hari ditambahkan kemudian |
| K6 | Jalur akses dan bayar | `Course.accessMode`: `assigned` (ditetapkan ke institusi atau kelas, bawaan) atau `paid` (individu bayar lewat Midtrans). Hanya `assigned` yang dibangun dulu. `paid` hanya disiapkan di data (`accessMode`, `priceIdr`) karena butuh pendaftaran mandiri, yang bertentangan dengan aturan "peserta tidak mendaftar sendiri". Saat diaktifkan: akun dibuat otomatis setelah bayar dan diverifikasi OTP email. Pembelian institusi lewat kontrak atau kursi tetap jalur `assigned` |

## Temuan yang mendasari rencana

- `Course.levelId` wajib dan peserta tanpa hasil placement tidak melihat course apa pun (`GET /api/courses` mengembalikan `needsPlacement`).
- Impor soal hanya menerima section `listening`, `structure`, `reading`, dan hanya pilihan ganda.
- Teks soal di ruang tes ditampilkan sebagai teks biasa (batas 4000 karakter), jadi soal HTML (kode, gambar) tampil dengan tag mentah.
- Jenis tes (`placement`, `sim`, `final`, `practice`, `quiz`, `section`) mengikuti alur TOEFL; `quiz` hanya dari unit, `section` hanya di akhir course.
- Materi sudah mendukung `rich` (TipTap, YouTube) dan `html` (iframe tersandbox). Video unggahan belum ada; CSP materi HTML `frame-src 'none'`.
- Kelas (`ClassGroup`) mewajibkan `levelId`.

## Tahap 1 - Fondasi course umum

| No | Item | Ukuran | Selesai bila |
|---|---|---|---|
| 1.1 | Entitas Kategori (mata pelajaran), dipakai course, koleksi, tes, materi | S | Kategori bisa dibuat dan dipilih di form course |
| 1.2 | `Course`: `levelId` opsional; tambah `track` (`general`/`itp`), `categoryId`, `institutionIds`, `classIds`, `accessMode` | M | Course tanpa level bisa dibuat; course lama otomatis `itp` |
| 1.3 | `ClassGroup.levelId` dan skemanya opsional | S | Kelas tanpa level bisa dibuat |
| 1.4 | `GET /api/courses`: gabungkan track umum (institusi + kelas) dan ITP; `needsPlacement` hanya untuk ITP; ikuti saklar modul Learning per institusi | M | Peserta tanpa placement melihat course umum miliknya; alur ITP lama tidak berubah |
| 1.5 | Form admin course: sembunyikan "Exam part" dan tombol template TOEFL di track umum | S | Course Struktur Data dibuat tanpa istilah TOEFL |

Uji: `npm run typecheck` dan `npm test` hijau; tes baru: peserta tanpa placement melihat course umum institusinya dan tidak melihat course institusi lain.

## Tahap 2 - Bank soal

| No | Item | Ukuran |
|---|---|---|
| 2.1 | Impor menerima kategori bebas (hapus pembatasan tiga section) | S |
| 2.2 | Impor Moodle XML (`fast-xml-parser`): multichoice, truefalse, shortanswer, matching, essay; tag XML ke skill + topic; gambar ke `Asset`; jenis lain dilewati dan dilaporkan | M |
| 2.3 | Impor semua jenis soal untuk CSV, Excel, DOCX | M |
| 2.4 | Deteksi duplikat saat impor (hash isi soal dan opsi) | S |
| 2.5 | Teks soal HTML tersanitasi (kode, gambar) di ruang tes, pratinjau, dan hasil | M |
| 2.6 | Koleksi bank soal, visibilitas, tab per kategori menggantikan tab Listening/Structure/Reading | M-L |

Uji: dua berkas `Bank_Soal_UTS_SDA_*.xml` menghasilkan 95 soal; impor ulang tidak menggandakan; soal berisi kode tampil benar. Cek dulu apakah model soal mendukung lebih dari satu jawaban benar (`single=false`).

## Tahap 3 - Tes umum

| No | Item | Ukuran |
|---|---|---|
| 3.1 | Kind `general` dan field `purpose` (`daily`, `pretest`, `posttest`, `midterm`, `final`), terikat ke course dan kategori; satu cabang baru di finalisasi percobaan, skala persen, tanpa efek level atau placement | M-L |
| 3.2 | Tes berdiri sendiri di course (tidak hanya di unit atau akhir course) | M |
| 3.3 | Ambil N soal acak dari koleksi per topik atau kesulitan | M |
| 3.4 | Laporan selisih pre/post per peserta dan per topik (`topicScores` sudah tersimpan) | M |

## Tahap 4 - Video

| No | Item | Ukuran |
|---|---|---|
| 4.1 | Tag `<video>` diizinkan di sanitizer; perpustakaan video: embed YouTube/Vimeo dan unggah MP4 (GridFS, Range request) | M-L |
| 4.2 | Grup soal berbasis video (memperluas grup audio Listening) | M |
| 4.3 | Video di materi HTML: dari server sendiri lewat `<video src>` (CSP sudah mengizinkan); YouTube di iframe tersandbox diuji dulu | S-M |
| 4.4 | Caddy `max_size` dan timeout dinaikkan; dump harian mengecualikan bucket `video` | S |

## Tahap 5 - UI course

`CourseCard` dan grid di `/learn`, halaman detail, admin bertab (Info, Kurikulum, Pengaturan, Akses), pemilih ruang kerja (Umum/TOEFL ITP), field katalog (`whatYouLearn`, `requirements`, `targetAudience`, `tags`, `previewVideoUrl`), preset materi umum (flashcard, penjelasan bertahap, visualisasi struktur data). Ukuran L.

## Tahap 6 - Pengayaan dari lms-redesign

Assignment (unggah berkas atau berbasis soal), diskusi dan komentar per lesson, sertifikat penyelesaian course, template course. Tidak diambil: auth, quiz, bank soal, laporan. Pembayaran (keranjang, kupon, referral, royalti) menunggu keputusan K6 dibuka.

## Tahap 7 - Isolasi paket ITP dan sisa

Scaffold TOEFL menjadi preset, PPTX dan laporan generik, `access: paid` bawaan materi ditinjau, dwibahasa, `scripts/smoke.mjs`, statistik butir soal.

## Aturan kerja

Satu tahap per sesi, diuji, lalu di-deploy; perilaku ITP yang berjalan (placement AirNav) tidak boleh berubah. Kerjakan di cabang git terpisah dan tidak menyentuh database lain di server ailolabs.
