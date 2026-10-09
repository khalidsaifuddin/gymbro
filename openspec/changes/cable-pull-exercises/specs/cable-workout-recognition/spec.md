# Spec Delta

## ADDED Requirements

### Requirement: Four bilateral cable exercises

Aplikasi SHALL menambah lat pulldown ke depan dada, seated cable row, rope face pull dan straight-arm cable pulldown bilateral. Satu siklus penuh kedua tangan bersama SHALL menghasilkan satu rep. Behind-the-neck, unilateral dan chest-supported machine row tidak termasuk batch ini.

#### Scenario: Complete cycle
- **WHEN** pengguna melakukan ready, peak dan ready yang stabil dengan posture serta sendi relevan terlihat
- **THEN** satu rep ditambahkan pada latihan yang sesuai

#### Scenario: Incomplete or unilateral motion
- **WHEN** siklus parsial atau hanya satu tangan mencapai endpoint
- **THEN** tidak ada rep otomatis dan pengguna dapat mencatat manual

### Requirement: Recognition ambiguity and interruptions

Aplikasi SHALL memakai pola gerak, posture dan posisi tangan untuk kandidat; pilihan profil SHALL tidak menjadi raw automatic label. Sinyal ambigu/missing landmarks SHALL menghentikan hitungan serta penutupan set otomatis, mempertahankan rep terverifikasi dan membuang siklus terputus.

#### Scenario: Confusable patterns
- **WHEN** lebih dari satu kandidat latihan memenuhi siklus atau pola tidak cukup meyakinkan
- **THEN** status unknown ditampilkan dengan pilihan profil/manual

#### Scenario: Face hidden during face pull
- **WHEN** landmark kepala yang diperlukan tidak terlihat
- **THEN** hitungan otomatis face pull berhenti tanpa membuang rep terverifikasi

### Requirement: Catalogue and durable compatibility

Frontend/API SHALL menyediakan sembilan gerakan dengan UUID lima gerakan lama tetap. Data lama SHALL tetap terbaca; binding lama SHALL memperoleh occurrence ID baru tanpa mengubah mutasi sending. Gerakan tidak dikenal SHALL tidak menyebabkan replacement cache lokal diam-diam.

#### Scenario: Add cable exercise to an old binding
- **WHEN** workout dengan binding dari katalog lima gerakan mendapat set cable baru
- **THEN** occurrence ID stabil tersedia untuk mutasi berikutnya dan retry in-flight tetap identik

#### Scenario: Catalogue mismatch
- **WHEN** versi server mengandung gerakan yang tidak dikenal client
- **THEN** replacement ditolak dan data lokal sebelumnya tetap ada

### Requirement: Cable load and additive reference migration

Beban SHALL dicatat sebagai kg satu weight stack dengan implement count 1. Migration baru SHALL menambah master/assets di ref tanpa mengubah migrations lama atau data public/log sebelumnya. Empat SVG animasi dan pose original SHALL memiliki source, checksum, lisensi CC-BY-4.0 dan atribusi.

#### Scenario: One stack operated by both hands
- **WHEN** pengguna mencatat 10 reps dengan weight stack 40 kg
- **THEN** volume diketahui adalah 400 kg

#### Scenario: Upgrade existing database
- **WHEN** migration baru dijalankan pada DB yang sudah berisi hasil workout
- **THEN** katalog menjadi sembilan dan workout, session serta revisi lama tetap tersedia

### Requirement: Evidence before claiming real accuracy

Klaim otomatis SHALL dievaluasi per latihan dan kondisi kamera: ≥90% label benar serta ≥90% set error maksimal satu rep, minimal 20 set dari ≥5 orang dengan tuning/evaluation terpisah. Unknown SHALL dihitung sebagai kegagalan label dan koreksi tidak memperbaiki skor otomatis.

#### Scenario: Synthetic validation
- **WHEN** unit/browser memakai fixture landmark
- **THEN** laporan membedakan bukti logika dari akurasi nyata yang belum diuji
