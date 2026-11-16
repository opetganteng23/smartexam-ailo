# Prompt implementasi: Smartexam Umum (untuk Claude Code)

Kamu mengerjakan repo ini sendirian karena pemilik sedang pergi dan tidak bisa ditanya. Bekerjalah sampai SEMUA tahap selesai. Ikuti `CLAUDE.md` di root repo (pikir sebelum kode, sederhana, perubahan bedah, tujuan yang bisa diverifikasi).

## Sumber kebenaran

1. `docs/perencanaan/RENCANA-SMARTEXAM-UMUM.md`: keputusan K1-K6 dan tahap 1-7.
2. `TODO.md`, bagian "Program Smartexam Umum": daftar tugas. Ubah ⬜ menjadi ✅ hanya setelah tes yang membuktikannya hijau; 🔄 untuk sebagian; ⏭️ hanya dengan alasan tertulis.
3. Kodenya sendiri. Bila rencana bertentangan dengan kode, kode yang benar: catat selisihnya di `docs/perencanaan/CATATAN-IMPLEMENTASI.md`.

Sebelum tahap 2 dan 3, baca dulu yang sudah ada supaya tidak menduplikasi: `app/scripts/add-uts-pilgan.ts` (parser Moodle XML lama), `app/scripts/seed-uts-struktur-data.ts`, `app/tests/general-exam.test.ts`, `app/tests/generic-sections.test.ts`, `app/lib/import-questions.ts`, `app/lib/question-kinds.ts`, `app/lib/sanitize.ts`, `app/components/RichViewer.tsx`, `app/lib/course-access.ts`, `app/models/Course.ts`, `app/models/Test.ts`, `app/models/Question.ts`, `app/models/Cluster.ts`, `app/lib/attempts.ts`.

## Aturan keras

1. Cabang: buat `feat/umum` dari `main`. Jangan push ke `main` sebelum Gerbang Akhir lulus. Commit kecil per tugas dengan pesan seperti riwayat repo (Bahasa Indonesia, mis. "Tahap 1.2: Course track umum dan level opsional"). Push `feat/umum` setiap akhir tahap.
2. Aditif dan kompatibel mundur. Tidak ada field wajib baru; semua field baru punya default; kode membaca `track ?? "itp"`. Skrip deploy (`app/deploy/redeploy-smartexam.sh`) TIDAK menjalankan migrasi, jadi aplikasi tidak boleh bergantung pada migrasi. Bila perlu skrip data, buat idempoten, ada `--dry`, dan opsional.
3. Alur ITP dan AirNav (placement, simulasi, final, hasil ditahan, sertifikat, secure mode, jadwal sesi) tidak boleh berubah perilakunya. Setiap tahap harus lulus tes regresi untuk itu.
4. Jangan menjalankan skrip destruktif (`reset-all`, `reset-participants`, `align-*`, `migrate-en`). Jangan menyentuh database atau server nyata. Dev dan tes memakai `mongodb-memory-server`.
5. Rahasia dan data: jangan membaca, mencetak, atau meng-commit `.env*`. Jangan pakai `git add -A` atau `git add .`; tambahkan berkas satu per satu. Jangan commit `Bank_Soal_*.xml`, `UTS *.docx`, `*.xlsx`, `*.har`, `data/`, `docs/laporan/`. Tambahkan `Bank_Soal_*.xml` dan `UTS *.docx` ke `.gitignore` (tugas D.4).
6. Dependensi baru hanya `fast-xml-parser` (pin versi persis). Tambahan lain butuh alasan tertulis di CATATAN-IMPLEMENTASI.md.
7. Bila ragu atau terhalang: pilih opsi paling aman dan reversibel, catat di bagian "Keputusan otonom" CATATAN-IMPLEMENTASI.md beserta alasannya, lalu lanjut. Jangan berhenti menunggu jawaban dan jangan diam-diam melewati item.

## Urutan dan definisi selesai

