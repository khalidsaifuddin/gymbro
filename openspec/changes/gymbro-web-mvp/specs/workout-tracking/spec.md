# Spec Delta

## Purpose

Memungkinkan pengguna memantau dan mengoreksi latihan selama sesi serta memperoleh ringkasan workout yang konsisten.

## ADDED Requirements

### Requirement: Complete repetitions

Aplikasi SHALL menghitung satu repetisi untuk satu siklus lengkap. Siklus parsial atau terputus tidak dihitung. Curl otomatis MVP hanya mendukung kedua tangan bergerak bersamaan sebagai satu rep.

#### Scenario: Complete and partial movement
- **WHEN** pengguna melakukan dua siklus lengkap dan satu siklus parsial
- **THEN** hitungan otomatis bertambah dua repetisi

#### Scenario: Bilateral curl
- **WHEN** kedua tangan menyelesaikan satu siklus curl bersama
- **THEN** hitungan bertambah satu, bukan dua

#### Scenario: Alternating curl
- **WHEN** pengguna melakukan curl bergantian atau unilateral
- **THEN** aplikasi menawarkan pencatatan manual dan tidak mengklaim hitungan otomatis didukung

### Requirement: Set boundaries and corrections

Aplikasi SHALL menutup set setelah 15 detik tanpa repetisi dalam kondisi pelacakan valid, serta menyediakan selesai set manual, koreksi repetisi, dan penggabungan set yang terpisah keliru.

#### Scenario: Automatic boundary
- **WHEN** pelacakan valid dan 15 detik berlalu tanpa repetisi setelah set aktif
- **THEN** set ditutup tanpa menambah repetisi

#### Scenario: Correct and merge
- **WHEN** pengguna mengoreksi hitungan dan menggabungkan dua set latihan yang sama
- **THEN** log dan summary memakai hasil koreksi tanpa menggandakan data, serta hasil otomatis asli tetap terpisah

### Requirement: Rest timing

Aplikasi SHALL menghitung istirahat sejak akhir repetisi terakhir hingga awal set berikutnya, dengan target default 120 detik yang dapat diubah per latihan dan tidak menghalangi pengguna mulai lebih cepat.

#### Scenario: Early next set
- **WHEN** set berakhir pada detik 30 dan set berikutnya mulai pada detik 80 sebelum target istirahat habis
- **THEN** istirahat tercatat 50 detik dan set berikutnya boleh berjalan

### Requirement: Load and volume

Aplikasi SHALL menggunakan kg dengan barbell termasuk batang, dumbbell per alat, dan mesin sesuai angka pilihan. Volume menggunakan total beban eksternal × reps; bodyweight dan beban kosong tidak diperkirakan sebagai berat tubuh atau nol yang diketahui.

#### Scenario: Two dumbbells
- **WHEN** pengguna mencatat dua dumbbell masing-masing 10 kg dan 10 rep bilateral
- **THEN** volume tercatat 200 kg dan label input menjelaskan berat per dumbbell

#### Scenario: Bodyweight and missing load
- **WHEN** workout berisi bodyweight atau set berbeban yang beratnya belum diisi
- **THEN** bodyweight ditampilkan lewat set/reps dan beban yang hilang ditandai belum lengkap tanpa estimasi volume

### Requirement: Active workout controls and summary

Aplikasi SHALL menampilkan kamera, gerakan, set/reps yang terbaca dari jarak kamera, timer istirahat, peringatan posisi, pause, dan selesai. Summary memuat latihan, reps per set, beban, total set/reps, durasi workout, dan istirahat.

#### Scenario: Finish corrected session
- **WHEN** pengguna menyelesaikan sesi setelah mengoreksi set
- **THEN** summary mencerminkan set final yang sama dengan log dan tidak menyajikan estimasi kalori atau skor teknik

### Requirement: Pause and background

Aplikasi SHALL menjeda deteksi saat pause atau masuk background dan tidak menghitung gerakan selama jeda. Pengguna dapat melanjutkan dari hitungan terverifikasi terakhir.

#### Scenario: Background during a repetition
- **WHEN** aplikasi masuk background di tengah siklus dan pengguna kembali
- **THEN** siklus terputus dibuang, jumlah rep sebelumnya dipertahankan, dan hitungan baru dimulai dari siklus valid berikutnya
