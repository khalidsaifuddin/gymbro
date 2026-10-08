# Spec Delta

## Purpose

Menyimpan hasil workout tamu maupun akun, memulihkan catatan sesi, dan menjaga konsistensi riwayat saat koneksi atau perangkat berubah.

## ADDED Requirements

### Requirement: Guest history and opt-in migration

Aplikasi SHALL mengizinkan workout tanpa login, menyimpan hasil tamu lokal, dan meminta pilihan pengguna sebelum memindahkannya ke akun. UI menjelaskan bahwa membersihkan data browser dapat menghapus hasil tamu.

#### Scenario: Guest logs in
- **WHEN** pengguna tamu login dengan hasil lokal yang belum diimpor
- **THEN** pengguna dapat memilih impor ke akun atau tetap menyimpannya lokal, tanpa impor otomatis

### Requirement: Incremental session recovery

Aplikasi SHALL menyimpan catatan terverifikasi bertahap dan menawarkan pemulihan setelah reload. Kamera harus diaktifkan kembali; tidak ada hitungan untuk gerakan selama halaman tidak aktif.

#### Scenario: Reload an active workout
- **WHEN** halaman direload setelah delapan repetisi terverifikasi
- **THEN** sesi yang dipulihkan mempertahankan delapan rep, meminta aktivasi ulang kamera, dan tidak menambah rep untuk jeda reload

### Requirement: Offline continuation and synchronization

Aplikasi SHALL melanjutkan workout ketika koneksi terputus setelah aplikasi/model dimuat dan mengirim hasil akun saat koneksi serta autentikasi kembali tersedia. Pemakaian pertama memerlukan internet.

#### Scenario: Network lost mid-workout
- **WHEN** jaringan terputus setelah startup berhasil
- **THEN** hitungan dan penyimpanan lokal tetap bekerja serta hasil yang menunggu sync tidak hilang

### Requirement: Idempotent retry and explicit conflict

Sinkronisasi SHALL tidak membuat duplikasi pada retry identik, menolak reuse identitas mutasi dengan isi berbeda, dan meminta pengguna memilih versi ketika edit lintas perangkat bertentangan. Konflik tidak boleh menyimpan sebagian edit.

#### Scenario: Response lost after save
- **WHEN** server telah menyimpan mutasi tetapi respons hilang lalu perangkat mengirim ulang mutasi yang sama
- **THEN** server mengembalikan outcome sebelumnya tanpa membuat workout atau set duplikat

#### Scenario: Conflicting device edits
- **WHEN** dua perangkat mengedit revisi workout yang sama dan perangkat kedua mengirim setelah revisi berubah
- **THEN** edit kedua ditolak sebagai konflik, versi tersedia untuk dipilih, dan tidak ada overwrite diam-diam

### Requirement: Workout deletion and stale sync

Aplikasi SHALL memungkinkan penghapusan workout beserta isinya dan menolak stale sync yang akan mengembalikan UUID workout yang telah dihapus. File video yang sudah diunduh dikelola pengguna.

#### Scenario: Deleted workout is replayed
- **WHEN** perangkat offline mengirim edit atau creation ulang untuk workout yang sudah dihapus di server
- **THEN** workout tidak muncul kembali dan pengguna menerima status penghapusan
