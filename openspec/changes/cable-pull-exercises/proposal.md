# Proposal

## Why

Gymbro baru memiliki lima gerakan. Pengguna memilih empat latihan cable bilateral untuk memperluas pencatatan punggung/bahu sambil mempertahankan deteksi di perangkat, posisi kamera tetap dan workflow workout yang sama.

## What Changes

- Tambah lat pulldown ke dada, seated cable row, rope face pull dan straight-arm cable pulldown; satu siklus kedua tangan bersama menghasilkan satu rep.
- Tambah fitur temporal serta unknown/manual untuk gerakan ambigu, tanpa menganggap alat/berat dapat dipastikan dari pose.
- Katalog sembilan gerakan, panduan/SVG original, kompatibilitas data lokal/binding lama, dan seed migration baru pada ref.
- Uji TDD domain, deteksi, PostgreSQL dan browser; akurasi nyata tetap gate tersendiri.

## Capabilities

### New Capabilities

- `cable-workout-recognition`: pengenalan, hitungan bilateral, panduan dan persistence empat latihan cable.

### Modified Capabilities

Tidak mengganti kebutuhan lima gerakan pada change MVP yang masih aktif; menambah empat kandidat dengan aturan umum workout yang sama.

## Impact

Frontend katalog/domain/recognition/assets/storage/sync, migration ref/exercises/assets, dan tes API/browser. Dependensi fitur posisi kamera pada PR #1; branch/PR baru memakai base branch tersebut selama belum di-merge. Tidak mengubah public/log schema atau mengunggah media. Lihat docs/implementation-stage-8.md.
