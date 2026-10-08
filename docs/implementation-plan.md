# Implementation plan: Gymbro web MVP

Status: domain, prototipe kamera, UI/persistence/video, tiga schema PostgreSQL, API/auth/sync dan integrasi web telah diimplementasikan. Lihat plan/validation tiap tahap dan tasks OpenSpec. Google login eksternal memerlukan konfigurasi; corpus/akurasi/perangkat nyata mengikuti live testing setelah runnable localhost. Deployment/native menyusul.

Tahap 7 menambahkan pilihan sudut yang terkunci selama sesi, recovery konfigurasi lokal, dan pelacakan sisi tubuh untuk profil samping/diagonal. Lihat `implementation-stage-7.md` serta `validation-stage-7.md`; ini belum membuktikan akurasi perspektif nyata.

## Cara kerja setiap tahap

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
