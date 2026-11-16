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
