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

## 5. Keterbatasan yang diketahui

- Tampilan UI belum diuji visual di browser; ditandai 🔄 di TODO. Wajib lewat panduan QA.
- YouTube di dalam iframe materi HTML tidak didukung (CSP tidak dilonggarkan).
- Pembayaran online belum ada; mode akses "paid" hanya data.
- Layar admin baru masih berbahasa Inggris.
- Rute aset gambar belum sadar-course; pencarian akses video memakai `$regex`; belum ada indeks `contentHash` dan indeks unik percobaan `in_progress`.
- Smoke penuh lama gagal di bagian placement karena data ITP tidak ada di lingkungan uji; `ONLY=umum` hijau.
