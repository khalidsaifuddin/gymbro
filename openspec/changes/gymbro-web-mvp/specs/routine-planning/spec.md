# Spec Delta

## ADDED Requirements

### Requirement: Workout entry and local routines

Aplikasi SHALL menawarkan sesi workout kosong, pembuatan routine, dan explore latihan pada beranda. Routine lokal SHALL menyimpan nama, daftar latihan berurutan, dan target set kg/reps yang dapat diedit atau dihapus dengan konfirmasi. Routine tidak diklaim tersinkron ke akun pada rilis ini.

#### Scenario: Create, edit, and delete a routine
- **WHEN** pengguna membuat routine, mengubah nama/latihan/target, memuat ulang halaman, lalu menghapus routine
- **THEN** perubahan tersimpan pada browser sampai dihapus, dan routine yang dihapus tidak muncul kembali

#### Scenario: Start a routine
- **WHEN** pengguna memulai routine yang tersimpan
- **THEN** sesi baru berisi salinan daftar latihan dan targetnya; perubahan routine berikutnya tidak mengubah sesi tersebut, dan target saja tidak dihitung sebagai set selesai

#### Scenario: Start empty and add an exercise
- **WHEN** pengguna membuka sesi kosong lalu memilih latihan dari pemilih
- **THEN** sesi menampilkan kartu latihan tanpa menambah set/reps terhitung

### Requirement: Exercise exploration

Aplikasi SHALL menyediakan pencarian dan filter katalog sembilan latihan kamera Gymbro serta seluruh 1.324 latihan teks dari dataset berlisensi MIT. Detail SHALL menampilkan alat, area otot, konvensi beban, dan instruksi; demonstrasi SVG lokal tersedia untuk sembilan latihan Gymbro. Metadata dataset dapat dipilih untuk routine dan set manual. Media pihak ketiga yang memerlukan lisensi terpisah SHALL tidak disertakan.

#### Scenario: Explore a supported exercise
- **WHEN** pengguna mencari atau memfilter latihan lalu membuka detailnya
- **THEN** latihan yang cocok dan panduan gerakannya terlihat tanpa membuat sesi atau set baru

#### Scenario: Plan and log a dataset-only exercise
- **WHEN** pengguna memilih latihan dataset yang tidak memiliki detektor kamera
- **THEN** latihan dapat disimpan dalam routine, dimulai dalam sesi, dan dicatat manual, sementara tombol kamera tidak ditampilkan; riwayat akun tetap dapat menerima ID katalog tersebut

### Requirement: Exercise camera view

Setiap kartu latihan yang memiliki detektor SHALL memiliki aksi kamera yang membuka view satu viewport. Preview, skeleton/framing, set/reps, status dan kontrol deteksi SHALL terlihat bersama tanpa scroll; kembali ke sesi SHALL menghentikan deteksi dan mempertahankan hasil terverifikasi.

#### Scenario: Camera from exercise card
- **WHEN** pengguna membuka kamera dari kartu latihan dan mendeteksi rep
- **THEN** profil kartu digunakan, hitungan tampil dalam view kamera, dan kembali ke sesi menampilkan set/reps yang sama

#### Scenario: Camera unavailable or paused
- **WHEN** izin kamera ditolak, tracking hilang, atau pengguna menjeda/menutup kamera
- **THEN** panduan serta pencatatan manual tetap tersedia, dan tidak ada rep baru dari frame yang tidak diproses

### Requirement: Scrollable and viewport-safe pages

Halaman browser selain kamera SHALL dapat discroll secara vertikal pada ponsel dan desktop tanpa overflow horizontal pada viewport ponsel 320–430 px. Statistik, kartu latihan, dan kontrol utama SHALL tetap berada di dalam lebar viewport. Tabel set dapat memiliki scroll horizontal di dalam kontainernya. View kamera SHALL tetap mengisi satu viewport. Tema web SHALL memakai preset cyan SAKA.

#### Scenario: Reach actions below the fold
- **WHEN** konten workout, routine, atau Explore melebihi tinggi viewport
- **THEN** pengguna dapat menggeser halaman ke bawah dan mengakses aksi terakhir; menutup kamera memulihkan scroll halaman

#### Scenario: Keep an active workout inside a phone viewport
- **WHEN** pengguna membuka sesi workout aktif dengan latihan pada viewport 320–430 px
- **THEN** statistik dan kartu latihan tidak memperlebar halaman; hanya tabel set yang dapat digeser horizontal secara internal
