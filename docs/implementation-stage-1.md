# Implementation plan tahap 1: fondasi dan domain

Change: `gymbro-web-mvp`, tasks 1.1–1.8. Ditulis sebelum kode aplikasi.

## Cakupan dan file

- `frontend/package.json`, lockfile, konfigurasi Expo/TypeScript dan entry point: fondasi web, tanpa mengklaim kamera sudah tersedia.
- `frontend/src/domain/workout.ts`: domain TypeScript tanpa DOM/model/network dengan clock dan ID factory yang dapat diinjeksi.
- `frontend/src/domain/workout.test.ts`: tes perilaku deterministik untuk setiap aturan tracking.
- `backend/go.mod`, folder clean architecture, entry point: fondasi API; database/auth menyusul sesuai tahapnya.

## Toolchain dan pins

- Node yang tersedia: 24.19.0; Go resmi terpilih: 1.27.1, checksum dari metadata resmi `go.dev/dl/?mode=json`.
- Expo 57.0.27; bundled modules: React/React DOM 19.2.3, React Native 0.86.3, React Native Web seri 0.21, Metro runtime seri 57.0.16. Pin patch yang terpasang dan pertahankan package-lock.
- Vitest 5.0.3; TypeScript 7.0.2. Node 24 memenuhi engine Vitest. Verifikasi type/build dengan dependency Expo yang benar-benar terpasang.
- Backend library pins hasil registry Go: Gin v1.12.0, GORM v1.31.2, PostgreSQL driver v1.6.3. Gin/driver memerlukan Go ≥1.25; Go 1.27.1 memenuhi kebutuhan ini.
- Go bawaan `/usr/bin/go` adalah aplikasi board game, bukan compiler. Gunakan `/workspace/tools/golang/go/bin` setelah SHA-256 archive resmi diverifikasi; jangan menonaktifkan TLS atau checksum.

## Urutan TDD dan penerimaan

1. Scaffold/test runner dan type contract/stub domain; jangan memasukkan logika sebelum RED.
2. RED reps: ready → peak → ready dihitung satu; siklus parsial, input tak terlihat, pause, dan curl unilateral tidak dihitung. Jalankan tes dan rekam failures perilaku.
3. GREEN/REFACTOR reps tanpa framework/model.
4. RED timing/correction: 15 detik valid tracking, gangguan >15 detik tidak menutup set, manual end, mid-set exercise change confirmation, between-set change, koreksi mempertahankan detected reps, merge, rest dari last rep, serta resume/pause.
5. GREEN/REFACTOR timing menggunakan clock injeksi.
6. RED → GREEN → REFACTOR volume dan summary: beban barbell total, dua dumbbell 10 kg × 10 reps = 200 kg, machine kg, bodyweight/missing load tidak diperkirakan, input tidak valid ditolak, summary berubah bersama koreksi.
7. Dokumentasikan API/replay dan uji command yang tersedia, baru tandai tasks terkait selesai.

## Perintah validasi

Dari `frontend`: `npm ci`, `npm test`, `npm run typecheck`, `npm run build:web`. Dari `backend` dengan compiler Go resmi: `go mod download`, kemudian tes/build yang tersedia. Empty test suite bukan bukti perilaku. Uji HTTP lokal pada tahap entry point hanya membuktikan server dasar, bukan API workout/auth.

Simpan hasil RED/GREEN dan jumlah tes dalam dokumen validasi. Tahap ini tidak membuktikan akurasi kamera atau readiness database/OAuth/native. Lanjutkan task prototipe setelah domain lulus; evaluasi workout nyata tetap prerequisite sebelum klaim dukungan otomatis.
