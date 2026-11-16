# Panduan Uji QA: Smartexam Umum

Versi dokumen: November 2026 · Cabang `feat/umum` (tag `umum-v1` bila lulus gerbang) · Lokasi: https://smartexam.ailo.ai.id

Tulis hasilnya di kolom **Hasil** (Lulus / Gagal / Tidak bisa diuji). UI belum pernah diuji visual, jadi dokumen ini adalah uji pertama untuk tampilan.

## 1. Aturan wajib

1. Pakai akun **QA tester** dan akun staf uji. Jangan memakai peserta asli.
2. Jangan menambah peserta dengan email asli orang lain (sistem langsung mengirim undangan).
3. Buat institusi, kelas, dan course dengan awalan `[UJI]`. Jangan ubah data lain.
4. Jangan menyalakan Settings > "TOEFL ITP package" kecuali diminta pada uji L.
5. Ragu: berhenti dan tanya.

## 2. Persiapan

| Kebutuhan | Keterangan |
|---|---|
| Akun admin | Untuk membuat kategori, course, soal, tes |
| Akun peserta QA | Ditandai QA, di institusi `[UJI]` |
| Akun peserta biasa kedua | Institusi berbeda, untuk uji akses |
| Berkas uji | Moodle XML kecil, `.docx` templat, MP4 < 5 MB, PDF kecil, MP4 palsu (teks diganti ekstensi `.mp4`) |
| Ponsel | Untuk uji tampilan mobile |

## 3. Daftar uji

### A. Kategori dan course umum

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| A1 | Admin > Categories, buat "Struktur Data" | Tampil di daftar | |
| A2 | Buat kategori dengan nama sama | Ditolak (duplikat) | |
| A3 | New course jenis Umum tanpa level | Tersimpan, ada tab Info/Curriculum/Settings/Access | |
| A4 | Isi Info (apa yang dipelajari, prasyarat, tag) lalu simpan | Tampil di halaman course peserta | |
| A5 | Access: tugaskan ke institusi `[UJI]` | Peserta QA melihat course, peserta institusi lain tidak | |
| A6 | Hapus kelas yang ditugaskan ke course | Course tetap utuh, rujukan kelas hilang | |
| A7 | Hapus kategori yang masih dipakai | Ditolak | |

### B. Bank soal, koleksi, impor

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| B1 | Buat soal tiap jenis: pilihan ganda, menjodohkan, isian, essay | Semua tersimpan, pratinjau benar | |
| B2 | Impor Moodle XML (pratinjau lalu simpan) | Jumlah soal sesuai, duplikat dilewati dan dilaporkan | |
| B3 | Impor XML yang sama lagi | Semua dilaporkan duplikat, tidak ada soal ganda | |
| B4 | Impor XML berisi `<!DOCTYPE ... ENTITY>` | Ditolak dengan pesan jelas | |
| B5 | Impor `.docx` dengan direktif Kind/Points/Pairs/Accepted/Rubric | Soal terbentuk sesuai direktif | |
| B6 | Soal HTML berisi `<script>` | Skrip tidak jalan, teks aman | |
| B7 | Koleksi Private milik admin A, lihat dari admin B | Admin B tidak melihat dan tidak bisa mengubah | |
| B8 | Koleksi Global | Terlihat semua staf, hanya pemilik yang bisa ubah | |

### C. Tes umum

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| C1 | Buat tes jenis Umum (UTS) dengan empat jenis soal, kaitkan ke course | Tersimpan | |
| C2 | Peserta QA mulai tes tanpa pernah placement | Bisa mulai | |
| C3 | Peserta institusi lain mencoba mulai (alamat langsung) | Ditolak | |
| C4 | Jawab semua soal, submit | Hasil ditahan karena essay belum dinilai | |
| C5 | Admin menilai essay di Grading | Skor persen muncul di peserta, benar secara hitungan | |
| C6 | Cek profil peserta | Level dan skor ITP **tidak berubah** | |
| C7 | Kuis harian: set jendela 07.00-10.30 WIB | Di luar jam muncul pesan jam buka, di dalam jam bisa mulai | |
| C8 | Batas percobaan per hari = 1, mulai dua kali | Percobaan kedua ditolak | |
| C9 | Penarikan acak dari koleksi 20 soal, ambil 5 | Dua percobaan berbeda mendapat soal berbeda | |
| C10 | Pre/post: kunci post-test sampai pre-test selesai | Post terkunci lalu terbuka setelah pre selesai | |
| C11 | Refresh di tengah tes | Kembali ke soal yang sama, jawaban utuh | |

