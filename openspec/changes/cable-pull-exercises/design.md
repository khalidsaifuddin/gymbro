# Design

## Context

Baseline fitur kamera ada pada commit 8c6483b, PR #1 belum di-merge. MediaPipe Pose Landmarker dan temporal recognizer memproses landmark lokal. Katalog/validators saat ini memiliki daftar lima gerakan yang tersebar; binding lama hanya menyiapkan occurrence IDs untuk kelimanya.

## Goals / Non-Goals

Goals: sembilan gerakan dengan stable IDs, siklus lengkap dan unknown aman, migration additive serta backward-compatible history/outbox. Non-goals: memastikan attachment/berat dari pose, inference server, dukungan unilateral atau klaim akurasi dari fixture.

## Decisions

Katalog domain menjadi source metadata frontend; tidak bergantung React/DOM. UUID lama tetap sama. Empat varian baru memakai equipment machine, angka kg weight stack dan implement count 1. Snapshot version 1 tetap valid dengan validasi daftar baru yang ketat.

Adapter cable memakai posisi tangan relatif torso/kepala, sudut siku/bahu, serta seated/standing. Kedua sisi relevan harus terlihat dan endpoint bilateral sejalan; sway, missing head untuk face pull, siklus parsial atau posture salah tidak boleh memberi rep. Threshold adalah parameter prototipe. Pola yang juga memenuhi kandidat lain tetap unknown; profil pilihan pengguna dihitung sebagai labelSource profile, bukan raw automatic.

Occurrence IDs bagi gerakan baru ditambahkan secara lazy dalam transaksi sync untuk binding lama. Jangan memodifikasi envelope sending; retry mempertahankan payload identik. Mapper menolak server catalogue tidak dikenal sebelum replacement agar data lokal tidak hilang.

Migration 004 menambah ref master/assets dan tidak mengubah checksum migrations lama. Assets original dibuat dari generator dan metadata source mengacu commit assets yang telah dibuat sebelum migration. Rollback hanya digunakan pada disposable test databases.

## Risks / Trade-offs

- Gerakan berlawanan seperti shoulder press/pulldown dapat memiliki endpoint mirip: uji trajectory/pose negatives, unknown pada ambiguity, dan validasi nyata terpisah.
- Kabel/alat menutupi tangan/kepala: tracking loss menjaga rep terverifikasi dan menyediakan manual.
- Kamera tetap membatasi sudut per latihan: panduan tidak mengubah posisi ketika sesi aktif.
- Client lama belum mengenal gerakan baru: error eksplisit tanpa silent cache overwrite; update aplikasi diperlukan.

## Migration Plan

TDD dahulu sesuai implementation-stage-8. Tambah seed setelah assets source commit tersedia, uji fresh/upgrade/rollback disposable, lalu unit/type/build/Go integration/race/browser. Deployment dan live corpus terpisah; gunakan branch/PR baru.
