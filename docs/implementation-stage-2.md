# Implementation plan tahap 2: prototipe pose kamera

Change `gymbro-web-mvp`, tasks 2.1–2.7. Ditulis sebelum integrasi model dan adapter pose.

## Cakupan dan urutan

1. Verifikasi `@mediapipe/tasks-vision` 1.1.0 dari registry npm: Apache-2.0, integrity `sha512-ZJqh0wMKOINorfSffvDAxzyO1//c+FiG3IkzOdNDnLqvBB3DbMfj0bB/tys2SNf9S914sgoIbIpF4HTOi336cg==`. Lisensi sumber MediaPipe juga diperiksa pada commit `f6988c4769278bde600efd488dfc8645432dc92b`.
2. Kandidat model: Pose Landmarker Full float16 versi 1, distribusi resmi `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`. Verifikasi lisensi model dan SHA-256 sebelum dipakai; jangan memasang model pengganti tanpa verifikasi.
3. RED: tes adapter keypoint untuk lima latihan dengan input deterministik: sudut sendi, smoothing, debounce waktu, confidence rendah, landmark hilang/degenerate, bilateral curl, kamera terputus, dan partial cycles. Ini tes kontrak/geometri, bukan evaluasi akurasi.
4. GREEN/REFACTOR: adapter pose tanpa DOM/network menerjemahkan pose menjadi observation domain. Untuk tahap awal, profil gerakan dipilih eksplisit; klasifikasi jenis latihan otomatis dan integrasi worker menyusul setelah model sah tersedia. Jangan mengklaim task 2.3/2.4 selesai hanya karena profil manual dapat menghitung siklus.
5. Integrasikan model browser/worker setelah sumber model dapat diakses, lalu klasifikasi temporal antarjenis gerakan, unknown/manual fallback, panduan posisi dan network assertions. Seluruh aset model/WASM disajikan dari origin aplikasi; tidak ada upload frame/video/pose.
6. Evaluasi pada data workout nyata berizin; pisahkan tuning dan evaluation menurut orang. Minimal evaluation 20 set per gerakan dari ≥5 orang; unknown adalah kegagalan label. Laporkan raw automated label/reps sebelum koreksi.

## File dan kontrak

- `frontend/src/detection/pose-phase-adapter.ts`: tipe 33-landmark, validasi visibility/presence, sudut sendi, smoothing/debounce, hasil observation dengan alasan bila invalid. Clock berasal dari timestamp frame, bukan delay tes.
- `frontend/src/detection/pose-phase-adapter.test.ts`: fixture geometris sintetis dan replay ke `WorkoutSession`; label manual tidak dijadikan bukti kemampuan klasifikasi otomatis.
- `docs/model-manifest.json`: pin, sumber, lisensi/checksum dan status verifikasi aktual. Nilai belum tersedia tetap null; tidak mengarang checksum.
- `docs/validation-stage-2.md`: hasil RED/GREEN, dukungan yang benar-benar diuji, serta blocker.
- Worker MediaPipe dibundle memakai esbuild 0.28.2, aset WASM/model disiapkan ke `frontend/public/vision` melalui script dengan SHA-256 sebelum build. Model/hasil bundle adalah output generated yang diabaikan Git; source URL, pin dan checksum masuk manifest.
- Browser smoke memakai Playwright 1.64.0: load worker nyata, warm-up/inferensi atas canvas, dan audit request same-origin. Tes ini membuktikan runtime WASM, bukan kamera/perangkat atau akurasi gerakan.

## Penerimaan adapter awal

Sudut dirata-ratakan dari kedua sisi ketika diperlukan; curl yang tidak sinkron tidak menghasilkan rep otomatis. Hilangnya landmark/confidence langsung mengirim observation invalid sehingga domain membuang siklus terputus. Frame out-of-order dan gap >1000 ms memutus siklus. Stabilitas fase memakai minimal tiga frame dan 120 ms. Smoothing EMA default 0.5; bisa diinjeksi pada tes. Unknown dan posisi tubuh yang tidak cocok menghasilkan invalid, bukan label pasti. Adapter browser harus memberikan `aspectRatio = videoWidth / videoHeight` agar sudut dari koordinat normalized tidak berubah karena bentuk video.

Fase kandidat: squat memakai lutut; push-up memakai siku dengan badan horizontal; curl memakai siku dengan badan tegak dan lengan atas turun; seated press memakai siku, badan tegak dan paha duduk; bench press memakai siku dengan badan horizontal. Dua gerakan press dimulai dari posisi beban bawah. Pose tidak membuktikan jenis alat, jumlah/berat beban, atau kualitas teknik; batas ini tetap berlaku saat profil dipilih.

## Validasi dan blocker saat plan ditulis

`npm test`, `npm run typecheck`, dan `CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run build:web` dari frontend. Verifikasi npm integrity melalui lockfile ketika paket dipasang. Model belum diunduh: proxy menolak `storage.googleapis.com` dengan CONNECT HTTP 403; dokumentasi `ai.google.dev` juga belum dapat diakses. Kedua domain sudah ditambahkan ke draft lingkungan, belum terbukti aktif. Task 2.1 tetap terbuka sampai verifikasi model selesai.

Dataset berizin dan pengujian perangkat nyata belum tersedia. Task 2.5/2.6 dan gate ≥90% label/≥90% reps tidak boleh ditandai lulus dari fixture sintetis.

Update sebelum integrasi: model resmi kini berhasil diunduh (9398198 bytes), SHA-256 `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`. Archive lulus pemeriksaan ZIP dan berisi detector serta landmark detector. Model card BlazePose GHUM 3D resmi menyebut Apache License 2.0. Situs dokumentasi tetap menolak HTTP 403; sumber Git resmi dapat dibaca sebagai alternatif. Tetap pin dan verifikasi checksum pada setiap download berikutnya.

## UI prototipe dan fallback task 2.4

Tambahkan `CameraPrototype.web.tsx` dengan izin kamera, worker loop, pilihan profil otomatis/manual, panduan posisi per latihan, warning tracking, pause/background dan konfirmasi perpindahan mid-set. Adapter native sementara menjelaskan bahwa kamera native belum tersedia. `App.tsx` menampilkan prototipe ini; UI log Hevy/riwayat/offline/rekaman tetap tahap 3.

Fallback kamera harus memungkinkan pencatatan set manual yang nyata pada aggregate yang sama, sehingga tambahkan `WorkoutSession.addManualSet` melalui RED/GREEN terpisah. Simpan origin manual/automatic/mixed dan raw detected reps; entry manual tidak masuk skor kamera. Validasi reps/beban sebelum mutasi. Tes browser memverifikasi izin ditolak tetap bisa mencatat set dan menampilkan summary, panduan lima profil, serta pause yang menghentikan track kamera. Build/scenario tests dijalankan sebelum push prototipe.
