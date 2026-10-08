# Validasi tahap 4: PostgreSQL tiga schema

## Bukti RED/GREEN

- Migration RED pada database nyata: fresh schema/constraints gagal karena `ref.users` belum ada. Runner scaffold tidak melakukan SQL. GREEN: empat integration tests untuk schema/FK/unique/check, NUMERIC(8,3), seed berulang, rollback/reinstall, serta UTC routing pada session timezone America/New_York.
- Repository RED: empat skenario gagal dengan repository belum diimplementasikan. GREEN: owner isolation, update revision, nested exercise/set UUID collision rollback, decimal roundtrip, merged provenance dan tombstone.
- Read consistency RED: edit tercommit di antara header/nested queries menghasilkan revision 1 dengan reps dari revision 2. GREEN: read/list memakai satu transaksi read-only REPEATABLE READ. Test memakai write PostgreSQL bersamaan, bukan database mock.
- Log RED: empat skenario gagal karena parent/partisi belum tersedia dan unsafe metadata belum ditolak. GREEN: batas bulan UTC, original occurred_at offline, fallback, pemindahan overlap tanpa hilang/duplikat, serta drop log tidak menghapus master/auth/idempotensi.
- UTC startup RED: timezone non-UTC menghasilkan nama partisi bulan yang sama dua kali. GREEN: aritmetika bulan dilakukan pada timestamp UTC sebelum cast timestamptz; current/next/default dan routing batas bulan teruji.
- Atomic log RED: activity workout.created belum ditulis. GREEN: workout dan activity berada dalam satu transaksi; constraint yang sengaja menolak activity update membuat seluruh edit workout rollback.

## Hasil aktual

**15 tes Go dengan integration tag dan race detector lulus, 0 failed, 0 skipped**: satu health test, empat migration, empat activity, enam repository. Paket tanpa test dilaporkan terpisah oleh runner; tidak dihitung sebagai tes perilaku. `go test ./...` tanpa tag menjalankan health test; persistence memerlukan `-tags=integration` dan URL database tes sah. `go build ./...` lulus.

Database: PostgreSQL 17.11 image official digest `sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826`, loopback 55432. Setiap scenario memakai database `gymbro_test_<UUID>` baru dan cleanup. Tidak memakai SQLite atau mocked database sebagai bukti persistence/concurrency.

CLI diuji pada database tersendiri `gymbro_test_cli_stage4`: up dua kali, status (versions 1/2), maintenance Januari/Februari 2043 dua kali, down-disposable dengan explicit flag, lalu up lagi. Semua command berhasil. Rollback hanya diizinkan pada database isolated dengan prefix `gymbro_test_`; tidak digunakan untuk data pengguna.

## Implementasi

`ref` master users/exercises/assets; `public` workouts/nested sets/auth_sessions/sync_mutations serta ledger schema_migrations; `log` tiga parent bulanan UTC dengan composite PK(recorded_at,id), current/next/default. Tabel GORM/SQL qualified, core tidak mengimpor Gin/GORM, AutoMigrate tidak dipakai. Migration memiliki checksum ledger dan advisory lock. Seed lima aset menyimpan checksum SVG serta source commit b26f16d.

Beban core berupa decimal string (maksimum tiga desimal), SQL NUMERIC(8,3), summary dihitung dari final reps/provenance memakai integer milli-kg dan big.Int agar tidak overflow volume. NULL tetap unknown; aturan bodyweight diambil dari master equipment, bukan UUID yang dihardcode. Raw detected reps/label disimpan terpisah. Snapshot read konsisten dan log failure menggagalkan business write.

Metadata activity hanya keys dan enum yang diizinkan, tanpa media/token/profile. Operational auth/idempotency tidak bergantung pada retention log. Maintenance memindahkan baris overlap default dalam transaksi dengan table lock sebelum attach partition; belum ada deletion retention otomatis. Kebijakan retention produksi tetap tahap deployment.

API workout, Google login, authenticated outbox/import/conflict/delete akun dan integrasi browser belum selesai pada milestone ini. Nilai OAuth dan live testing perangkat belum tersedia; live testing dilakukan setelah MVP runnable localhost sesuai instruksi pengguna.
