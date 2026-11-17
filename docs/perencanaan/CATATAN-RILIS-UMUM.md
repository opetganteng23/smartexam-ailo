# Catatan Rilis: Smartexam Umum (`umum-v1`)

Cabang: `feat/umum` · Skema database: **aditif** (tidak ada migrasi destruktif) · Alur ITP/AirNav: tidak diubah.

## 1. Ringkasan perubahan

| Tahap | Isi |
|---|---|
| 1 | Kategori, course umum (`track`), akses per institusi dan kelas, katalog |
| 2 | Bank soal umum: koleksi, impor Moodle XML dan Word, empat jenis soal, soal HTML |
| 3 | Tes umum: skala persen, kuis harian (jendela WIB), penarikan acak, pre/post-test |
| 4 | Video (MP4 GridFS dengan Range, sematan), token putar 1 jam |
| 5 | Katalog dan halaman course peserta, editor course bertab, ruang kerja admin |
| 6 | Sertifikat penyelesaian course, diskusi per unit, tugas, templat course |
| 7 | Saklar `itpPack`, akses materi bawaan "free", terjemahan ID, smoke umum, statistik butir |
| 8 | Mata pelajaran dan Bank soal (bank wajib, section otomatis, pindah massal, bank bawaan course, bank pada tes), sisa ITP disembunyikan saat paket mati, ekspor Excel tes umum tanpa level ITP |

## 2. Variabel `.env` baru

| Variabel | Fungsi | Wajib |
|---|---|---|
| `VIDEO_MAX_BYTES` | Hanya untuk **menurunkan** batas unggah video (maksimum tetap 100 MB) | Tidak |

Tidak ada rahasia baru. Dependensi baru: `fast-xml-parser` 5.12.1 (impor Moodle XML). `npm audit --omit=dev`: 12 temuan, tidak memburuk dari baseline 13.

## 3. Langkah manual di server (belum dilakukan oleh kode)

1. **Caddy** (`/home/ailolabs/ailabs-deploy/Caddyfile`): samakan dengan `deploy/Caddyfile.smartexam`: `max_size 110MB` dan timeout permintaan 10 menit untuk rute unggah. Reload Caddy. (Contoh nginx: `deploy/nginx.smartexam.conf`.)
2. **Backup**: pakai `deploy/backup-smartexam.sh`. Dump harian mengecualikan koleksi `video.files` dan `video.chunks` (besar). Cadangkan video terpisah bila perlu.
3. **Saklar**: Settings > "TOEFL ITP package" bawaan MATI. Nyalakan hanya bila paket ITP dipakai di lingkungan itu.
4. Redeploy: `bash /var/www/smartexam/app/deploy/redeploy-smartexam.sh` (atau `pm2 reload smartexam`). Belum dijalankan.
5. Setelah deploy, ikuti `docs/perencanaan/PROMPT-VERIFIKASI-PASCA-DEPLOY.md` dan `docs/panduan/QA_Panduan_Uji_Umum.md`.

## 4. Rollback

- Kode: `git revert` rentang komit `umum-v1`, atau deploy ulang komit sebelum merge.
- Data: skema aditif, jadi data lama tetap terbaca. Course umum, koleksi, video, tugas, komentar, dan sertifikat course yang sudah dibuat tetap ada di database namun tidak terlihat bila kode dikembalikan.
- Konfigurasi Caddy yang dilonggarkan aman dibiarkan.

## 4b. Perubahan perilaku Tahap 8 (perlu diketahui sebelum deploy)
- Membuat atau mengubah soal di ruang kerja Umum **wajib** memilih bank (API menolak 400 tanpa bank). Soal bagian ITP (listening, structure, reading) tetap boleh tanpa bank. Skrip atau integrasi yang membuat soal lewat API tanpa `collectionId` harus disesuaikan.
- Soal lama tanpa bank tidak diubah; muncul di "Belum dikelompokkan" untuk dipindah massal. Mengubah soal itu (termasuk Approve/Publish) meminta bank dulu.
- Skema aditif: `Course.bankId`, `Test.bankId`, `Test.extraBankIds`. Course umum lama mendapat bank bawaan saat dipilih di pembuat tes (rute `POST /api/admin/courses/[id]/bank`).
- Tes umum dengan bank dipilih: nama bagian bebas (soal dibatasi lewat bank). Tes umum tanpa bank, dan tes ITP, tetap mencocokkan nama bagian dengan section soal.
- Sheet "By level" tidak ada di ekspor Excel tes berskala persen.
- Tanpa saklar paket ITP, menu Analytics dan tab Scoring disembunyikan (rute tetap ada).

## 5. Keterbatasan yang diketahui

- Tampilan UI belum diuji visual di browser; ditandai 🔄 di TODO. Wajib lewat panduan QA.
- YouTube di dalam iframe materi HTML tidak didukung (CSP tidak dilonggarkan).
- Pembayaran online belum ada; mode akses "paid" hanya data.
- Layar admin baru sebagian besar masih berbahasa Inggris (label Mata pelajaran/Bank soal sudah dua bahasa).
- QA visual (lebar 1280 dan 390) belum dilakukan: tidak ada browser di sesi otonom. Daftar uji manual ada di `docs/laporan/QA-VISUAL-MANUAL.md` (folder ini diabaikan git) dan bagian H serta J di `QA_Panduan_Uji_Umum.md`.
- Rute aset gambar belum sadar-course; pencarian akses video memakai `$regex`; belum ada indeks `contentHash` dan indeks unik percobaan `in_progress`.
- Smoke penuh lama gagal di bagian placement karena data ITP tidak ada di lingkungan uji; `ONLY=umum` hijau.
