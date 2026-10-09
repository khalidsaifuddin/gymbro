# Validasi tahap 8: empat latihan cable bilateral

Tanggal: 9 Oktober 2026, Asia/Jakarta. Branch `feat/cable-pull-exercises`, baseline fitur kamera `8c6483b`. PR kamera #1 masih terbuka saat validasi; PR batch ini memakai base `feat/fixed-camera-views`. Plan tertulis mendahului kode di `implementation-stage-8.md`; OpenSpec change `cable-pull-exercises`.

## Perilaku yang tersedia

Katalog frontend/API menjadi sembilan gerakan. Varian tambahan: lat pulldown bilateral ke depan dada, seated cable row, rope face pull, dan straight-arm cable pulldown. Kedua tangan bergerak bersama dalam satu siklus lengkap untuk satu rep. Beban memakai angka kg satu weight stack dengan implement count 1, sehingga 40 kg × 10 reps = 400 kg. Behind-the-neck, single-arm dan chest-supported machine row berada di luar batch ini. Alat/attachment/berat tidak dapat dipastikan dari pose tubuh.

Katalog domain menyatukan ID, label, equipment, implement count dan input beban. UUID lima gerakan lama dipertahankan; snapshot version 1 dan preferences lama tetap terbaca. Binding lama dilengkapi occurrence IDs baru di transaksi outbox saat diperlukan. Envelope sending dan retry tidak berubah; acknowledgement membentuk mutasi berikutnya untuk edit yang lebih baru. Server exercise yang tidak dikenal ditolak sebelum replacement lokal.

Adapter cable memakai geometri tubuh 2D: arah tangan terhadap torso/kepala, sudut siku/bahu serta posisi duduk/berdiri. Kedua sisi diperlukan untuk keempat gerakan, termasuk pada pilihan sudut samping/diagonal. Face pull membutuhkan kepala terlihat; straight-arm pulldown menolak siku terlalu menekuk. Visibility, bilateral alignment, smoothing/debounce dan kontinuitas frame menjaga siklus lengkap; interruption membuang siklus parsial tanpa menghapus rep terverifikasi. Classifier menggunakan pola temporal, tetap unknown ketika ambigu. Profil pilihan pengguna disimpan sebagai label profile, bukan raw automatic label.

Migration 004 hanya menambah empat master dan metadata SVG pada `ref`; checksum migrations 001–003 serta struktur `public`/`log` tetap. Upgrade dari DB yang berisi workout/exercise/set/auth session dibandingkan sebelum dan sesudah Up dua kali, termasuk revisi dan ledger. Fresh rollback/reinstall diuji pada DB disposable; rollback master cable yang masih dirujuk workout ditolak secara atomic oleh FK.

Empat animasi serta empat diagram pose original memiliki generator, manifest dan atribusi CC-BY-4.0. Sepuluh SVG lama tetap byte-identical. Source metadata migration merujuk commit aset immutable `cb3e261e29c29ba3ff2ac428b617ed39a8d649c5`. Review visual memperbaiki pose tangan terulur dan rope attachment face pull sebelum source commit final. Illustrasi adalah panduan, bukan training data atau bukti akurasi.

## Bukti RED → GREEN → REFACTOR

- Katalog/sync: tes awal menghasilkan 6 gagal dan 8 lulus; katalog masih lima, snapshot/preferences menolak cable, dan binding lama tidak menyediakan ID baru. Registry dan lazy occurrence binding membuat suite lulus; immutable sending envelope dan atomic catalogue mismatch tetap diuji.
- Pose cable: tes awal menghasilkan 12 gagal dan 10 lulus karena belum ada fase/klasifikasi cable atau guard posture/head yang diperlukan. Adapter baru meluluskan siklus empat gerakan serta negatives bilateral/visibility/pose.
- Tes pembeda pulldown dengan shoulder press menambahkan guard tinggi tangan pada press. Fixture press sebelumnya memakai lengan curl sehingga tangan berada di bawah bahu. Koordinat fixture diperbaiki menjadi tangan dekat/di atas bahu lalu overhead, sesuai SVG press yang sudah ada. Assertion counting dan regresi lima gerakan dipertahankan. Ini koreksi fixture dan threshold prototipe, bukan bukti peningkatan akurasi nyata.
- PostgreSQL: sebelum migration 004, fresh/upgrade catalogue masih lima, empat FK exercise baru belum tersedia dan API belum berisi sembilan. Setelah migration additive, seluruh suite lulus termasuk persistence empat cable dan volume satu stack.
- Browser: skenario manual empat cable gagal terhadap build sebelumnya karena pilihan baru belum ada. Setelah build baru, profile replay/automatic replay, panduan/aset, summary/koreksi/history dan akun lintas browser lulus. Tambahan regresi menguji jitter, body translation, initial peak, frame gap, pause, serta face occlusion dengan manual fallback dan recovery kamera terkunci.
- REFACTOR memindahkan validasi landmark/sudut ke helper geometri bersama dan metadata frontend ke katalog domain. Tidak ada perubahan dependency atau lockfile.

