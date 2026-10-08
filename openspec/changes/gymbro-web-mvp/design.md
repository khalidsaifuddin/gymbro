# Design

## Context

Repository saat ini berisi dokumen dan tooling OpenSpec, tanpa aplikasi, dependency manifests, migration, atau tes. Lihat proposal untuk motivasi dan `docs/product-requirements.md` untuk keputusan produk. Referensi backend Widyaprada sudah diperiksa; screenshot Hevy menjadi referensi interaksi. Hasil riset belum menemukan paket animasi lengkap dengan lisensi media yang terverifikasi.

## Goals / Non-Goals

**Goals:** core workout deterministik tanpa DOM, adapter kamera/model yang dapat diganti, API berlapis, penyimpanan lintas schema dengan transaksi konsisten, serta bukti TDD dan akurasi yang dapat ditelusuri.

**Non-Goals:** inferensi server, arsip video/pose, event sourcing workout, Redis, dan menyatakan model akurat berdasarkan tes unit atau animasi demonstrasi.

## Decisions

### Frontend dan domain

Gunakan Expo/React Native Web dibanding frontend web terpisah agar komponen/domain dapat dipakai kembali pada mobile. Tempatkan kamera `getUserMedia`, recorder, penyimpanan IndexedDB, cache/service worker, dan inference worker di adapter web. Gunakan TypeScript domain tanpa DOM serta clock injeksi untuk tes deterministik. UI kamera dan tabel set ala Hevy mengakses satu aggregate sesi, bukan dua sumber hitungan.

Pilihan minor yang dapat diubah tanpa mengganti kebutuhan: total durasi workout menghitung waktu sesi aktif termasuk istirahat tetapi mengecualikan pause/background eksplisit; simpan paused duration terpisah. Batas quiet-time 15 detik tidak maju saat tracking invalid; setelah tracking kembali, mulai jendela valid baru agar occlusion tidak menutup set. Istirahat diukur dari akhir rep terakhir hingga awal set berikutnya, dengan pause eksplisit dicatat terpisah.

### Pengenalan dan hitungan

Mulai prototipe dengan MediaPipe Pose Landmarker, dibanding mengunggah video atau langsung melatih classifier besar. Verifikasi lisensi/checksum distribusi, lalu pin model/tool versi pada implementation plan sebelum instalasi. Inference worker menghasilkan keypoints, confidence, dan timestamp lokal; temporal classifier serta state machine menghitung siklus lengkap dengan smoothing/hysteresis. Threshold dan model ini kandidat yang harus diuji, bukan capability yang sudah terbukti.

Pisahkan raw prediction dari exercise pilihan pengguna. Poor visibility/ambiguous class menghasilkan unknown dan pilihan manual; cycle terputus tidak dihitung. Gunakan orientation torso, fase sendi, serta konteks gerak untuk kandidat; pose tubuh saja belum dapat memastikan mesin versus dumbbell. Jika target lima gerakan gagal, laporkan hasil dan perbaiki prototipe sebelum mengklaim dukungan otomatis, tanpa diam-diam menghapus latihan dari scope.

Evaluasi menggunakan contoh workout berlabel yang berizin dengan tuning/evaluation terpisah. Simpan manifest label dan hasil metrik, bukan mengunggah kamera pengguna ke server. Synthetic keypoint fixtures berguna untuk logika tetapi tidak menggantikan ≥20 set/gerakan dari ≥5 orang pada uji nyata.

### Backend dan persistence

Gunakan layout `backend/core/entity`, `core/repository`, `core/usecase/<fitur>`, `handler/api/<fitur>`, `repository/<fitur>-repo`, `config`, `pkg`, serta composition root. Constructor injection dan interface berada di core; Gin/GORM hanya adapter. REST/JSON mengirim hasil workout, tidak menerima video.

PostgreSQL dipilih dibanding SQLite untuk transaksi concurrent, lintas perangkat, FK lintas schema, dan partisi. Migration berversi menggantikan AutoMigrate sebagai source of truth. Desain tabel, field, constraint, dan partition semantics ada di `docs/database-design.md`: master `ref`, transaksi/state `public`, aktivitas `log`. Identitas dan beban memakai UUID/NUMERIC; summary berasal dari set final.

### Kontrak API dan sinkronisasi

Rancangan endpoint: katalog `GET /api/v1/exercises`; list/detail riwayat `GET /api/v1/workouts[/:id]`; aggregate mutation `POST /api/v1/workout-mutations`; auth start/callback/logout/current-user; dan account deletion. Payload mutasi berisi `mutation_id`, `workout_id`, `base_revision`, operasi, dan aggregate result. Owner berasal dari sesi server, bukan owner yang dikirim client.

