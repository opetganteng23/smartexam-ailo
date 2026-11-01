# Smartexam by AILO

Platform ujian online dan analitik hasil belajar untuk institusi mitra, untuk **mata pelajaran apa pun**: bank soal, ujian berwaktu di ruang tes yang aman dan diawasi, penilaian per jenis soal, analisis hasil, laporan institusi, dan (opsional) kursus, coaching, serta AI Counselor. Dikembangkan oleh AILO Telkom University. Antarmuka tersedia dalam bahasa Inggris dan Indonesia.

Peserta tidak mendaftar sendiri: akun dibuat lewat undangan atau kode institusi (kontrak, kursi, impor CSV/Excel). Satu proyek Next.js: UI di `app/app/`, API di `app/app/api/`.

- **Jenis soal:** pilihan ganda, mencocokkan, isian singkat, dan essay (dinilai manusia dengan rubrik, draf nilai AI opsional).
- **Skor:** skala persentase dengan batas lulus, atau skala TOEFL ITP (310–677) sebagai format bawaan; dipilih per profil penilaian.
- **Format bawaan:** TOEFL ITP (Listening, Structure, Reading) tersedia sebagai salah satu format. Bagian tes lain didefinisikan bebas lewat bank soal.
- Status dan sisa pekerjaan: [TODO.md](TODO.md). Arsip spesifikasi dan catatan produk lama: [docs/](docs/).
- Desain acuan: `design/referensi/` (hasil ekstraksi terbaca ada di `design/body/`). Logo di `design/brand/`.

## Menjalankan di lokal

```bash
cd app
npm install
cp .env.example .env.local        # isi JWT_SECRET minimal; sisanya opsional untuk dev
npm run dev                       # http://localhost:3000
```

Tanpa konfigurasi tambahan, mode dev memakai:

| Komponen | Perilaku bila kunci kosong |
|---|---|
| MongoDB | `mongodb-memory-server` (data hilang saat server berhenti). Isi `MONGODB_URI` untuk Atlas atau MongoDB di VM |
| Email | Kode OTP dan email dicetak ke konsol server |
| Claude API | Analisis dan Konselor berjalan di "mode dasar" berbasis aturan; draf nilai essay dan generator soal AI tidak tersedia |

Isi data awal: `POST /api/dev/seed` (dev, DB in-memory) atau, untuk DB nyata, `npm run seed` (opsi: `-- --sample` ujian umum contoh, `-- --demo` institusi dan akun contoh, `-- --itp` soal contoh TOEFL ITP). Seed memuat **soal contoh, bukan soal resmi**, termasuk ujian umum "Contoh Ujian Umum (sample)" (Matematika dan Logika, empat jenis soal, skor persen). Ganti lewat menu Bank Soal.

Admin pertama: isi `ADMIN_EMAILS` dengan emailmu, lalu masuk lewat `/sign-in`. Akun lain **harus dibuat/diundang** (Admin → Institusi → Tambah peserta, atau Admin → People). Di dev, email undangan beserta tautannya dicetak ke konsol server. Akun demo setelah seed: `coach@demo.local`, `instadmin@demo.local`, `peserta1..3@demo.local` (institusi DEMO2026).

Catatan dev: bila server dev dimulai ulang dengan database in-memory yang baru, cookie sesi lama di browser tidak lagi cocok dan bisa membuat halaman saling mengalihkan tanpa henti. Hapus cookie situs itu, atau buka lewat host lain (mis. `127.0.0.1` alih-alih `localhost`).

## Pengujian

```bash
cd app
npm run typecheck
npm test                           # uji unit dan alur dengan MongoDB in-memory (vitest)
```

Uji asap end-to-end terhadap server dev: `ADMIN_EMAILS=admin@test.local npm run dev -- -p 3100 > dev.log 2>&1`, lalu `LOG=dev.log node scripts/smoke.mjs`. Skrip ini ditulis untuk alur ITP lama dan belum diperbarui untuk jenis soal dan skor persen.

## Deploy

Target: VPS Linux + PM2 + Nginx (tanpa Docker). Domain dan server belum ditentukan; nilai contoh memakai `smartexam.example.com`, nama PM2 `smartexam`, port `4100`.

```bash
# 1. Sekali saja di server
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 2. Ambil kode dan bangun
sudo git clone <URL-repo> /var/www/smartexam && cd /var/www/smartexam/app
cp .env.example .env.local && nano .env.local     # isi nilai production (lihat daftar di bawah)
npm ci && npm run build

# 3. Jalankan dengan PM2 (satu instance) dan hidupkan saat boot
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup                           # jalankan perintah yang dicetak pm2

# 4. Nginx + HTTPS (ganti domain di berkas dulu)
sudo cp deploy/nginx.smartexam.conf /etc/nginx/sites-available/smartexam
sudo ln -s /etc/nginx/sites-available/smartexam /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d smartexam.example.com
```