Kerjakan tahap 1 sampai 7 berurutan. Satu tahap harus hijau (tes, typecheck, lint, build), ter-commit, dan terdorong ke `feat/umum` sebelum tahap berikutnya. Jangan berhenti setelah tahap 1. Semua tahap wajib dikerjakan, termasuk tahap 6 (assignment, diskusi, sertifikat course, template) dan tahap 7. Jalur `paid` (K6) hanya disiapkan di data.

Gunakan daftar tugas (TaskCreate/TaskUpdate) yang mencerminkan TODO.md. Bila konteks hampir penuh, simpan progres di TODO.md dan CATATAN-IMPLEMENTASI.md lalu lanjutkan.

## Siklus per tugas

1. Baca kode terkait dan sebut asumsi di CATATAN-IMPLEMENTASI.md bila ada.
2. Tulis tes yang gagal dulu (akses, bug, XSS, impor), lalu implementasi minimal.
3. Jalankan `cd app && npm run typecheck && npm test`, lalu `npm run lint`.
4. Commit kecil. Perbarui TODO.md.

## Checklist keamanan (wajib, setiap fitur punya tesnya)

- Otorisasi: `requireRole` di setiap route baru; filter institusi dan kelas di level query, bukan hanya UI. Uji peserta A versus peserta B (institusi atau kelas berbeda) pada setiap endpoint baru: course, unit, materi, kuis, tes, soal, koleksi, video, assignment, diskusi, sertifikat. Tidak ada IDOR dengan menebak ID.
- Kunci jawaban dan soal tidak bocor ke klien (ikuti pola `tests/result-no-leak.test.ts`) untuk jenis soal, koleksi, dan soal acak yang baru. Peserta tidak melihat soal sebelum memulai.
- XSS: semua HTML (teks soal, opsi, penjelasan, materi, deskripsi course, diskusi) disanitasi di server dan di klien. Tes payload: `<script>`, `onerror=`, `javascript:`, `<svg onload>`, `<iframe>` selain yang diizinkan, `<style>`, URI `data:`.
- Impor XML: batas ukuran (10 MB) dan jumlah soal (500); tolak DOCTYPE dan entity (XXE, billion laughs); gambar base64 dibatasi ukuran dan dicek tipe (jpeg/png/webp/gif); tidak mengeksekusi apa pun; laporan baris gagal tanpa stack trace.
- Unggah video: cek magic byte MP4, maksimal 100 MB, bukan SVG atau tipe lain; stream (tidak memuat seluruh berkas ke memori); Range request benar; `X-Content-Type-Options: nosniff`; otorisasi sama dengan course; rate limit.
- CSRF: semua POST/PATCH/DELETE baru memakai pengecekan Origin yang sudah ada.
- Validasi zod ketat (panjang, enum, ObjectId); tidak meneruskan objek mentah ke query (pakai pola `mongo-sanitize`).
- Audit log untuk impor, hapus massal, ubah visibilitas koleksi atau akses course, dan unggah video.
- Pesan error tidak membocorkan detail internal. Tidak mencatat data pribadi peserta di log.
- CSP: jangan dilonggarkan, kecuali `frame-src` untuk `youtube-nocookie.com` pada materi HTML dan hanya bila terbukti jalan dan aman di iframe tersandbox (bila tidak, jangan dilakukan dan catat).
- `npm audit --omit=dev` tidak boleh menambah temuan high atau critical dibanding sebelum mulai.

## Anti-bug

Kasus tepi yang harus dites: kategori atau koleksi kosong, soal tanpa kunci, duplikat, berkas kosong atau rusak, XML tidak valid, encoding UTF-8 dengan BOM, `single=false`, jumlah soal acak (N) lebih besar dari isi koleksi, kelas tanpa level, institusi tanpa modul Learning, peserta tanpa kelas atau pindah kelas, course arsip atau preview, drip dan prasyarat tetap berlaku, zona waktu WIB pada jendela kuis harian, klik ganda dan balapan (impor dan finalisasi harus idempoten), refresh di tengah tes, daftar besar (10.000 soal) tetap cepat dengan indeks dan paginasi, tidak ada N+1 pada daftar course. Setiap bug yang ditemukan mendapat tes regresi lebih dulu.