Gunakan durable outbox IndexedDB, dibanding retry in-memory yang hilang setelah reload. Server menjalankan revision comparison, edit aggregate, dan pencatatan outcome idempotensi dalam satu transaksi. Request hash membedakan retry identik dari reuse ID yang berbeda isi. Konflik revisi merespons 409 tanpa partial writes; client menampilkan versi lokal/server untuk dipilih dan mengirim mutasi baru sesuai revision yang dipilih. Creation duplikat atau target terhapus ditolak; tombstone menahan stale replay. Account deletion membatalkan seluruh sesi dan membersihkan data/idempotency terkait.

### Autentikasi

Web memakai Google OIDC/OAuth backend flow dengan state/nonce dan PKCE sesuai flow resmi, identity verification server-side, lalu session cookie HttpOnly/Secure/SameSite yang sesuai dan CSRF protection untuk mutations. Dibanding menyimpan bearer token di localStorage, session token hash di `public.auth_sessions` membatasi paparan script. OAuth access token tidak diarsipkan. Native transport ditentukan ketika platform mobile dikerjakan.

OAuth credentials, callback HTTPS, dan binding yang sudah tersedia harus diperiksa sebelum meminta nilai baru; jangan meminta secret di chat. API lokal tanpa credential hanya memvalidasi domain/persistence dan kasus auth rejection, bukan login Google end-to-end.

### Activity logs dan partisi

Gunakan monthly UTC RANGE partition `recorded_at` pada `log.workout_events`, `auth_events`, dan `sync_events`, dengan key `(recorded_at,id)` serta `occurred_at` terpisah. Dibanding tabel monolitik, ini memungkinkan retention terkelola tanpa menghapus business state. Idempotensi tetap di `public.sync_mutations`.

Migration menyiapkan bulan ini/berikutnya dan default fallback. Job pemeliharaan membuat partisi lebih awal, memindahkan rows fallback yang overlap secara transaksional, dan memonitor fallback/errors. Mutation yang perlu activity event ditulis bersama transaksi atau durable event handoff yang teruji; jangan mengklaim pencatatan berhasil jika write gagal. Logs tidak menyimpan secret/media, dan identifiers/metadata personal dibersihkan saat account deletion. Retention produksi tidak diberlakukan sebelum kebijakannya ditetapkan.

### Animasi dan perekaman

SVG original tersedia sebagai source serta metadata CC-BY-4.0 yang terpisah dari lisensi kode. Dibanding media pihak ketiga yang provenance-nya belum lengkap, aset original memberikan kontrol distribusi. Animasi memandu gerak, tidak melatih atau membuktikan model otomatis.

MediaRecorder hanya diaktifkan sebelum workout bila pengguna memilih. Pause/background menjeda recorder; save/discard menghasilkan atau melepas Blob lokal. Beri status error pada unsupported MIME/recorder dan jangan menjanjikan recovery video setelah reload. Catatan workout tetap disimpan independen dari Blob video.

## Risks / Trade-offs

- [Pose tidak membedakan alat atau tubuh tertutup bench/mesin] → unknown/manual fallback, panduan kamera, dan gate akurasi per gerakan sebelum rilis kemampuan otomatis.
- [CPU/memori/performa perangkat] → worker, sampling adaptif, uji Chrome Android/desktop nyata; jangan menentukan klaim FPS tanpa pengukuran.
- [Cache/model belum tersedia saat offline] → koneksi diperlukan pada pemakaian pertama, verifikasi model cached sebelum sesi; tampilkan status capability yang benar.
- [Data lokal hilang saat browser dibersihkan] → jelaskan batas data tamu dan tawarkan import akun, tanpa upload video.
- [Retry, conflict, atau stale deletion] → transactional idempotensi/revision, tombstone, integration tests PostgreSQL dan simulasi dua perangkat.
- [Partition gap atau retention salah] → fallback yang dipantau, scheduler, tes batas bulan, dan pemisahan logs dari auth/idempotency.

## Migration Plan

Greenfield: tulis implementation plan tahap pertama, siapkan RED tests, lalu scaffold dan dependencies pinned. Buat schema/master/transactions/log parents lewat migrations yang dapat diuji pada DB disposable; seed kelima gerakan secara repeatable. Bangun prototipe deteksi dan UI, lalu integrasi API/auth/sync sesuai task TDD.

Fresh-install dan rollback hanya diuji pada DB test. Rollout produksi memerlukan HTTPS, backup/migration review, OAuth configuration, dan validation gates. Jangan memakai rollback destruktif sebagai pemulihan data pengguna; gunakan migration forward ketika data produksi sudah ada.

## Open Questions

- Versi final model dan threshold akan dipin berdasarkan prototipe, tanpa mengubah daftar latihan atau gate penerimaan.
- Retention aktivitas produksi, hosting/HTTPS callback, serta nilai OAuth ditentukan pada tahap deployment. Pertahankan data dan jangan aktifkan cleanup otomatis sampai keputusan itu tersedia.
