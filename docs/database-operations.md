# Operasi database lokal dan tes

## Database disposable untuk developer

Docker diperlukan untuk tes PostgreSQL nyata. Image dipin pada digest yang sudah diuji:

```bash
docker pull postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826
docker run --name gymbro-postgres-test --label gymbro.purpose=disposable-integration \
  --publish 127.0.0.1:55432:5432 --env POSTGRES_USER=gymbro_test \
  --env POSTGRES_DB=gymbro_test --env POSTGRES_HOST_AUTH_METHOD=trust \
  --detach postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826
docker exec gymbro-postgres-test pg_isready -U gymbro_test -d gymbro_test
```

Auth trust ini hanya fixture disposable pada loopback, tanpa volume data aplikasi. Jangan menggunakan konfigurasi ini untuk deployment. Jika container fixture milik task sudah ada, start container tersebut; jangan menghapus container/data pengguna untuk menghindari name collision.

Dari `backend` dengan compiler Go 1.27.1:

```bash
export GYMBRO_TEST_DATABASE_URL='postgres://gymbro_test@127.0.0.1:55432/gymbro_test?sslmode=disable'
go test -tags=integration ./...
go test -race -tags=integration ./...
```

Helper menolak host non-loopback atau root database selain `gymbro_test`. Setiap tes membuat database baru dengan nama acak, lalu menghapus hanya database tersebut. URL test tidak diperlukan untuk `go test ./...` tanpa tag; suite itu belum mencakup persistence.

## Migration berversi

`GYMBRO_DATABASE_URL` menunjuk database target. Jangan menaruh credential dalam Git/log. Dari backend:

```bash
go run ./cmd/migrate --operation up
go run ./cmd/migrate --operation status
go run ./cmd/partitions --month 2043-01 --count 2
```

Up repeatable; versi/checksum tercatat di public.schema_migrations. Jangan mengedit SQL migration yang telah diterapkan; buat versi baru. Lima seed katalog/aset awal masuk migration pertama; migration 004 menambah empat latihan cable dan aset, dengan ID stabil dan metadata lisensi/checksum. Maintenance contoh di atas diuji pada database disposable; pada runtime gunakan bulan UTC sekarang/default, dengan current dan next month disiapkan lebih awal.

Partisi default menjaga event saat partisi khusus belum ada. Monitor `SELECT count(*) FROM log.workout_events_default` (dan auth_events_default/sync_events_default); maintenance memindahkan overlap secara atomic. Tidak ada retention deletion otomatis. Jangan menghapus state auth/idempotency saat partisi log kedaluwarsa.

## Rollback khusus database disposable

Command yang sudah diuji pada `gymbro_test_cli_stage4`:

```bash
go run ./cmd/migrate --operation down-disposable --allow-disposable
go run ./cmd/migrate --operation up
```

Runner menolak down pada nama database yang tidak berawalan `gymbro_test_`. Rollback menghapus data database tes. Recovery produksi memakai strategi backup/migration forward yang ditinjau ketika deployment diminta, bukan command ini.

Down migration 004 mempertahankan foreign key: jika workout masih merujuk empat master cable, rollback ditolak dan transaksinya tidak diterapkan. Pengujian reinstall menggunakan DB disposable fresh tanpa referensi workout cable. Untuk database development dengan history, gunakan migration up; jangan menghapus master yang masih dipakai.
