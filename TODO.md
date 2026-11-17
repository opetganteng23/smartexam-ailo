# TODO Smartexam by AILO

Catatan produk lama (English Inspira) diarsipkan di [docs/perencanaan/TODO-english-inspira-lama.md](docs/perencanaan/TODO-english-inspira-lama.md).

Legenda: ✅ selesai dan teruji · 🔄 sebagian · ⬜ belum

## Fase

| Fase | Isi | Status |
|---|---|---|
| F0 | Identitas: rebrand Smartexam by AILO, logo, tema teal-oranye di atas cloud white, ilustrasi Nusantara, ringkasan proctoring setelah submit | ✅ |
| F1a | Registry format ujian (`lib/exam-format.ts`), TOEFL ITP sebagai format bawaan | ✅ |
| F1b | Bagian tes bebas (pola nama, bukan enum); tabel konversi per bagian; laporan Excel dan analitik mengikuti bagian tes | ✅ |
| F1c | Ganti nama internal `itp` menjadi `official-exam` (rute, berkas, model) | ✅ |
| F1d | Jenis soal: pilihan ganda, mencocokkan, isian singkat, essay; penilaian poin; halaman Grading; draf nilai AI | ✅ |
| F2 | Skala skor generik: persen + batas lulus, atau ITP | ✅ |
| F3 | Generator soal AI dan teks level netral; ujian umum contoh (Matematika dan Logika) | ✅ |
| F4 | Tema: token warna, landing, login, shell, laporan PPT/Excel | 🔄 token dan halaman publik teruji visual; sisa halaman belum diaudit satu per satu |
| F5 | Dwibahasa EN/ID | 🔄 kerangka, menu, landing, masuk/daftar, ruang tes, Tes Saya, daftar hasil, proctoring |
| F6 | Deploy: PM2, Nginx, skrip redeploy, pengenal internal baru | 🔄 berkas siap; domain dan server belum ditentukan |
| F7 | Mapel kedua dan QA | 🔄 ujian umum teruji (unit dan alur); QA visual terbatas pada layar utama |

## Sisa pekerjaan yang diketahui

1. **Dwibahasa:** `ResultReport` (±100 teks), Beranda peserta, halaman admin, institusi, dan coach, template email, PDF, dan pesan kesalahan dari API masih berbahasa Inggris. Tes pengaman `tests/i18n.test.ts` memastikan setiap `t("...")` punya terjemahan.
2. **Executive Summary (PPTX):** masih format ITP (kolom Listening/Structure/Reading, CEFR, skala 310–677). Ekspor Excel dan analitik segmen sudah mengikuti bagian tes.
3. **Fitur format ITP:** level, placement, target skor, coaching, ujian resmi (NIK, dokumen, skor resmi), dan sertifikat memakai skala 310–677. Modul ini mati secara bawaan; tes dengan skala persen melewatinya.
4. **Jenis soal:** impor soal (CSV, Excel, DOCX) dan ekspor CSV hanya pilihan ganda. Pratinjau tes di admin belum menampilkan soal non-pilihan-ganda. Umpan balik essay dari penilai belum tampil ke peserta.
5. **Kerangka course** (`lib/course-scaffold.ts`) dan materi seed masih TOEFL ITP.
6. **Nama field database** `itpScore`, `itpDate`, `itpRequired`, dan nilai tersimpan `type: "itp"` pada sertifikat sengaja dibiarkan (hanya nama internal).
7. **Skrip `scripts/smoke.mjs`** belum diperbarui untuk jenis soal baru dan skor persen.
8. **Ilustrasi budaya** digambar sebagai pola abstrak; perlu ditinjau pihak yang paham budayanya, atau diganti ilustrasi resmi.
9. **Server dan domain** belum ditentukan; isi `deploy/nginx.smartexam.conf`, `APP_URL`, dan kontak di Settings.
10. Satu peringatan build yang tidak berbahaya: `rate-limiter-flexible` ("Critical dependency") saat `next dev`/`build`.

---

## Program Smartexam Umum (mulai 16 Nov 2026)

