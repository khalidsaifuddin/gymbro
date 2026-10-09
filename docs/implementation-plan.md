# Implementation plan: Gymbro web MVP

Status: domain, prototipe kamera, UI/persistence/video, tiga schema PostgreSQL, API/auth/sync dan integrasi web telah diimplementasikan. Lihat plan/validation tiap tahap dan tasks OpenSpec. Google login eksternal memerlukan konfigurasi; corpus/akurasi/perangkat nyata mengikuti live testing setelah runnable localhost. Deployment/native menyusul.

Tahap 7 menambahkan pilihan sudut yang terkunci selama sesi, recovery konfigurasi lokal, dan pelacakan sisi tubuh untuk profil samping/diagonal. Lihat `implementation-stage-7.md` serta `validation-stage-7.md`; ini belum membuktikan akurasi perspektif nyata.

Follow-up overlay sendi dan framing kamera direncanakan pada `implementation-camera-framing-overlay.md`. Overlay memakai landmark lokal yang sudah ada dan tidak menjadi bukti akurasi pengenalan.

Refinement alur workout/routine/explore serta kamera satu layar direncanakan pada `implementation-workout-routines-ui.md`. Routine browser-local adalah template; hasil sesi tetap disimpan pada aggregate workout yang ada.

Revisi setelah live testing meliputi sensitivitas squat/curl, katalog teks 1.324 latihan, scrolling, sudut kamera per latihan, dan SAKA cyan. Cakupan, skenario penerimaan, urutan, dan perintah validasi ada di `implementation-live-feedback.md`; hasil otomatis dan batas uji perangkat ada di `validation-live-feedback.md`.

## Cara kerja setiap tahap

Follow-up missed reps (2026-10-09): pengguna memilih sensitivitas lebih tinggi. Plan rinci ada di `implementation-rep-sensitivity.md`; task 11 change `gymbro-web-mvp` mencatat RED/GREEN dan batas bukti perangkat nyata.

Follow-up curl dekat dada: `implementation-chest-curl.md` mencatat penggunaan sudut 3D estimasi model dan toleransi visibility wrist lokal; task 12 mencatat replay dan validasi tanpa klaim akurasi perangkat.

Task 13 sedang dikerjakan pada branch `feature/pushup-set-controls-exercise-details`; detail, acceptance, file, dan validasi ada di `implementation-workout-controls-media.md`. Cakupannya push-up, edit/delete/uncheck set, camera end-and-return, exercise details, serta animasi SVG Flow. Sumber visual terpilih `ozansozuozgit/flow-exercise-dataset` berlisensi CC0-1.0 untuk custom artwork sejauh hak dimiliki, dengan caveat provenance terdokumentasi. Commit aset perlu dipin dan diimpor; jangan mengklaim kualitas coaching sudah tervalidasi.

### Follow-up: cegah horizontal overflow pada workout mobile (2026-10-10)

**Cakupan:** workout aktif pada viewport ponsel tidak boleh memperlebar halaman. Screenshot pengguna memperlihatkan kartu metrik dan kartu latihan terpotong ke kanan. Perbaikan mencakup sizing/min-width dan wrapping konten utama; tabel set boleh mempertahankan scroll horizontal di dalam tabel, dan kamera tetap memenuhi viewport.

**Komponen terdampak:** `frontend/public/gymbro-ui.css`, regresi browser `frontend/e2e/workout-flow.spec.ts`, serta task 14 pada `openspec/changes/gymbro-web-mvp/tasks.md`.

**Acceptance:** pada lebar 320, 375, 390, dan 430 px, sesi aktif dengan satu latihan tetap memiliki `document.documentElement.scrollWidth <= window.innerWidth`; shell, statistik, dan kartu latihan berada dalam viewport. Pada mode log, hanya tabel set boleh scroll internal. View kamera harus tetap selebar viewport.

**Urutan:** tambahkan browser regression dan jalankan untuk memastikan merah; perbaiki layout CSS pada sumber overflow tanpa menyembunyikan overflow halaman; jalankan ulang regression, suite frontend, typecheck, dan export web.

