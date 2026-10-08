# Desain PostgreSQL Gymbro

Status: rancangan untuk migration TDD; database belum dibuat.

## Pembagian schema

| Schema/tabel | Peran dan field utama |
| --- | --- |
| `ref.users` | Master akun: UUID `id`, unique `google_sub`, display name, timestamps |
| `ref.exercises` | Master latihan: UUID, unique slug, nama, equipment/load convention, kemampuan dan versi aturan deteksi |
| `ref.exercise_assets` | Metadata aset: exercise FK, path, MIME, pembuat, lisensi, atribusi, source URL, checksum |
| `public.workouts` | UUID dari perangkat, owner FK, start/finish, durasi, pause duration, status, revision, timestamps/deleted marker |
| `public.workout_exercises` | UUID, workout FK, exercise FK, position, notes, rest target default 120 detik |
| `public.workout_sets` | UUID, workout-exercise FK, position, detected/final reps, rep source, detected exercise, recognition status, load kg, implement count, waktu set/rest |
| `public.auth_sessions` | UUID, user FK, unique token hash, expiry, timestamps |
| `public.sync_mutations` | Composite key user/mutation UUID, request hash, target workout UUID, resulting revision, outcome, processed time |
| `log.workout_events` | Lifecycle sesi/set dan koreksi |
| `log.auth_events` | Aktivitas login/logout tanpa credential/token |
| `log.sync_events` | Attempt, conflict, dan outcome sinkronisasi |

Master dapat berubah; schema `ref` tidak berarti immutable. Sesi login dan idempotensi adalah state operasional, sehingga berada di `public`, bukan log yang dibuang bersama partisi aktivitas.

## Relasi dan konsistensi

`ref.users` → `public.workouts` → `public.workout_exercises` → `public.workout_sets`. Exercise occurrences merujuk `ref.exercises`, yang juga memiliki asset metadata. Latihan yang sama boleh muncul lagi pada posisi berbeda.

Gunakan foreign key qualified lintas schema untuk transaksi/master. Terapkan unique `(workout_id, position)` dan `(workout_exercise_id, position)`, nonnegative reps/load/durations, serta revision monotonik. Setiap nested read/write harus diotorisasi melalui pemilik workout.

Gunakan `NUMERIC(8,3)` untuk kg, UUID untuk ID perangkat, `TIMESTAMPTZ` untuk waktu kejadian, dan integer milliseconds untuk durasi. Beban kosong tetap NULL. `detected_reps`/label asli dipisahkan dari `reps`/jenis latihan final setelah koreksi. Summary dihitung dari set saat ini; volume bilateral = `load_kg × implement_count × reps`. Bodyweight tanpa beban eksternal tidak diperkirakan volumenya; beban belum diisi ditampilkan sebagai data belum lengkap.

Indeks awal: workout per user/waktu mulai, unique posisi nested, session per user/expiry, dan mutation composite primary key. Tambahkan indeks berdasarkan query dan bukti kebutuhan.

## Offline, revisi, dan penghapusan

Guest data berada di browser; login menawarkan import ke owner yang terautentikasi. Mutasi membawa UUID idempotensi, payload hash, dan base revision. Simpan edit aggregate dan outcome mutasi dalam satu transaksi; increment revision atomik. Retry identik mengembalikan outcome sebelumnya, reuse ID dengan payload berbeda ditolak, dan revision mismatch menghasilkan konflik tanpa partial writes. UI meminta pilihan versi.

Penghapusan workout membuang isi latihan/set dan menyisakan tombstone minimal untuk menolak update/recreation UUID lama. Penghapusan akun membatalkan sesi dan menghapus data terkait; perangkat dengan identitas lama tidak boleh mengunggah ulang ke akun baru secara otomatis. Jangan membersihkan tombstone/idempotensi tanpa strategi yang menjamin stale sync tidak membangkitkan data.

## Log yang siap dipartisi

Field bersama: UUID `id`, server `recorded_at TIMESTAMPTZ`, optional original `occurred_at`, event type, nullable actor/workout identifiers, correlation ID, dan metadata JSONB yang dibatasi. Jangan menyimpan secret, token, video/frame/pose stream, atau profil yang tidak diperlukan.

Desain parent log memakai `PARTITION BY RANGE (recorded_at)` bulanan UTC. Primary key `(recorded_at, id)` menyertakan partition key; primary/unique key pada parent partitioned PostgreSQL tidak dapat menjamin unique `id` saja. `occurred_at` dipisahkan agar event offline terlambat masuk partisi waktu penerimaan.

Migration menyiapkan parent, partisi bulan berjalan/berikutnya, dan default partition fallback yang dimonitor. Pemeliharaan membuat partisi lebih awal; pindahkan isi fallback yang overlap dalam transaksi sebelum menambah partisi yang bersangkutan. Uji batas bulan, late arrival, serta drop partisi pada DB disposable. Retention produksi ditetapkan sebelum deployment; drop log tidak boleh memengaruhi public/ref atau idempotensi.

Log tidak menjadi source of truth. Hindari FK log yang memblokir penghapusan akun/workout. Hapus atau anonimisasi identifier aktivitas ketika akun dihapus sesuai desain penghapusan; jangan menyebut aktivitas lama anonim jika metadata masih mengidentifikasi pengguna.

## GORM dan migration

Gunakan `TableName()` qualified, misalnya `ref.exercises` dan `public.workouts`, serta qualified SQL. Jangan mengandalkan `search_path` atau AutoMigrate untuk perubahan produksi. Migration berversi diuji setelah tes integrasi RED dibuat.
