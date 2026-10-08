# Bukti validasi tahap 1

## TDD

| Kelompok | RED sebelum logika | GREEN setelah implementasi |
| --- | --- | --- |
| Repetisi | 12 tes gagal dengan observation behavior belum tersedia | 12 lulus |
| Batas set/timer/koreksi | 11 tes baru gagal; 12 sebelumnya tetap lulus | 23 lulus |
| Beban/summary | 9 tes gagal; 25 perilaku yang tersedia lulus | 34 lulus |
| HTTP health backend | TestHealthEndpoint gagal karena 404 | Endpoint 200 dengan status/service yang benar |

Suite frontend terakhir: 34 tests passed, satu file, tanpa skips. TypeScript type check lulus. Go suite berisi satu tes HTTP dasar yang lulus termasuk race detector; package main memiliki no test files, bukan tes workload yang lulus.

## Instalasi/build

- Go 1.27.1 linux-amd64 dari distribusi resmi; SHA-256 terverifikasi: `63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445`.
- Dependency frontend dipin, lockfile dibuat, dan `npm ci --offline` berhasil dari cache hasil install terverifikasi.
- Go module resolution, checksum verification, build binary, serta tests/race detector berhasil.
- Expo web export berhasil dengan 178 modules dan satu bundle web. Build awal membutuhkan konfigurasi telemetry; setelah memakai `EXPO_NO_TELEMETRY=1` dan offline build, export berhasil.
- Replay domain menghasilkan satu set/two reps curl bilateral dengan volume 40 kg dan durasi 6000 ms.
- Smoke HTTP pada server yang dijalankan: `/health` mengembalikan `{"service":"gymbro","status":"ok"}`; HTML web dan bundle JavaScript 329584 bytes tersaji dengan sukses. Ini memverifikasi startup dasar, belum alur workout melalui UI.
- Setup lengkap dijalankan ulang dengan checksum Go, `npm ci`, dan `go mod download`; OpenSpec doctor/strict validation lulus. Sesudah instalasi ulang, 34 tes frontend, type check, web export, serta Go race test/build tetap lulus.

## Batas bukti

Frontend saat ini adalah scaffold. Tidak ada pose model, UI workout lengkap, IndexedDB, recorder, database migration, OAuth, atau deployment. Tes sintetis domain tidak membuktikan pengenalan gerakan atau target 90% akurasi. GORM/PostgreSQL pins tersedia dalam plan dan akan masuk dependency module ketika tahap persistence dimulai; `go mod tidy` tidak menyimpan dependencies yang belum digunakan.
