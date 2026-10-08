# Implementation plan tahap 3: UI, persistence lokal, dan rekaman

## Cakupan dan urutan

1. Snapshot domain berversi: hasil terverifikasi, waktu, pause, koreksi dan provenance; jangan menyimpan siklus parsial, pose, atau media. Recovery sesi aktif selalu paused sampai pengguna melanjutkan. Tulis RED sebelum API snapshot/restore.
2. Adapter IndexedDB `src/storage/workout-store.ts`: workout guest, preferences, dan tempat outbox akun terpisah. Revision comparison dalam transaksi mencegah tab lama menimpa hasil baru. Guest tidak otomatis dikirim ke akun. Dependensi tes tambahan dipin `fake-indexeddb@6.2.5`; tidak digunakan dalam runtime.
3. Kamera dan log tetap menggunakan **satu** `WorkoutSession` di `CameraPrototype.web.tsx`. Tambahkan tabel per latihan, penghitung besar, hasil sebelumnya dari riwayat lokal sendiri, edit beban/reps, merge, timer per latihan default 120 detik, summary, recovery eksplisit dan riwayat. Komponen presentasi dapat dipisah dari adapter tanpa membuat aggregate kedua.
4. Cache aplikasi/model melalui service worker web dan persiapan build. Tes browser offline setelah startup dan reload; status cache tidak boleh menyatakan siap sebelum aset tersedia. Pemakaian pertama tetap perlu koneksi.
5. Adapter recorder default mati, opt-in sebelum sesi; pilih MIME yang didukung, simpan/buang Blob lokal, tidak upload. Kamera yang berhenti saat pause membuat rekaman dalam segmen terpisah; setiap segmen harus file mandiri yang valid, jangan concatenation container. Saat resume, mulai segmen baru. UI menjelaskan file per segmen dan bahwa reload tidak memulihkan video.
6. Lima SVG original animasi kontinu (interpolasi anggota tubuh), source, metadata atribusi Gymbro contributors, lisensi aset CC-BY-4.0; panduan posisi awal/akhir sesuai profil. Rendering diperiksa di browser. Diagram bukan bukti akurasi model.

## Acceptance dan RED → GREEN → REFACTOR

- Domain: delapan rep bertahan JSON roundtrip; partial cycle dibuang; downtime tidak masuk durasi aktif; no phantom auto-close; sesi finished membekukan summary; snapshot rusak/versi asing ditolak; merged provenance/volume tetap utuh.
- IndexedDB: close/reopen mempertahankan draft/finished, atomic revision conflict, deletion, storage failure tidak dianggap tersimpan; tidak ada video/pose di record. Outbox network/idempotency akun diuji bersama server pada tahap 5, bukan diklaim selesai dari IndexedDB saja.
- Interaction: tabel dan penghitung satu sumber; input valid memperbarui summary, input invalid tidak mengubah data; koreksi mempertahankan raw reps; hasil sebelumnya sendiri; merge tidak duplikat; target rest editable dan early start diizinkan.
- Recovery/offline: reload meminta recovery dan reaktivasi kamera; permission denial tetap memungkinkan manual; background pause tersimpan; data survive reload offline setelah cache ready. Conflict/storage errors jelas dan tidak overwrite diam-diam.
- Recorder: default tanpa MediaRecorder, pre-session opt-in, unsupported MIME tetap manual/detection, stop pada pause/background, resume segmen baru, local save/discard independen dari hasil. Network assertions hanya GET asset lokal tanpa media upload.
- SVG: kelima profil memuat SVG yang sesuai dan atribusi, rendering/animasi bergerak serta reduced-motion dapat dihentikan.

Tes perangkat nyata dan corpus ≥20 set/gerakan dari ≥5 orang dilakukan **setelah MVP bisa dijalankan dan diakses dari localhost**, sesuai instruksi pengguna. Tetap catat task 2.5–2.7, 3.7 dan 6.4 terbuka sampai bukti nyata ada; jangan menjadikannya blocker pekerjaan independen.

## File dan command validasi

Domain `src/domain/workout.ts`, tes snapshot; adapter `src/storage/`, `src/recording/`, komponen web; `public/` service worker/SVG; build scripts; `e2e/` interaction/reload/offline/recording. Update dokumen status/validation dan checkbox hanya ketika perilaku task lengkap.

Dari `frontend`: `npm test`, `npm run typecheck`, `EXPO_NO_TELEMETRY=1 npm run build:web`, `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright npm run test:e2e`. RED browser memakai build sebelum implementasi; GREEN rebuild sebelum replay tes. Dari root: `OPENSPEC_TELEMETRY=0 /workspace/tools/openspec/bin/openspec validate gymbro-web-mvp --strict`.

Setelah suite relevan lulus, review diff/secret/generated files dan push milestone langsung `main` sesuai otorisasi MVP. Deployment VPS/GitHub Actions mengikuti permintaan deployment terpisah; native/Safari belum diklaim.