Update versi baru: `bash /var/www/smartexam/app/deploy/redeploy-smartexam.sh`. Cek kesehatan: `curl https://smartexam.example.com/api/health` dan `pm2 logs smartexam`.

Hal khusus untuk PM2/Nginx:

- **Satu instance saja.** Rate limit dan penjadwal (`ENABLE_INPROCESS_CRON=true`: antrean email tiap menit, job per jam, job harian) berjalan di dalam proses. Untuk scale-out, matikan `ENABLE_INPROCESS_CRON` dan panggil dari cron sistem: `* * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://smartexam.example.com/api/cron/mail` (juga `/hourly` dan `/daily`).
- **Nginx wajib menimpa `X-Forwarded-For` dengan `$remote_addr`** (sudah di contoh), karena rate limit memakai header itu, dan meneruskan `Host`/`X-Forwarded-Host` karena pengecekan Origin (anti-CSRF) membandingkannya.
- `client_max_body_size 20m` untuk unggahan audio (maks 15 MB). Audio dan gambar tersimpan di MongoDB, jadi tidak ada folder unggahan yang perlu dibackup terpisah.
- **MongoDB:** pakai Atlas, atau pasang MongoDB di VM yang sama (hanya `127.0.0.1`, aktifkan autentikasi). Backup harian ke luar VM.
- Firewall: buka hanya 22, 80, 443. Port 4100 dan 27017 jangan terbuka ke publik. Isi `INTERNAL_URL=http://127.0.0.1:4100` (dipakai middleware).

Daftar penting sebelum rilis:

1. Isi `JWT_SECRET`, `FIELD_ENCRYPTION_KEY` (32 byte base64), `MONGODB_URI`, `APP_URL`. **Di production semuanya wajib; aplikasi menolak jalan tanpa kunci enkripsi.**
2. Isi `ADMIN_EMAILS`, `CRON_SECRET`, `MAIL_*` (Gmail App Password atau SMTP), dan opsional `ANTHROPIC_API_KEY` (draf nilai essay, generator soal, AI Counselor).
3. Isi Pengaturan (Admin → Settings): nama situs, email dan WhatsApp bantuan (tampil di footer dan laporan), kebijakan reschedule, retensi dokumen. Tinjau **profil penilaian** (skala, batas lulus, dan tabel konversi bila memakai skala ITP) dan **Parameter Sistem**.
4. Ganti soal contoh dengan soal Anda, dan rakit ujian lewat Admin → Question Bank / Tests.
5. Tinjau halaman hukum (`/terms`, `/privacy`) bersama konsultan hukum. Isinya draf.
6. Backup MongoDB terjadwal, mis. `mongodump --uri "$MONGODB_URI" --gzip --archive=/var/backups/smartexam/smartexam-$(date +%F).archive.gz` lewat cron harian, atau snapshot Atlas. Halaman Settings membaca berkas `smartexam-*.archive.gz` di folder itu (atur `BACKUP_DIR`).
7. Gmail dibatasi ±500 email/hari. Untuk undangan massal gunakan SMTP transaksional lewat variabel `MAIL_*`.
8. Ilustrasi budaya di landing (wayang, motif daerah) digambar sebagai pola abstrak; tinjau bersama pihak yang paham budayanya sebelum rilis publik.

## Struktur singkat

```
app/
├─ app/(public)  masuk, daftar, persetujuan data, halaman hukum, verifikasi sertifikat
├─ app/(participant)  beranda, tes, hasil, materi, ujian resmi, sertifikat, profil
├─ app/(room)    ruang tes tanpa sidebar
├─ app/(admin)   modul admin (termasuk Grading essay)     app/(inst)  portal institusi     app/(coach)  halaman coach
├─ app/api       route handler (auth, tes, jawaban, AI, penilaian, admin, inst, coach, cron)
├─ lib/          db, auth, rbac, exam-format (format ujian dan nama bagian), question-kinds + grading (jenis soal dan penilaian),
│                scoring (skala), essay-grading + essay-ai, proctor-summary, i18n, config, pdf, crypto, ...
├─ models/       skema Mongoose
├─ components/   shell responsif, editor, input soal, ilustrasi Nusantara, grafik
├─ scripts/      seed, smoke        tests/  uji unit dan alur
data/            data mentah (tidak di-commit)      design/  logo dan referensi desain      docs/  spesifikasi, panduan, laporan, arsip
```

## Keamanan (ringkas)

OTP email (hash, 5 percobaan, rate limit) atau kata sandi, sesi JWT cookie `httpOnly`; RBAC di setiap handler dan filter institusi di level query; pengecekan Origin untuk mutasi API; NIK terenkripsi AES-256-GCM; akses admin ke dokumen, NIK, dan ekspor dicatat di audit log; penilaian essay buta (nama peserta tidak ditampilkan) dan jawaban peserta diperlakukan sebagai data, bukan instruksi, saat dikirim ke AI.