Rencana dan keputusan K1-K6: [docs/perencanaan/RENCANA-SMARTEXAM-UMUM.md](docs/perencanaan/RENCANA-SMARTEXAM-UMUM.md). Prompt kerja: [PROMPT-IMPLEMENTASI.md](docs/perencanaan/PROMPT-IMPLEMENTASI.md) dan [PROMPT-VERIFIKASI-PASCA-DEPLOY.md](docs/perencanaan/PROMPT-VERIFIKASI-PASCA-DEPLOY.md).
Legenda sama: ✅ selesai dan teruji · 🔄 sebagian · ⬜ belum · ⏭️ ditunda dengan alasan tertulis. Centang hanya bila tes yang membuktikannya sudah hijau.

### Tahap 1 - Fondasi course umum
- 🔄 U1.1 Entitas Kategori (model, API admin, pemilih di form) — model, API, dan tes hijau; panel dan pemilih di form belum diuji visual
- ✅ U1.2 `Course`: `levelId` opsional; tambah `track`, `categoryId`, `institutionIds`, `classIds`, `accessMode`; bila `track` kosong dianggap `itp` (tanpa migrasi wajib)
- ✅ U1.3 `ClassGroup.levelId` dan skema kelas opsional
- ✅ U1.4 `GET /api/courses` menggabungkan track umum (institusi + kelas) dan ITP; `needsPlacement` hanya untuk ITP; ikut saklar modul Learning per institusi
- ✅ U1.5 Akses dicek di sisi server pada course, unit, materi, kuis, dan ujian per bagian (bukan hanya daftar)
- 🔄 U1.6 Form admin course: sembunyikan "Exam part" dan tombol template TOEFL di track umum — kode selesai (tombol template hanya di bagian level ITP); belum diuji visual
- ✅ U1.7 Tes: peserta lintas institusi atau kelas tidak bisa membuka course lain lewat ID; alur ITP lama tidak berubah

### Tahap 2 - Bank soal
- ✅ U2.1 Impor CSV/Excel/DOCX menerima kategori bebas (hapus pembatasan listening/structure/reading)
- ✅ U2.2 Impor Moodle XML (`fast-xml-parser`): multichoice, truefalse, shortanswer, matching, essay; tag XML ke skill + topic; gambar ke `Asset`; jenis lain dilewati dan dilaporkan; tolak DOCTYPE/entity (XXE)
- ✅ U2.3 Impor semua jenis soal untuk CSV, Excel, DOCX; templat unduhan diperbarui
- ✅ U2.4 Deteksi duplikat saat impor (hash isi soal dan opsi); impor ulang tidak menggandakan
- 🔄 U2.5 Teks soal HTML tersanitasi (kode, gambar) di ruang tes, pratinjau, Grading, dan hasil — server dan tes hijau; tampilan klien belum diuji visual (hasil peserta memang tidak memuat teks soal)
- 🔄 U2.6 Koleksi bank soal: pemilik, visibilitas (pribadi/institusi/global), tab per kategori menggantikan tab Listening/Structure/Reading — API, visibilitas, dan tes hijau; UI belum diuji visual
- ✅ U2.7 Cek dukungan lebih dari satu jawaban benar (`single=false`); bila belum didukung, dilaporkan saat impor, bukan gagal diam-diam
- ✅ U2.8 Fixture sintetis kecil (tanpa data asli) dan tes impor, XSS, dan duplikat

### Tahap 3 - Tes umum
- ✅ U3.1 Kind `general` dan `purpose` (daily, pretest, posttest, midterm, final), terikat ke course dan kategori; satu cabang baru di finalisasi percobaan, skala persen
- 🔄 U3.2 Tes berdiri sendiri di course (tidak hanya di unit atau akhir course) — API, akses, dan tes hijau; tampilan di halaman Learn belum diuji visual
- ✅ U3.3 Ambil N soal acak dari koleksi per topik atau kesulitan; kunci jawaban tidak bocor
- ✅ U3.4 Kuis harian: jendela buka-tutup harian, soal acak atau tetap
- 🔄 U3.5 Laporan selisih pre/post per peserta dan per topik — API dan tes hijau; halaman laporan belum diuji visual
- ✅ U3.6 Regresi: placement, simulasi, final, hasil ditahan, sertifikat ITP tetap sama