### D. Video

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| D1 | Unggah MP4 asli | Berhasil, bisa diputar dan digeser | |
| D2 | Unggah berkas teks ber-ekstensi `.mp4` | Ditolak | |
| D3 | Unggah MP4 di atas batas | Ditolak dengan pesan ukuran | |
| D4 | Sisipkan video di materi, buka sebagai peserta course | Terputar | |
| D5 | Salin alamat video, buka dengan peserta tanpa hak | Ditolak | |
| D6 | Buka alamat video yang sama setelah > 1 jam | Ditolak atau minta muat ulang halaman | |
| D7 | Sematan YouTube/Vimeo | Terputar | |

### E. Tugas, diskusi, sertifikat

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| E1 | Buat tugas berkas dengan tenggat, kirim PDF sebagai peserta | Tampil "Waiting for grading" | |
| E2 | Kirim berkas bukan PDF/gambar/Office/ZIP (ganti ekstensi) | Ditolak | |
| E3 | Kirim setelah tenggat (terlambat tidak boleh) | Ditolak. Bila boleh: ditandai "late" | |
| E4 | Admin menilai dan beri umpan balik | Nilai dan umpan balik tampil di peserta | |
| E5 | Tugas berbasis tes | Nilai tertinggi tes terlihat di kartu tugas | |
| E6 | Diskusi: tulis komentar, balas, laporkan | Komentar tampil, laporan masuk ke Admin > Comments | |
| E7 | Komentar `<b>x</b><script>` | Tampil sebagai teks polos | |
| E8 | Moderator menyembunyikan lalu memulihkan komentar | Status berubah di peserta | |
| E9 | Selesaikan semua unit wajib | Sertifikat penyelesaian terbit sekali, nomor SMX-CRS-... | |
| E10 | Unduh PDF sertifikat | Nama, course, tanggal, nomor benar | |
| E11 | Buka halaman verifikasi publik dengan nomor itu | Valid, nama disamarkan sebagian | |
| E12 | Verifikasi nomor palsu | Tidak ditemukan | |

### F. Templat dan saklar

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| F1 | Buat course dari templat umum | Kerangka modul/unit terbentuk | |
| F2 | Saklar "TOEFL ITP package" mati: buka daftar templat | Preset ITP tidak tampil | |
| F3 | Nyalakan saklar: buka daftar templat | Preset ITP tampil | |
| F4 | Saklar mati: course ITP lama | Tetap tampil dan bisa dibuka | |
| F5 | Ganti ruang kerja Umum/ITP | Menu berubah, akses tidak berubah | |

### G. Statistik butir dan laporan

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| G1 | Tests > (tes) > Items dengan < 5 percobaan | Belum ada p dan penanda | |
| G2 | Dengan data cukup | p, daya beda, sebaran pilihan tampil, tersulit di atas | |
| G3 | Percobaan admin/QA | Tidak ikut dihitung | |
| G4 | Ekspor Excel tes umum | Skor persen, kolom Level kosong (bukan nama level ITP), tanpa istilah TOEFL/ITP | |
| G5 | Ekspor PPTX ringkasan tes umum | Tanpa istilah ITP | |

### H. Tampilan dan perangkat (belum pernah diuji visual)

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| H1 | Katalog course dan halaman course di ponsel | Tidak ada elemen terpotong, target sentuh nyaman | |
| H2 | Editor course (empat tab), editor kurikulum | Semua tombol terjangkau, tanpa galat konsol | |
| H3 | Pemutar video, kartu tugas, diskusi di ponsel | Bisa dipakai tanpa geser horizontal | |
| H4 | Bahasa Indonesia di layar peserta | Teks baru sudah terjemah, tidak ada kunci mentah | |
| H5 | Mode gelap/terang bila ada | Teks terbaca | |

### I. Regresi ITP/AirNav (wajib)

| ID | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|
| I1 | Peserta ITP: placement T01 (hanya akun QA, **jangan aktifkan T01**) | Berjalan seperti sebelumnya | |
| I2 | Hasil ITP, ekspor PDF/Excel | Level ITP dan skor 310-677 tetap tampil | |
| I3 | Jadwal ITP, coaching, sertifikat resmi | Tidak berubah | |

## 4. Pelaporan

Setiap kegagalan: ID uji, langkah, hasil nyata, tangkapan layar, perangkat dan browser, waktu kejadian.