**Validasi:** `cd frontend && npm run test:e2e -- workout-flow.spec.ts --grep "does not overflow"`, `npm test`, `npm run typecheck`, dan `npm run build:web`.

**Hasil validasi 2026-10-10:** `npm test` lulus 294/294; `npm run typecheck` lulus; `npm run build:web` lulus. Browser regression sudah ditambahkan, tetapi Playwright gagal sebelum membuka halaman: bundled Chromium abort pada MachPort rendezvous dan Chrome sistem juga abort saat startup. Ini bukan hasil RED/GREEN; pengukuran browser masih perlu dijalankan di lingkungan yang browser-nya dapat dimulai.

### Follow-up: hapus fallback entry pada sesi workout (2026-10-10)

**Cakupan:** hilangkan panel “Fallback entry / Catat set manual” dari sesi aktif sesuai screenshot. Set target yang ada pada kartu latihan tetap menjadi cara mencatat atau mengoreksi set; kontrol deteksi dan hasil workout tetap berjalan. Hapus state dan instruksi status yang hanya mendukung panel tersebut.

**Komponen terdampak:** `frontend/src/components/CameraPrototype.web.tsx`, `frontend/src/components/WorkoutLog.web.tsx`, `frontend/public/gymbro-ui.css`, regresi sesi/kamera `frontend/e2e/workout-flow.spec.ts` dan `frontend/e2e/camera-prototype.spec.ts`, serta task OpenSpec berikutnya.

**Acceptance:** setelah workout kosong dimulai, panel/heading/field fallback tidak dirender; setelah latihan ditambahkan, target set, kamera, dan tombol jeda tetap tersedia; pesan tracking tidak menyuruh pengguna memakai panel yang sudah dihapus.

**Urutan:** tambah assertion browser; jalankan untuk RED; hapus panel/state/copy yang khusus fallback; jalankan regression, unit, typecheck, dan build.

**Validasi:** `cd frontend && npm run test:e2e -- workout-flow.spec.ts --grep "fallback entry"`, `npm test`, `npm run typecheck`, dan `npm run build:web`. Browser test mengikuti blocker startup yang dicatat di atas.

**Hasil validasi:** unit lulus 294/294; typecheck dan web export lulus. Browser assertion gagal sebelum test berjalan karena Chromium macOS abort pada `bootstrap_check_in` MachPort rendezvous. Implementasi tidak memiliki bukti browser GREEN sampai test dapat berjalan.

### Follow-up: animasi detail latihan di atas deskripsi dan autoplay (2026-10-10)

**Cakupan:** pada detail latihan, letakkan player tepat setelah judul dan sebelum kartu equipment/instruksi; mulai animasi pada render awal. Tetap hormati preferensi `prefers-reduced-motion` dengan menampilkan frame pertama tanpa bergerak, serta pertahankan pause/play dan attribution.

**Komponen terdampak:** `frontend/src/components/ExerciseDetails.web.tsx`, `frontend/src/components/ExerciseMedia.web.tsx`, dan `frontend/e2e/exercise-media.spec.ts`.

**Acceptance:** player berada di atas deskripsi/instruksi; untuk exercise dengan animasi dan motion normal, frame pertama dimuat tanpa klik dan tombol pause terlihat; exercise tanpa animasi tetap menampilkan fallback; reduced motion tidak menjalankan interval.

**Urutan:** ubah browser regression agar membuktikan urutan DOM dan autoplay; jalankan untuk RED jika browser tersedia; pindahkan player dan inisialisasi playback aktif; jalankan unit, typecheck, dan web export.

**Validasi:** `cd frontend && npm run test:e2e -- exercise-media.spec.ts --grep "auto-plays"`, `npm test`, `npm run typecheck`, dan `npm run build:web`. Browser test saat ini diketahui terhambat oleh Chrome startup pada mesin ini.

**Hasil validasi:** unit lulus 294/294; typecheck dan web export lulus. Assertion browser sudah diperbarui tetapi belum dapat dieksekusi karena startup Chromium sebelumnya abort sebelum membuka halaman.

### Follow-up: kamera sebagai tampilan penuh dengan kontrol ringkas (2026-10-10)

