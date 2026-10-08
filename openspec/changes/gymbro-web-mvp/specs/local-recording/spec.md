# Spec Delta

## Purpose

Memberikan pilihan rekaman workout lokal tanpa menjadikan penyimpanan video syarat deteksi atau riwayat latihan.

## ADDED Requirements

### Requirement: Explicit recording opt-in

Aplikasi SHALL mematikan perekaman secara default dan meminta pengguna mengaktifkannya sebelum workout. Deteksi dan hasil workout tetap tersedia tanpa merekam video.

#### Scenario: Default session
- **WHEN** pengguna memulai workout tanpa mengaktifkan perekaman
- **THEN** deteksi berjalan tanpa membuat rekaman video untuk disimpan

### Requirement: Device-only save or discard

Aplikasi SHALL menawarkan simpan ke perangkat atau buang setelah rekaman selesai. Video tidak diunggah ke backend; membuang rekaman tidak menghapus hasil workout.

#### Scenario: Discard recording
- **WHEN** pengguna memilih buang pada akhir sesi yang direkam
- **THEN** video sementara dilepas dan hasil workout tetap dapat disimpan

#### Scenario: Save recording
- **WHEN** pengguna memilih simpan
- **THEN** aplikasi menawarkan file video lokal dan tidak mengirim isi video ke server

### Requirement: Recording interruption

Aplikasi SHALL menjeda rekaman saat pause/background, menjelaskan kegagalan kemampuan perekaman browser, dan tidak menjanjikan pemulihan file video setelah reload.

#### Scenario: Reload during recording
- **WHEN** halaman direload saat sesi direkam
- **THEN** catatan workout dapat dipulihkan tetapi UI tidak mengklaim video sebelumnya berhasil dipulihkan tanpa bukti file tersedia

#### Scenario: Unsupported recorder
- **WHEN** browser tidak mendukung format atau kemampuan perekaman yang dibutuhkan
- **THEN** aplikasi memberi pesan dan pengguna tetap dapat workout tanpa rekaman
