# Rencana implementasi: alur workout, routine, explore, dan kamera satu layar

Tanggal: 9 Oktober 2026. Branch `feat/workout-routines-ui`, berbasis branch overlay kamera `feat/camera-framing-overlay` yang belum digabung ke `main`.

Revisi setelah uji kamera langsung tersedia di `implementation-live-feedback.md`; pilihan sudut per latihan, katalog lengkap, scrolling, dan tema cyan di sana menggantikan keputusan awal yang bertentangan dalam rencana ini.

## Cakupan dan keputusan

Ubah halaman pertama menjadi beranda workout dengan aksi **Start Empty Workout**, **New Routine**, dan **Explore**. Routine adalah daftar latihan berurutan dengan target set berupa kg/reps yang dapat diedit, disimpan, diedit lagi, dihapus dengan konfirmasi, dan dimulai sebagai sesi workout baru. Routine disimpan di browser untuk rilis ini, tanpa API atau sinkronisasi akun. Saat routine dimulai, rencananya disalin ke sesi agar perubahan routine berikutnya tidak mengubah sesi aktif. Sesi kosong dimulai tanpa latihan dan membuka pemilih latihan. Data sesi yang belum selesai tetap memakai recovery IndexedDB yang ada.

Halaman Explore menyediakan pencarian, filter alat/area otot, detail latihan dan animasi/diagram lokal sembilan latihan yang didukung. Referensi IMG_6911–IMG_6916 dipakai untuk hierarki layar: beranda dengan kartu routine, empty session, exercise picker, kartu latihan dengan set/prior/target rest, dan ringkasan di bagian atas. Visual memakai kit CSS SAKA yang diberikan pengguna di `/Users/khalid/Downloads/SAKA`: canvas gelap, satu aksen, tipografi mono, kartu outline, tombol filled, form/tabel semantik. Salin CSS sumber ke frontend dengan catatan asal dan tambah aturan Gymbro seperlunya. Jangan ambil brand/aset Hevy atau bergantung pada font remote agar offline tetap bekerja. Tidak perlu menambah Tamagui; adapter native dapat memakai token setara saat tahap native dikerjakan.

Setiap kartu latihan pada sesi memiliki tombol kamera. Tombol membuka tampilan kamera `fixed` yang memenuhi viewport (`100dvh`) dengan preview, skeleton/framing, nama latihan, set/reps besar, status deteksi, timer, pause/resume, akhir set, dan tombol kembali. View kamera tidak memerlukan scroll untuk melihat preview dan hitungan. Membuka kamera dari kartu memilih profil latihan tersebut. Kembali dari kamera menghentikan deteksi dan rekaman aktif tetapi mempertahankan set/reps terverifikasi di sesi yang sama; manual logging dan koreksi tetap tersedia. Pilihan sudut fisik tetap dikunci saat sesi dimulai. Fitur kamera/recognizer, privacy, dan video opt-in yang ada dipertahankan.

## Komponen/data terdampak

- `frontend/src/storage/routine-store.ts`, hook routine, dan tes: CRUD IndexedDB tersendiri dengan validasi record, nama, daftar latihan, dan target set; tidak mengubah schema workout/akun.
- `frontend/src/domain/session-plan.ts` dan `WorkoutPreferences`: validasi/copy daftar latihan dan target sesi untuk save/recovery lama. Set hasil workout tetap satu `WorkoutSession`; planned rows tidak menjadi set terhitung sampai selesai.
- `frontend/src/components/CameraPrototype.web.tsx` serta komponen baru untuk home, routine editor, explore/picker, session cards, dan camera view. Kartu rencana menampilkan latihan yang belum punya hasil, prior results, input kg/reps, dan add set; `WorkoutLog.web.tsx` tetap menyediakan koreksi/merge hasil.
- `frontend/App.web.tsx`, CSS SAKA dan aturan khusus Gymbro; `App.tsx` native tetap terpisah, sedangkan adapter kamera tetap khusus web. Tidak ada dependency UI baru.
- Browser tests alur dan regresi kamera, persistence, history/sync; docs kebutuhan produk dan spec/task OpenSpec terkait.

## Skenario penerimaan

1. Browser baru menunjukkan beranda dan pilihan sesi kosong/routine/explore. Sesi kosong menunjukkan keadaan tanpa latihan; pengguna dapat menambah latihan dari pemilih. Hasil dan durasi mulai dari nol; planned sets tidak menaikkan summary.
2. Pengguna membuat routine bernama dengan latihan berurutan dan target kg/reps, reload, mengedit nama/latihan/target, lalu menghapusnya setelah konfirmasi. Data yang invalid/duplikat ditolak dengan pesan yang dapat ditindaklanjuti. Akun login tidak mengklaim sinkronisasi routine.
3. Mulai routine membuka sesi baru dengan kartu sesuai urutan dan target. Pengguna dapat mengubah target di sesi; routine sumber tetap sama. Reload/pemulihan sesi menjaga daftar dan target. Set selesai/camera reps menggunakan aggregate yang sama dan prior result diambil dari riwayat workout.
4. Explore menampilkan sembilan latihan dengan pencarian/filter yang bekerja, informasi alat/area otot, label beban, serta aset demonstrasi lokal. Memilih latihan dari picker menambahkannya ke routine atau sesi tanpa menambah set selesai.
5. Tombol kamera pada kartu membuka layar tanpa scroll pada viewport ponsel, memilih profil kartu, dan menampilkan preview, skeleton, framing, reps/set dan status deteksi bersamaan. Pause, tracking loss, izin ditolak, close/reopen, pencatatan manual, rekaman opt-in, dan finish tidak menghilangkan rep terverifikasi atau mengirim pose/video ke backend.
6. Sesi selesai, history, recovery, koreksi/merge, sinkronisasi workout akun, dan panduan posisi kamera tetap dapat diakses. Layout adaptif pada 390 px dan desktop, kontrol sentuh serta label aksesibilitas jelas.

## Urutan kerja dan validasi

1. RED: tes perilaku routine CRUD/reload dan copy rencana sesi, lalu browser tests home → empty/add exercise, routine CRUD/start/recovery, explore, dan camera view. Jalankan terarah; catat kegagalan sebelum implementasi.
2. GREEN: implementasikan storage/model, alur navigasi, kartu sesi, picker/explore, dan kamera viewport penuh. Pertahankan adapter deteksi/recording, persisten workout, dan API yang ada.
3. REFACTOR: ekstrak komponen, token, dan pemetaan metadata latihan; periksa status kosong/error, ukuran ponsel, aksesibilitas, serta data legacy.
4. Jalankan unit frontend, typecheck, build web, browser tests fitur dan regresi kamera/log/recording/offline/akun yang tersedia. Catat jumlah hasil yang benar-benar dieksekusi. Browser fixture pose tidak membuktikan akurasi deteksi; kamera ponsel nyata tetap perlu HTTPS tepercaya dan pengujian perangkat.

Perintah utama dari root: `volta run --node 24.21.0 --bundled-npm npm --prefix frontend test`, `run typecheck`, `run build:web`, dan `run test:e2e`. Tidak ada instalasi dependency untuk CSS SAKA; lockfile tetap.
