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