**Cakupan:** gunakan seluruh viewport sebagai panggung video; tampilkan informasi latihan, hitungan, status deteksi/framing yang digabung, dan letakkan kontrol dalam panel yang dapat dibuka dari ikon di kanan atas. Mulai kamera otomatis setelah tampilan kamera terbuka; izinkan retry jika izin gagal. Semua tombol aksi pada panel hanya menampilkan ikon dan tetap memiliki accessible name/title.

**Komponen terdampak:** `frontend/src/components/CameraPrototype.web.tsx`, `frontend/src/components/CameraFramingOverlay.web.tsx`, `frontend/public/gymbro-ui.css`, serta `frontend/e2e/camera-prototype.spec.ts` dan `frontend/e2e/workout-flow.spec.ts`.

**Acceptance:** video/frame memenuhi viewport ponsel termasuk area safe-area; tidak ada footer yang mengambil tinggi dari video; tracking terputus dan framing cue tampil bersama di bagian atas video; panel kanan atas bisa buka/tutup dan berisi profile, pause/resume, end set, end-and-return, finish, back, serta placement guide; aksi ditampilkan sebagai ikon saja dengan label aksesibel; kamera diminta otomatis saat view terbuka; bila izin ditolak, pesan tampil dan menu menyediakan retry; hitungan dan set tetap akurat.

**Urutan:** tambah regression untuk auto-start, bounds full viewport, overlay pesan gabungan, menu collapsed/open, accessible names, serta tombol set/back; jalankan RED bila browser tersedia; implement auto-start dengan guard terhadap double-start, pindahkan controls ke sidebar dan video menjadi background full viewport, gabungkan status overlay; validasi unit, typecheck, export, dan browser saat runtime tersedia.

**Validasi:** `cd frontend && npm run test:e2e -- camera-prototype.spec.ts`, `npm test`, `npm run typecheck`, dan `npm run build:web`. Browser test masih terblokir pada startup Chrome di mesin ini.

**Hasil validasi 2026-10-10:** `npm test` lulus 294/294; `npm run typecheck` lulus (termasuk typecheck E2E); `npm run build:web` lulus; `git diff --check` lulus. Targeted Playwright regresi gagal sebelum test berjalan karena Chromium abort di `bootstrap_check_in` MachPort rendezvous. Assertion ada di E2E untuk dijalankan pada runtime browser yang tersedia.

Sebelum menulis kode, uraikan task yang sedang dikerjakan beserta skenario penerimaan, file terdampak, dan perintah validasinya. Ikuti RED → GREEN → REFACTOR dan simpan hasil tes sebenarnya. Dokumentasi tidak memerlukan tes aplikasi palsu.

## 1. Fondasi dan domain workout

Siapkan backend Go berlapis sesuai referensi dan frontend Expo/TypeScript. Domain workout di frontend harus dapat berjalan tanpa kamera/DOM, sehingga replay deteksi dapat diuji deterministik. Backend memvalidasi hasil serta otorisasi, bukan menjalankan model kamera.

RED: fase siklus lengkap/parsial, siklus terputus, curl bilateral, hilangnya pandangan kamera, batas set 15 detik, konfirmasi pergantian gerakan, koreksi/merge, pause, rest timestamp, normalisasi beban, dan summary setelah koreksi. Gunakan jam injeksi, bukan tes yang menunggu waktu nyata.

GREEN: state machine dan perhitungan yang lulus skenario tersebut. REFACTOR: pisahkan aturan domain, waktu, dan persistence. Exit gate: tes domain lulus dan tidak bergantung pada model atau jaringan.

## 2. Prototipe deteksi browser

Evaluasi pose estimation di browser dan pengenalan gerakan dari urutan pose, dengan label belum dikenali jika sinyal tidak cukup. Kandidat awal MediaPipe Pose Landmarker; pin versi dan lisensi model setelah memeriksa distribusi resminya. Pose tubuh saja belum membuktikan jenis alat, sehingga shoulder press mesin dan gerakan mirip memerlukan uji khusus.

