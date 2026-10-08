# Gymbro

Rancangan aplikasi workout berbasis kamera: Go clean architecture untuk backend, Expo/React Native Web untuk frontend pertama, lalu iOS/Android. Video diproses di perangkat; backend menyimpan hasil latihan.

Status saat ini: fondasi Expo/React Native Web dan server Go/Gin tersedia, dengan domain workout yang lulus 34 tes TDD. Build web dan race test backend lulus. Kamera/model, UI workout lengkap, database, OAuth, animasi, dan deployment belum tersedia.

## Mulai dari dokumen

- [Implementation plan dan urutan TDD](docs/implementation-plan.md)
- [Plan tahap 1](docs/implementation-stage-1.md), [API domain](docs/domain-api.md), dan [hasil validasi](docs/validation-stage-1.md)
- [Kebutuhan produk](docs/product-requirements.md)
- [Desain tiga schema PostgreSQL](docs/database-design.md)
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

Skill Codex OpenSpec berada di `.agents/skills`. Frontend dapat dijalankan dari `frontend` dengan `EXPO_NO_TELEMETRY=1 npm run web`; backend dari `backend` dengan compiler Go 1.27.1 dan `go run .`. Lihat command cache/build dalam `docs/domain-api.md`. Mulai setiap implementasi dengan plan dan tes perilaku RED; jangan menyamakan tes domain dengan akurasi deteksi kamera.