## QA dan QC

- Tes: semua tes lama tetap hijau, ditambah tes baru per tugas. Perbarui `scripts/smoke.mjs` untuk jenis soal baru dan skor persen, lalu jalankan terhadap server dev dengan DB in-memory.
- Statis: `npm run typecheck`, `npm run lint`, dan `npm run build` sukses; tidak ada `console.log` sisa; tidak ada `any` baru tanpa alasan; `tests/i18n.test.ts` hijau (setiap `t("...")` punya terjemahan EN dan ID).
- Visual: jalankan server dev dan periksa layar baru dengan browser bila alat tersedia, pada lebar 1280 dan 390, tanpa error konsol. Bila tidak ada browser, tulis "belum diuji visual" di laporan; jangan menandai ✅ untuk item visual.
- Fixture impor: buat berkas sintetis kecil di `app/tests/fixtures` (±10 soal, lima jenis, ada blok kode, gambar kecil, dan payload XSS). Jangan pakai berkas soal asli.
- Tinjauan independen: di akhir tiap tahap, jalankan dua subagent yang belum melihat pekerjaanmu: satu peninjau keamanan dan satu peninjau QA/regresi. Perbaiki temuan berat sebelum lanjut; catat sisanya.

## Panduan dan tutorial (agar tidak ada yang terlewat)

- Perbarui `docs/panduan/PANDUAN-ADMIN.txt` dengan bagian baru berbahasa Indonesia: membuat kategori, course umum, koleksi, impor Moodle XML, tes umum (kuis harian, pre/post-test, UTS), video, dan akses institusi/kelas.
- Buat `docs/panduan/QA_Panduan_Uji_Umum.md` meniru format `QA_Panduan_Uji_T01.md` (tabel perubahan, langkah uji, hasil benar, kolom Hasil).
- Di aplikasi: empty state dengan arahan, teks bantuan singkat di form baru, dan tombol unduh templat untuk impor.
- Buat `docs/perencanaan/CATATAN-RILIS-UMUM.md`: apa yang berubah, variabel `.env` baru, langkah manual di server yang tidak bisa dilakukan skrip redeploy (mis. Caddy `request_body max_size` dari 20MB ke 110MB dan timeout di `/home/ailolabs/ailabs-deploy/Caddyfile`, dump harian yang mengecualikan bucket `video`), dan langkah rollback (`git revert` atau deploy ulang commit sebelumnya; perubahan skema bersifat aditif).

## Gerbang Akhir (semua harus lulus sebelum menyentuh main)

1. Setiap item TODO bagian "Program Smartexam Umum" berstatus ✅ atau ⏭️ dengan alasan tertulis.
2. Typecheck, lint, seluruh tes, dan build produksi hijau; smoke e2e hijau.
3. Tes regresi ITP/AirNav hijau.
4. Checklist keamanan di atas terisi di CATATAN-IMPLEMENTASI.md dengan nama tes sebagai bukti; `npm audit` tidak memburuk.
5. Panduan admin, panduan QA, dan catatan rilis selesai.
6. `git status` bersih dari berkas data; tidak ada rahasia di diff (`git diff main...feat/umum` diperiksa).

Bila lulus: rebase `feat/umum` ke `main` terbaru, merge ke `main`, push `main`, beri tag `umum-v1`, dan push tag. Bila ada yang gagal: JANGAN menyentuh `main`; push `feat/umum` saja dan tulis penyebabnya di CATATAN-IMPLEMENTASI.md.

## Keluaran akhir

Ringkasan maksimal 30 baris: status tiap tahap, apa yang ⏭️ beserta alasannya, hasil gerbang, langkah manual server dari catatan rilis, dan perintah redeploy (`bash /var/www/smartexam/app/deploy/redeploy-smartexam.sh`, atau `pm2 reload smartexam` di server ailolabs sesuai konfigurasi yang dipakai). Jangan menjalankan redeploy sendiri.
