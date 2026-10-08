# Spec Delta

## Purpose

Menghubungkan pengguna ke riwayat akun melalui identitas Google yang terverifikasi dan memastikan data workout hanya dapat diakses pemiliknya.

## ADDED Requirements

### Requirement: Verified Google login

Backend SHALL memvalidasi identitas Google sebelum membuat sesi akun. Identitas yang tidak valid atau sesi kedaluwarsa tidak memberikan akses riwayat akun; workout tamu tetap tersedia.

#### Scenario: Invalid identity
- **WHEN** permintaan login berisi identitas Google tidak valid
- **THEN** sesi akun tidak diterbitkan dan data akun tidak dibuka

#### Scenario: Expired session while offline results wait
- **WHEN** sesi kedaluwarsa sebelum hasil lokal disinkronkan
- **THEN** pengguna diminta login kembali dan hasil lokal tetap dipertahankan

### Requirement: Owner isolation

Backend SHALL membatasi seluruh operasi workout, latihan/set nested, dan riwayat ke pengguna terautentikasi yang memilikinya.

#### Scenario: Another user requests a set
- **WHEN** pengguna mengirim UUID set atau workout milik akun lain
- **THEN** akses baca/edit/delete ditolak tanpa membocorkan isi workout

### Requirement: Secure session handling

Sistem SHALL melindungi sesi dari akses script dan pemalsuan permintaan, serta tidak menyimpan token sesi plaintext di database atau log aktivitas.

#### Scenario: Forged mutation
- **WHEN** perubahan data dikirim dengan sesi atau perlindungan request yang tidak sah
- **THEN** server menolak perubahan tanpa mengubah hasil workout

### Requirement: Account deletion

Aplikasi SHALL memungkinkan pengguna menghapus akun serta data server terkait, membatalkan sesi login, dan mencegah perangkat dengan identitas akun lama mengembalikan riwayat ke akun baru otomatis.

#### Scenario: Delete account with another device offline
- **WHEN** akun dihapus lalu perangkat lama mencoba memakai sesi dan mengunggah riwayat lama
- **THEN** sesi ditolak dan data akun yang dihapus tidak dibuat kembali secara otomatis