### Tahap 4 - Video
- 🔄 U4.1 `<video>` diizinkan di sanitizer; perpustakaan video: embed YouTube/Vimeo dan unggah MP4 (maks 100 MB, GridFS bucket `video`, Range request, otorisasi sama dengan course) — API dan tes hijau; dialog perpustakaan dan tombol di editor belum diuji visual
- 🔄 U4.2 Grup soal berbasis video — API, otorisasi, dan tes hijau; pemutar di ruang tes dan dialog grup belum diuji visual
- 🔄 U4.3 Video di materi HTML dari server sendiri (tautan bertanda tangan, teruji); ⏭️ YouTube di iframe tersandbox pada materi HTML tidak dikerjakan: tidak bisa diuji di browser dan CSP materi tidak boleh dilonggarkan tanpa bukti (lihat CATATAN-IMPLEMENTASI)
- ✅ U4.4 Dump harian mengecualikan bucket `video`; catatan perubahan Caddy `max_size` dan timeout untuk operator
- ✅ U4.5 Tes unggah: tipe berkas palsu, ukuran berlebih, Range tidak sah, akses tanpa izin

### Tahap 5 - UI course
- 🔄 U5.1 `CourseCard` dan grid di `/learn` — kode, tipe, lint, dan build hijau; belum diuji visual
- 🔄 U5.2 Halaman detail course (modul dan unit, field katalog: whatYouLearn, requirements, targetAudience, tags, previewVideoUrl) — API katalog dan akses teruji (`umum-katalog.test.ts`); halaman belum diuji visual
- 🔄 U5.3 Admin course bertab: Info, Kurikulum, Pengaturan, Akses — editor bertab di kode; belum diuji visual
- 🔄 U5.4 Pemilih ruang kerja (Umum/TOEFL ITP) di header admin; menu dan istilah menyesuaikan — pemilih di bagian atas konten (cookie `ws`), menu ITP disembunyikan di ruang kerja Umum; belum diuji visual
- ✅ U5.5 Preset materi umum: flashcard, penjelasan bertahap, visualisasi struktur data
- 🔄 U5.6 Empty state dengan arahan dan teks bantuan; QA visual desktop 1280 dan ponsel 390; EN/ID — empty state dan teks bantuan ada; belum diuji visual (tidak ada browser); layar baru memakai teks Inggris (belum diterjemahkan ke ID)

### Tahap 6 - Pengayaan
- 🔄 U6.1 Assignment (unggah berkas atau berbasis soal, tenggat, batas percobaan) dengan penilaian — API, keamanan unggahan, dan penilaian teruji (`umum-tugas.test.ts`); halaman peserta dan admin belum diuji visual
- 🔄 U6.2 Diskusi dan komentar per lesson (moderasi, sanitasi) — API, sanitasi, lingkup institusi, dan moderasi teruji; tampilan belum diuji visual
- ✅ U6.3 Sertifikat penyelesaian course (bukan skala ITP)
- 🔄 U6.4 Template course (pengganti scaffold TOEFL) dan template ITP sebagai preset — API teruji; dialog belum diuji visual
- ✅ U6.5 `accessMode: paid` hanya disiapkan di data (`priceIdr`); pembayaran tidak dibangun

### Tahap 7 - Isolasi paket ITP dan sisa
- ✅ U7.1 Scaffold TOEFL menjadi preset; paket ITP di balik saklar — preset `toefl-itp` di daftar templat; saklar `itpPack` (Settings, bawaan mati) menyembunyikan preset, rute scaffold, dan ruang kerja ITP; course ITP lama tetap terjangkau
- 🔄 U7.2 PPTX dan laporan generik mengikuti bagian tes — PPTX teruji (`umum-laporan`); ekspor Excel diperbaiki setelah tinjauan (Level kosong dan data bar 0-100 untuk skala persen) tetapi belum punya tes otomatis
- ✅ U7.3 `access: paid` bawaan materi ditinjau (bawaan tidak membingungkan kelas biasa)
- 🔄 U7.4 Sisa dwibahasa EN/ID dan `i18n.test.ts` hijau — layar peserta baru (kartu dan rincian course, diskusi, tugas, sertifikat course) diterjemahkan dan tes hijau; layar admin baru masih berbahasa Inggris
- ✅ U7.5 `scripts/smoke.mjs` diperbarui untuk jenis soal baru dan skor persen — bagian baru `ONLY=umum` (23 pemeriksaan) hijau pada server dev dengan DB in-memory; bagian lama (placement, coaching ITP) sudah usang sejak ITP dibuang dan gagal di bagian placement (bukan akibat program ini)
- 🔄 U7.6 Statistik butir soal (kesulitan nyata, daya beda, jumlah pemakaian) — perhitungan, API, dan tes hijau; halaman belum diuji visual

