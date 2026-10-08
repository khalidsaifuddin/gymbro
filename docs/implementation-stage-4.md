# Implementation plan tahap 4: PostgreSQL tiga schema

## Cakupan, pins dan database tes

Backend mengikuti `backend-architecture-reference.md`: core entity/repository tanpa Gin/GORM, adapter repository dengan nama tabel qualified, dan migrations berversi (tanpa AutoMigrate). Versi registry diverifikasi sebelum plan: GORM **v1.31.2**, driver PostgreSQL **v1.6.3**; UUID **github.com/google/uuid v1.6.0**. Go 1.27.1 tetap dipin. Driver memasang pgx **v5.10.0** dan transitive pins dalam go.sum. Image PostgreSQL resmi yang telah diunduh dan diuji: **17.11**, `postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826` (linux amd64).

Database disposable `gymbro-postgres-test` berjalan di loopback 55432 dengan user/database `gymbro_test`, auth trust khusus lingkungan tes dan tanpa volume produksi. `pg_isready` dan query `SELECT version()` berhasil. Test helper membuat database terpisah bernama `gymbro_test_<random>` per skenario, lalu cleanup hanya database tersebut. Tolak konfigurasi yang bukan database tes.

## Urutan TDD dan file

1. RED migration integration (`pkg/migration`): fresh schema, FK/check/unique constraints, jenis NUMERIC(8,3), seed kelima latihan/asset metadata berulang. Scaffold fungsi runner kosong bila diperlukan untuk mencapai failure perilaku SQL, bukan berhenti pada compile failure saja.
2. GREEN: SQL up/down embedded/versioned, ledger `public.schema_migrations`, transaksi dan advisory lock untuk concurrent runner. Seed katalog dan metadata aset original dengan ID stabil serta checksum dari source. `ref.users/exercises/exercise_assets`; `public.workouts/workout_exercises/workout_sets/auth_sessions/sync_mutations`. Tabel memiliki indexes/constraints yang ditulis di database-design; auth/idempotensi tidak masuk log.
3. RED repository aggregate: owner-scoped read/list/edit, atomic rollback nested ID collision/invalid data, decimal load roundtrip, raw reps/provenance merge utuh. Core `entity`, kontrak `repository`, GORM DTO di adapter `repository/workout-repo`; core validation selalu sebelum write.
4. GREEN/REFACTOR: repository transaction mengunci parent workout, membandingkan base revision, mengganti isi aggregate tanpa mengambil ID nested milik workout lain, tombstone minimal untuk deletion. Simpan final dan raw hasil terpisah; summary dihitung dari hasil set saat ini. Protocol mutation idempotensi/user auth tetap tahap 5.
5. RED log integration: parents PARTITION BY RANGE(recorded_at), PK(recorded_at,id), current/next UTC month + default fallback, insertion pada batas bulan dan late offline occurred_at, fallback ketika partisi khusus belum ada, maintenance memindahkan overlap dan expiry isolation dari master/state.
6. GREEN/REFACTOR: migration log dan helper maintenance dengan identifier whitelist/quoted generated names, UTC boundaries dan lock/table migration transaction. Metadata dibatasi tipe/keys yang aman, tanpa token/media. Tidak otomatis menerapkan retention produksi.
7. CLI `cmd/migrate` up/status/down (down hanya database disposable secara eksplisit), `cmd/partitions` maintenance. Dokumentasikan run, seed repeatability, rollback tests dan setup cloud berdasarkan command yang benar-benar diuji.

## Acceptance dan command

Semua table/schema names di SQL/GORM qualified; test search_path tidak dipakai sebagai jalan pintas. Negative SQL tests memakai transaksi/savepoint atau fresh connection sehingga satu constraint failure tidak merusak assertion selanjutnya. Test database per skenario memastikan isolasi, termasuk race/concurrency.

Dari backend, aktivasi compiler resmi `/workspace/tools/golang/go/bin` dan cache workspace. Jalankan `go test ./...`, `GYMBRO_TEST_DATABASE_URL=postgres://gymbro_test@127.0.0.1:55432/gymbro_test?sslmode=disable go test -tags=integration ./...`, `go test -race -tags=integration ./...` dengan URL tes yang sama, `go build ./...`. Tes integrasi tanpa konfigurasi tes sah harus gagal jelas, jangan mengklaim skipped/empty sebagai pass. Fresh migration/seed/partition/rollback command diuji hanya pada database tes terpisah.

Review dan push milestone langsung main setelah GREEN dan checks. API/auth/outbox dilanjutkan lewat plan tahap 5. Live testing kamera/perangkat tetap setelah MVP runnable localhost, sesuai instruksi pengguna.
