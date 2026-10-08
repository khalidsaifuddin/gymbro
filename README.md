# Gymbro

Rancangan aplikasi workout berbasis kamera: Go clean architecture untuk backend, Expo/React Native Web untuk frontend pertama, lalu iOS/Android. Video diproses di perangkat; backend menyimpan hasil latihan.

Status: implementasi web runnable dengan deteksi MediaPipe lokal, mode kamera/log, koreksi/merge, summary, IndexedDB/recovery, cache offline, video opsional lokal, lima SVG, PostgreSQL tiga schema, API, dan durable sync akun. Login Google eksternal memerlukan konfigurasi OAuth; test akun memakai issuer fixture bertanda tangan dan PostgreSQL nyata. Live testing/akurasi dilakukan setelah MVP runnable localhost; deployment/native menyusul. Lihat laporan validasi tahap 5 untuk batas bukti.

Panduan instalasi, startup, OAuth, tes, dan kelanjutan Codex CLI: [localhost-guide.md](docs/localhost-guide.md).

## Mulai dari dokumen

- [Implementation plan dan urutan TDD](docs/implementation-plan.md)
- [Plan tahap 1](docs/implementation-stage-1.md), [API domain](docs/domain-api.md), dan [hasil validasi](docs/validation-stage-1.md)
- [Plan prototipe kamera](docs/implementation-stage-2.md), [validasi prototipe](docs/validation-stage-2.md), [lisensi model](docs/model-license.md), dan [protokol evaluasi](docs/recognition-evaluation-protocol.md)
- [Plan UI/persistence/rekaman](docs/implementation-stage-3.md), [validasi tahap 3](docs/validation-stage-3.md), dan [source SVG](frontend/scripts/generate-exercise-guides.mjs)
- [Kebutuhan produk](docs/product-requirements.md)
- [Desain tiga schema PostgreSQL](docs/database-design.md)
- [Plan database](docs/implementation-stage-4.md), [validasi PostgreSQL](docs/validation-stage-4.md), dan [command database](docs/database-operations.md)
- [Plan API/auth/sync](docs/implementation-stage-5.md), [plan integrasi](docs/implementation-stage-6.md), dan [validasi](docs/validation-stage-5.md)
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

Skill Codex OpenSpec berada di `.agents/skills`. Frontend dapat dijalankan dari `frontend` dengan `EXPO_NO_TELEMETRY=1 npm run web`; aset model/WASM disiapkan otomatis dengan verifikasi checksum. Backend memakai compiler Go 1.27.1; jalankan dari root dengan script localhost setelah PostgreSQL tersedia. Lihat command cache/build dalam `docs/domain-api.md` dan browser tests pada `docs/validation-stage-2.md`. Mulai setiap implementasi dengan plan dan tes perilaku RED; jangan menyamakan tes domain dengan akurasi deteksi kamera.

## Menjalankan aplikasi dari localhost

Gunakan Node 24, Go 1.27.1, dan Docker Compose v2. Dari root repo:

```bash
npm --prefix frontend ci
npm --prefix frontend run build:web
docker compose up -d --wait db
bash scripts/start-local.sh
```

Buka localhost port 8080. Go menyajikan frontend dan API pada origin yang sama, dengan PostgreSQL pada loopback port 54329. Guest tidak memerlukan Google credential. `.env.example` menyediakan konfigurasi lokal; isi credential nyata hanya di `.env` yang diabaikan Git. Rincian dan command tes ada pada [panduan localhost](docs/localhost-guide.md).

Tunggu "Aplikasi dan model siap offline" sebelum memutus jaringan. Hasil tamu disimpan pada browser/origin yang sama; port berbeda memiliki riwayat berbeda. Video opt-in menghasilkan file per segmen pause/resume; simpan ke perangkat lalu buang salinan sementara. Reload hanya memulihkan hasil workout. SVG memiliki [lisensi aset CC-BY-4.0](frontend/public/exercises/LICENSE.txt).
