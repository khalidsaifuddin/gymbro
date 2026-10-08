# Bukti validasi prototipe kamera

## TDD dan hasil aktual

| Perubahan | RED | GREEN |
| --- | --- | --- |
| Adapter pose lima profil | 26 gagal, 34 tes domain tetap lulus | 60 lulus |
| Rasio aspek video | 2 gagal, 60 lulus | 62 lulus |
| Partial cycle tambahan | Perilaku tersedia diuji tanpa perubahan logika | 63 lulus |
| Client worker | 9 gagal, 63 lulus | 72 lulus |
| Classifier temporal/arah tangan | 11 gagal, 72 lulus | 83 lulus |
| Set manual/provenance | 5 gagal, 84 lulus; rejection invalid-input sudah tersedia pada stub | 89 lulus |
| UI prototipe | 3 browser scenarios gagal karena komponen belum tersedia | 3 scenarios lulus; suite diperluas ke 6 browser tests yang lulus |

Client-worker RED awal menimbulkan rejected promises dari stub yang belum di-await saat pesan diperiksa; harness diperbaiki dan RED dijalankan ulang dengan 9 kegagalan perilaku tanpa unhandled errors sebelum implementasi client. Run UI RED pertama dihentikan untuk memakai timeout lebih singkat; run pengganti selesai dengan 3 failures. Keduanya tidak dilaporkan sebagai validasi GREEN.

Hasil akhir: **89 unit tests lulus dalam 5 file**, tanpa skips; TypeScript type check dan Expo web export lulus. **6 Playwright tests lulus** pada Chromium 156.0.8078.4: izin ditolak/manual summary, panduan lima profil, input invalid, pause/resume/background, konfirmasi mid-set dengan replay sintetis, dan inferensi MediaPipe worker nyata.

## Model dan runtime

- Library `@mediapipe/tasks-vision` 1.1.0 terpasang; integrity lockfile cocok dengan registry metadata yang dipin.
- Model Full float16 v1, 9398198 bytes, SHA-256 `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`; ZIP integrity lulus. Lisensi library/source dan model card diperiksa. Lihat `model-license.md` dan `model-manifest.json`.
- Worker classic menjalankan CPU inference dari ImageBitmap. Smoke canvas hitam mengembalikan landmark kosong sesuai input tanpa orang. Model/WASM serta worker dimuat dari origin lokal; assertions pada worker dan lifecycle kamera hanya melihat GET same-origin dan tidak menemukan upload frame/video/pose.
- Browser lifecycle memakai perangkat kamera sintetis Chromium, bukan kamera fisik. Replay geometri pada test pergantian profil juga sintetis. Tes ini menguji integrasi dan lifecycle; tidak membuktikan akurasi kelima gerakan atau performa perangkat pengguna.
- Download model dan Chromium sempat ditolak 403. Setelah penambahan domain pada konfigurasi, model/browser berhasil terunduh. Situs dokumentasi `ai.google.dev` masih menolak akses; dokumentasi Git dan model card resmi dapat dibaca.
- Install script lengkap dijalankan ulang: frozen frontend install, persiapan model/checksum, browser install, Go module download, dan OpenSpec validation berhasil. Sesudahnya 89 unit tests/type check tetap lulus. Server Expo development juga memuat UI dan functional check manual bench press 12 × 40 kg menghasilkan volume 480 kg; backend `/health` mengembalikan status ok.

## Batas prototipe

Pengenalan otomatis memerlukan satu siklus stabil sebelum memilih pola kandidat. Siklus awal selama status unknown dapat belum masuk hitungan; pilih profil sebelum mulai untuk menghindari warm-up klasifikasi ini. Efeknya harus masuk evaluasi raw reps, bukan ditutupi koreksi pengguna. Classifier geometri belum membuktikan jenis alat, sehingga bench/dumbbell/mesin yang mirip masih membutuhkan data evaluasi nyata dan negative samples.

Panduan kamera berupa teks kandidat, belum gambar/animasi. UI log lengkap ala Hevy, IndexedDB/outbox, recording, database, dan OAuth belum tersedia. Workout prototipe saat ini hanya berada di memory halaman; reload/close menghilangkannya. Summary manual memakai waktu entry set, bukan timestamp gerakan yang tidak diobservasi kamera.

Task 2.5/2.6 belum dapat dijalankan: tidak ada corpus berlabel dan berizin minimal 20 set per latihan dari ≥5 orang. Target ≥90% label dan ≥90% within-one-rep belum diukur. Gunakan `recognition-evaluation-protocol.md`; jangan merilis dukungan otomatis sebagai terverifikasi berdasarkan suite ini.

## Command

Dari `frontend`: `npm ci --cache /workspace/.npm-cache`, `npm run prepare:vision`, `npm test`, `npm run typecheck`, `CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run build:web`, lalu `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright npm run test:e2e`. `prebuild:web` dan `preweb` menyiapkan aset secara otomatis dengan checksum. Untuk browser yang belum terpasang, `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright npx playwright install chromium`.