### Tahap 8 - Perapihan bank soal dan sisa ITP
- ✅ B1 Halaman Questions ruang kerja Umum: dropdown Mata pelajaran lalu Bank soal, tanpa "Semua", pilihan terakhir diingat per pengguna; ruang kerja ITP tetap tab bagian — `umum-bank` (server); tampilan menunggu QA visual
- ✅ B2 Satu istilah (Mata pelajaran, Bank soal) di ruang kerja Umum; section diturunkan otomatis dari bank (`lib/question-bank.ts`) — `umum-bank`, `import-umum`
- ✅ B3 Soal non-ITP wajib punya bank (create, PATCH, impor); "Belum dikelompokkan" dan pindah massal hanya untuk soal yang boleh diubah — `umum-bank` (IDOR)
- ✅ B4 Bank bawaan per course; tes umum memilih bank, soal manual dibatasi ke bank itu dan bank lain hanya eksplisit; nama bagian tes umum bebas — `umum-bank-tes`
- ✅ B5 Impor: bank tujuan wajib di langkah pertama dengan "bank baru" di tempat — `import-umum`
- 🔄 B6 Audit ITP dengan paket mati: Parameter (levels, level_up, booking, quota_rules, class_auto), tab Scoring, Overview (placement, level), Participants (placement, level, skor, kuota), institusi (tahan hasil, modul Coaching), panel peserta, jenis tes baru = umum, menu Analytics, persiapan tes tanpa uji audio bila tanpa Listening. Sisa yang dicatat: lihat CATATAN-IMPLEMENTASI (Tahap 8)
- ✅ B7 Label EN dan ID konsisten ("Mata pelajaran", "Bank soal") — `i18n.test.ts`
- ⬜ B8 QA visual dengan browser sungguhan (lebar 1280 dan 390), menutup item 🔄 G.1, dan tes otomatis ekspor Excel (U7.2)

### Lintas tahap, gerbang, dan dokumen
- 🔄 Q.1 Tes keamanan per fitur (akses/IDOR, XSS, impor XML, unggah, CSRF, rate limit, audit log) tertulis dan hijau — lihat tabel bukti di CATATAN-IMPLEMENTASI; CSRF memakai pemeriksaan Origin global di middleware (tidak ada tes per rute baru)
- ✅ Q.2 `npm audit --omit=dev` tidak menambah temuan high/critical — 12 temuan (baseline 13)
- ✅ Q.3 Tinjauan independen subagent (keamanan dan QA/regresi) di akhir tiap tahap; temuan berat diperbaiki — lihat CATATAN-IMPLEMENTASI
- ✅ D.1 `docs/panduan/PANDUAN-ADMIN.txt` diperbarui (kategori, course umum, koleksi, impor XML, tes umum, video, akses)
- ✅ D.2 `docs/panduan/QA_Panduan_Uji_Umum.md` (format seperti QA_Panduan_Uji_T01.md)
- ✅ D.3 `docs/perencanaan/CATATAN-RILIS-UMUM.md` (perubahan, env baru, langkah server, rollback)
- ✅ D.4 `.gitignore` menutup `Bank_Soal_*.xml` dan `UTS *.docx`
- ❌ G.1 Gerbang akhir (GAGAL: item 🔄 UI belum diuji visual, lihat CATATAN-IMPLEMENTASI): typecheck, lint, test, build produksi, smoke, regresi ITP, audit, panduan lengkap
- ⏭️ G.2 Merge ke `main`, push, tag `umum-v1` (hanya bila G.1 lulus) — tidak dilakukan karena G.1 gagal; `main` tidak disentuh
- ⏭️ V.1 Verifikasi pasca-deploy oleh banyak agent (PROMPT-VERIFIKASI-PASCA-DEPLOY.md) dan laporan konsolidasi — ditunda: butuh redeploy, yang dilarang dijalankan dalam sesi otonom ini
