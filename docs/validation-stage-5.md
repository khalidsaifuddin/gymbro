# Validasi tahap 5–6: API, auth, durable sync dan localhost

Tanggal laporan: 9 Oktober 2026 (Asia/Jakarta). Implementasi dimulai dari implementation-stage-5.md dan implementation-stage-6.md. Bukti otomatis berbeda dari Google eksternal, kamera fisik, dan evaluasi akurasi.

## RED → GREEN → REFACTOR yang dieksekusi

- Lima label-source tests awal gagal karena profile/manual/automatic provenance belum ada; domain/snapshot/component sekarang mempertahankan label asli tanpa menganggap profile sebagai klasifikasi.
- Tes schema snapshot gagal karena kolom capture belum tersedia. Repository round-trip gagal karena capture/pause/source tidak disimpan. Migration 003 + qualified adapter membuatnya lulus; 001/002 yang sudah dipush tidak diubah. Upgrade existing row/revision, repeated migration dan disposable rollback diuji.
- Tiga sync integration tests awal gagal `unauthorized` pada scaffold. Implementasi real PostgreSQL mengunci owner/mutation/revision, menyimpan immutable outcome, dan membuat concurrent retry/revision race/log rollback/tombstone lulus.
- Dua auth flow tests awal gagal pada Start yang belum tersedia; state/binding/nonce/PKCE, one-time consume, flow expiry dan hash-only issue kini lulus. PostgreSQL session test awal gagal issue; persistence, expiry, logout, account deletion, identifying-log cleanup serta UUID baru saat login ulang kini lulus.
- Signed OIDC fixture gagal pemeriksaan PKCE pada scaffold; adapter produksi kini menerima valid signature dan menolak wrong key/audience/issuer/expiry/nonce/missing subject. Token fixture bukan Google end-to-end.
- HTTP test awal gagal katalog 404. Handler/use cases kini diuji dengan owner isolation, Origin/CSRF, strict unknown-field/media rejection, corrected volume/raw reps dan account deletion. Regression stale account_id awal diterima 200; kini 401, owner tetap berasal dari sesi server.
- Lima IndexedDB/outbox tests awal gagal karena sync belum tersedia. Guest opt-in, immutable sent envelope setelah reopen, in-flight newer edit, conflict choices, owner/cache isolation dan deletion kini lulus.
- Regresi late history response awal menghilangkan workout yang baru di-ACK; baseline revision guard kini mencegah false deletion. Provenance origin yang menerima data non-workout kini dibatasi enum setelah regression RED.
- Browser RED awal tidak menemukan login link. UI account + domain/local store + real API kini lulus. Account deletion regression menemukan background sync menimpa status setelah account cleanup; transition guard membuatnya lulus tanpa mengendurkan assertion. Satu failure test harness akibat salah asumsi reload login diperbaiki pada test flow, bukan dianggap bug aplikasi.
- REFACTOR: core bebas Gin/GORM; GORM model/DTO berada di adapter, hash outcome wire dibandingkan lewat JSON (representasi timezone Go bukan kontrak HTTP), binding sync terpisah dari local CAS, validator snapshot/pause/source dan guarded account transitions.

## Hasil akhir

| Check | Hasil |
| --- | --- |
| Frontend `npm test` | **124 tests, 11 files passed** |
| Frontend `npm run typecheck` | Exit 0 |
| Frontend `npm run build:web` | Exit 0, 25 packaged same-origin offline assets |
| Guest Playwright `npm run test:e2e` | **18 passed** |
| Account Playwright `npm run test:account` | **5 passed** |
| Backend `go test -tags integration -race -json ./...` | **36 tests/subtests passed, 0 failed, 0 skipped** |
| Backend `go vet ./...`, `go build ./...`, `go mod verify` | Exit 0, all modules verified |
| OpenSpec doctor + strict validate | Passed |
| Reusable install script | Full frozen npm/tool/model/browser/Go/module/PostgreSQL preparation executed, exit 0 |
| Compose development + disposable test startup | Both healthy, PostgreSQL 17.11 query verified; repeat up preserved development service |
| Localhost production-server startup/restart | `/health`, catalogue five entries, auth capabilities, frontend and assets 200; migration versions 1/2/3 retained |
| Localhost browser functional smoke | Guest bench press 10 × 40 kg = 400 kg, offline-ready assets and reload history passed |

Backend machine-readable output: `/tmp/gymbro-stage5-go-tests.jsonl`; guest output: `/tmp/gymbro-stage5-guest-e2e.log` on the current machine (temporary artifacts are not portable repository evidence). Commands/source tests and this report are portable. Test databases are uniquely named disposable gymbro_test_*; no production rollback or data deletion performed.

Five account browser scenarios: opt-in guest import/cross-device history, offline-save/reconnect and no media payload, divergent two-client edit with explicit choice, workout deletion/stale sync/account invalidation preserving guest, and unequal-load merge with original source timestamps through PostgreSQL to another browser. Ordinary build excludes signed fixture harness.

## Menjalankan dan melanjutkan

Lihat localhost-guide.md untuk install/start/Google setup/tests dan prompt Codex CLI. `scripts/start-local.sh`, compose.yaml serta .env.example menyediakan startup satu origin. Go applies versioned migrations; tidak ada AutoMigrate. Data development memakai volume; disposable test database memakai tmpfs. Pemeriksaan ulang startup dilakukan setelah proses cloud berhenti saat jeda; prepared files tetap ada, proses tidak diasumsikan hidup.

Reusable cloud draft telah disimpan dengan install_script/start_skill lengkap dan kebutuhan Google OAuth metadata-only; nilai credential tidak dicetak atau ditulis. Domain tambahan: accounts.google.com, oauth2.googleapis.com, www.googleapis.com. Save draft tidak menjalankan ulang script, menerapkan runtime binding, atau Publish. Pengguna review/save Environment Settings lalu Publish agar snapshot/config menjadi aktif; fresh-task restoration belum diklaim teruji.

## Batas dan task terbuka

Google client ID/secret belum tersedia; real Google login belum diuji. Fixture memakai adapter kriptografis/handler produksi tetapi issuer lokal. Isi credential secara aman di Environment Settings atau .env lokal; jangan kirim secret di chat.

Live testing Chrome/Edge desktop dan Chrome Android dilakukan setelah runnable MVP sesuai instruksi pengguna. Kamera sintetis/replay dan WASM pada blank canvas bukan data akurasi. Corpus >=20 set/gerakan dari >=5 orang, split tuning/evaluation, gate raw >=90% label dan >=90% set dalam satu rep masih terbuka. Kamera beberapa sudut sedang dibahas; jangan mengklaim angle coverage atau moving-camera support tanpa perubahan plan/inference/evaluation.

Task OpenSpec tersisa: 2.5–2.7 (corpus/evaluation/report actual camera), 3.7/6.4 (physical-device smoke/performance) dan 5.4 (real Google end-to-end). Jangan archive change sebagai lengkap. Native iOS/Android, Safari dan VPS/GitHub Actions deployment belum diimplementasikan/diakses; tindak lanjut memakai plan dan validasi tersendiri.