## Hasil validasi yang dieksekusi

| Pemeriksaan | Hasil |
| --- | --- |
| `npm --prefix frontend test` | 231 lulus, 15 file, tanpa gagal/skipped |
| `npm --prefix frontend run typecheck` | Lulus |
| `EXPO_NO_TELEMETRY=1 npm --prefix frontend run build:web` | Lulus; checksum model terverifikasi, 33 aset same-origin untuk offline |
| `npm run test:e2e` dari frontend | 32 lulus, Chromium, termasuk 10 skenario cable dan sembilan SVG |
| `npm run test:account` dari frontend | 7 lulus, signed OIDC fixture + handler produksi + PostgreSQL nyata |
| `go test -count=1 -tags integration -race -json ./...` dari backend | 43 tes/subtes lulus pada 10 package; tanpa test skip/fail |
| `go vet ./...`, `go build ./...` | Lulus |
| XML dan generator SVG | 18 file valid, atribusi tersedia, output deterministic, 10 file lama tidak berubah |
| OpenSpec strict dan `git diff --check` | Lulus |
| Smoke server Go localhost | Health ok, katalog 9, checksum/license 9 aset sesuai response; 4 set/40 reps/1.600 kg, save/reload/history dan view front-left terkunci/pulih |

Cloud memakai compiler Go 1.27.1, Node 24, cache workspace, `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright`, PostgreSQL Compose development pada 54329 dan fixture test disposable pada 55432. Aktivasi Expo memakai `EXPO_NO_TELEMETRY=1`; output build server dan tes sesuai command yang didokumentasikan di panduan localhost. Satu inspeksi SVG tanpa lokasi cache Chromium gagal menemukan executable; setelah memakai cache workspace, inspeksi visual berhasil tanpa instalasi ulang atau perubahan verification.

## Batas bukti dan kelanjutan

Tes geometris/replay membuktikan logika, integrasi dan persistence, bukan akurasi latihan nyata atau dukungan perspektif. Belum ada dataset berizin maupun live testing ≥20 set dari ≥5 orang per latihan dengan split tuning/evaluation. Unknown, missed sets dan salah label harus masuk laporan kegagalan; koreksi/merge pengguna tidak memperbaiki skor raw otomatis. Gate ≥90% label benar serta ≥90% set within-one-rep tetap terbuka pada task 6.1. Sudut 2D dan occlusion dapat menghilangkan pembeda; gunakan profil/manual ketika satu posisi kamera tidak cocok.

Kamera harus tetap pada satu posisi sepanjang sesi. Field sudut tersimpan lokal, dikunci sampai workout baru dan tidak dikirim backend. Pilihan perangkat kamera depan/belakang belum diimplementasikan; adapter saat ini meminta `facingMode: user`. Menu sudut tidak memilih sensor perangkat.

Login Google eksternal, Chrome Android/Edge fisik, Safari/native, deployment VPS/Actions dan akurasi nyata belum divalidasi oleh suite ini. Tes akun memakai fixture OIDC, bukan akun Google pengguna. Panduan localhost menjelaskan checkout branch fitur, migration up, startup, OAuth dan kelanjutan Codex CLI. Tidak mengarsipkan OpenSpec, menggabungkan PR, atau melakukan deployment pada tahap ini.
