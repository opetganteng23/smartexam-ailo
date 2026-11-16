# Prompt verifikasi pasca-deploy: multi-agent (untuk Claude Code)

Jalankan ini SETELAH pemilik melakukan redeploy versi `umum-v1`. Tujuan: laporan independen dari banyak agent tentang apakah sistem baru benar, aman, dan tidak merusak alur ITP. Kamu hanya MELAPORKAN; jangan mengubah kode kecuali diminta pemilik sesudah membaca laporan.

## Masukan (isi sebelum dijalankan)

- URL: `https://smartexam.ailo.ai.id` (ganti bila berbeda).
- Akun uji: akun QA tester dan akun peserta uji milik pemilik, diberikan di luar repo. Jangan menulis kata sandi ke berkas atau log.
- Bila URL atau akun tidak tersedia: jalankan pada build produksi lokal (`cd app && npm run build && npm start` dengan `mongodb-memory-server`, seed `npm run seed:demo`) dan nyatakan di laporan bahwa itu bukan produksi.

## Aturan keras

1. Produksi: baca dulu. Penulisan hanya untuk data uji berawalan `QA-` oleh akun QA tester, dan data itu diarsipkan atau dihapus lewat fitur aplikasi setelah selesai. Jangan menyentuh data peserta nyata. Jangan menjalankan skrip destruktif. Tanpa uji beban berat: maksimal 20 permintaan serentak untuk uji ketahanan ringan.
2. Jangan mencetak token, cookie, atau kata sandi. Jangan menyimpan data pribadi di laporan.
3. Setiap temuan wajib punya bukti (langkah reproduksi, respons, atau cuplikan) dan tingkat keparahan: Kritis, Tinggi, Sedang, Rendah. Bila tidak bisa diuji, tulis "Tidak bisa diuji" beserta alasannya; jangan menebak lulus.

## Agent (jalankan paralel, masing-masing sebagai subagent terpisah)

1. Regresi ITP: masuk, daftar tes, mulai dan selesaikan tes uji, hasil ditahan, jadwal sesi, secure mode, sertifikat. Pastikan tidak ada yang berubah dibanding perilaku lama.
2. Course dan akses: course umum terlihat oleh institusi dan kelas yang benar saja; peserta tanpa placement melihat course umum; ID course, unit, materi, kuis, dan video milik institusi lain ditolak (uji IDOR); prasyarat dan drip tetap berlaku.
3. Bank soal dan impor: impor fixture XML, CSV, Excel, DOCX; duplikat dilewati; berkas rusak, XML dengan DOCTYPE atau entity, berkas terlalu besar ditolak dengan pesan baik; payload XSS pada teks soal tidak mengeksekusi; koleksi dan visibilitas dihormati.
4. Tes umum: kuis harian, pre-test, post-test, UTS: jendela waktu WIB, soal acak dan tidak bocor, penilaian persen, finalisasi tidak dobel saat klik ganda, laporan selisih pre/post.
5. Video dan media: embed, unggah klip kecil, Range request, akses tanpa izin ditolak, tipe berkas palsu ditolak, materi HTML dengan video, dan batas ukuran sesuai konfigurasi server.
6. Keamanan: header (CSP, X-Frame-Options, nosniff, HSTS), atribut cookie, CSRF/Origin pada mutasi, rate limit login dan impor, enumerasi akun, kebocoran kunci jawaban, pesan error, dependensi (`npm audit --omit=dev` pada commit yang berjalan).
7. UI dan UX: layar utama pada lebar 1280 dan 390, error konsol, teks EN dan ID, empty state, aksesibilitas dasar (fokus, label, kontras), alur membuat course Struktur Data dari nol tanpa istilah TOEFL.
8. Performa dan ketahanan: waktu respons daftar course dan bank soal, ukuran halaman, tanda N+1, perilaku saat koneksi putus di tengah tes, uji beban ringan.
9. Dokumen: cocokkan `PANDUAN-ADMIN.txt`, `QA_Panduan_Uji_Umum.md`, dan `CATATAN-RILIS-UMUM.md` dengan perilaku nyata; daftar langkah yang salah atau hilang.

## Keluaran

Tulis `docs/laporan/VERIFIKASI-UMUM-<tanggal>.md` (folder ini di-gitignore, jadi tidak ter-commit). Isi: ringkasan eksekutif dan keputusan Go/No-go; tabel temuan (ID, agent, keparahan, bukti, rekomendasi); status tiap item TODO yang bisa diverifikasi dari luar; daftar "Tidak bisa diuji" dengan alasan; rekomendasi perbaikan berurutan. Di chat, berikan ringkasan maksimal 25 baris dan lokasi berkas laporan.