RED: replay keypoint berlabel untuk transisi, smoothing/debounce, missing landmarks, gerakan parsial, dan false positives dari gerakan nonlatihan. GREEN: adapter model + klasifikasi temporal + penghitung. REFACTOR: pisahkan adapter browser dari domain agar mobile dapat menyusul.

Definisi fase awal: squat berdiri → turun → berdiri; push-up posisi atas → turun → atas; curl lengan terbuka → fleksi → terbuka; press posisi beban bawah → atas → bawah. Pose/fase dan ambang rentang gerak harus diuji; hitungan bukan penilaian teknik.

Exit gate: evaluasi terpisah pada kelima gerakan. Minimal 20 set per gerakan dari sedikitnya 5 orang; pisahkan data tuning dari evaluasi. Laporkan ≥90% label benar dan ≥90% set berselisih maksimal satu rep per gerakan. Label unknown adalah kegagalan, koreksi manual tidak memperbaiki skor otomatis. Jangan mengklaim gate lulus tanpa data nyata berizin.

## 3. UI workout dan persistence lokal

Tampilan kamera dengan angka besar serta log ala Hevy memakai state sesi yang sama. Gunakan IndexedDB untuk catatan sesi dan antrean mutasi, service worker/cache untuk aset/model yang sudah dimuat, dan adapter kamera serta MediaRecorder khusus web.

RED: izin kamera ditolak, perangkat/model tidak mendukung, pause/background, recovery reload, koneksi terputus, koreksi set, timer, summary, serta rekaman default mati/save/discard. GREEN: komponen dan penyimpanan lokal; REFACTOR: pisahkan UI dari adapter platform. Buat SVG original untuk lima gerakan beserta source, lisensi CC-BY-4.0, dan atribusi.

Exit gate: alur tamu selesai melalui browser; sesi tetap berjalan saat jaringan terputus setelah startup; video tidak diunggah. Pemulihan video setelah reload tidak dijamin. Validasi kamera/recording dengan perangkat nyata, bukan hanya fake stream.

## 4. PostgreSQL, API, akun, dan sinkronisasi

Tulis integration tests RED dengan PostgreSQL tes nyata sebelum migration/repository. Cakup tiga schema, owner isolation, foreign key, transaksi atomic, retry idempotent, revisi konflik, penghapusan/stale sync, serta log pada batas bulan dan fallback partisi.

GREEN: versioned migrations dan repository GORM qualified; Gin handlers, use cases, sesi login Google, opt-in migration data tamu, serta outbox sync. Gunakan cookie HttpOnly/Secure dengan CSRF protection dan validasi identitas Google di server. REFACTOR: pertahankan boundary core dan adapter.

Exit gate: tes PostgreSQL dan API lulus; migrasi fresh install dan rollback diuji hanya pada DB disposable. Google integration divalidasi setelah konfigurasi OAuth sah tersedia; jangan memakai login palsu untuk mengklaim login Google berhasil.

## 5. Validasi menyeluruh

Jalankan tes E2E workout tamu, akun, offline/reconnect, konflik dua perangkat, penghapusan, dan rekaman. Jalankan type check/build frontend, tes Go termasuk race detector jika didukung, serta pengujian browser Chrome/Edge desktop dan Chrome Android.

Command tahap 1 yang tersedia: `npm test`, `npm run typecheck`, `npm run build:web` dari `frontend`; `go test ./...` dan `go test -race ./...` dari `backend`. Lihat env build cloud pada `domain-api.md`. `npm run test:e2e` tersedia dan lulus untuk UI guest, kamera sintetis, IndexedDB, offline build, recorder dan SVG; lihat validation-stage-3.md. Migration/repository/API/auth/concurrency tests PostgreSQL disposable tersedia; lihat validation-stage-5.md. Live testing perangkat/akurasi dilakukan setelah MVP runnable localhost, sesuai instruksi pengguna.

Publikasi/deployment, Safari, dan aplikasi native iOS/Android adalah tahap lanjutan. Hasil akhir harus membedakan tes otomatis, uji perangkat, evaluasi akurasi, dan konfigurasi OAuth/deployment yang belum tersedia.
# Latest deployment follow-up: see `docs/implementation-deployment.md` for VPS inspection, acceptance scenarios, order, safety boundaries, and validation commands.
