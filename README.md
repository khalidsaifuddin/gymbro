# Gymbro

Rancangan aplikasi workout berbasis kamera: Go clean architecture untuk backend, Expo/React Native Web untuk frontend pertama, lalu iOS/Android. Video diproses di perangkat; backend menyimpan hasil latihan.

Status saat ini: prototipe kamera MediaPipe on-device, mode kamera/log, edit dan merge set, timer, summary, riwayat tamu IndexedDB, recovery, web build offline, rekaman lokal opsional, serta lima SVG original dan panduan pose tersedia. 112 unit tests dan 18 browser tests lulus. Migration/repository PostgreSQL tiga schema dan partisi log tersedia, dengan 15 tes Go/integration/race lulus. API workout, OAuth dan sync akun belum selesai. Live testing/akurasi dilakukan setelah MVP dapat dijalankan dari localhost; deployment dan native menyusul.

## Mulai dari dokumen

- [Implementation plan dan urutan TDD](docs/implementation-plan.md)
- [Plan tahap 1](docs/implementation-stage-1.md), [API domain](docs/domain-api.md), dan [hasil validasi](docs/validation-stage-1.md)
- [Plan prototipe kamera](docs/implementation-stage-2.md), [validasi prototipe](docs/validation-stage-2.md), [lisensi model](docs/model-license.md), dan [protokol evaluasi](docs/recognition-evaluation-protocol.md)
- [Plan UI/persistence/rekaman](docs/implementation-stage-3.md), [validasi tahap 3](docs/validation-stage-3.md), dan [source SVG](frontend/scripts/generate-exercise-guides.mjs)
- [Kebutuhan produk](docs/product-requirements.md)
- [Desain tiga schema PostgreSQL](docs/database-design.md)
- [Plan database](docs/implementation-stage-4.md), [validasi PostgreSQL](docs/validation-stage-4.md), dan [command database](docs/database-operations.md)
- [Aturan kerja](AGENTS.md) dan [glossary](GLOSSARY.md)
- [Proposal OpenSpec](openspec/changes/gymbro-web-mvp/proposal.md), [design](openspec/changes/gymbro-web-mvp/design.md), dan [tasks](openspec/changes/gymbro-web-mvp/tasks.md)
- [Referensi backend](docs/backend-architecture-reference.md), [referensi UI](docs/workout-ui-reference.md), dan [riset animasi](docs/exercise-animation-research.md)

## Tooling perencanaan di cloud

OpenSpec 1.14.1 terpasang pada `/workspace/tools/openspec/bin/openspec`. Dari checkout `/workspace/gymbro`:

```bash
export PATH="/workspace/tools/openspec/bin:$PATH"
export OPENSPEC_TELEMETRY=0
openspec doctor
openspec status --change gymbro-web-mvp
openspec validate gymbro-web-mvp --strict
```

Skill Codex OpenSpec berada di `.agents/skills`. Frontend dapat dijalankan dari `frontend` dengan `EXPO_NO_TELEMETRY=1 npm run web`; aset model/WASM disiapkan otomatis dengan verifikasi checksum. Backend dari `backend` dengan compiler Go 1.27.1 dan `go run .`. Lihat command cache/build dalam `docs/domain-api.md` dan browser tests pada `docs/validation-stage-2.md`. Mulai setiap implementasi dengan plan dan tes perilaku RED; jangan menyamakan tes domain dengan akurasi deteksi kamera.

## Menjalankan web build dari localhost

Dari `frontend`, gunakan Node 24 dan Python yang tersedia:

```bash
npm ci
npm run build:web
python -m http.server 8082 --bind 127.0.0.1 --directory dist
```

Buka localhost port 8082 pada browser mesin yang menjalankan server. Izinkan kamera, pilih profil latihan, atau catat set manual. Tunggu status "Aplikasi dan model siap offline" sebelum memutus koneksi. Hasil disimpan pada browser/origin yang sama; port berbeda memiliki riwayat berbeda. Development Expo memakai port 8081; gunakan port terpisah untuk build agar cache service worker tidak menutupi dev server. Kamera pada alamat remote membutuhkan HTTPS; akses localhost tidak membutuhkan deployment VPS.

Ini runnable milestone lokal, belum seluruh MVP. Uji perangkat dan akurasi menunggu MVP lengkap. Video opt-in menghasilkan file per segmen pause/resume; simpan ke perangkat lalu buang salinan sementara. Reload hanya memulihkan hasil workout. SVG memiliki [lisensi aset CC-BY-4.0](frontend/public/exercises/LICENSE.txt) dengan atribusi Gymbro contributors.
