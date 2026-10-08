# Spec Delta

## Purpose

Menyediakan jejak aktivitas workout, autentikasi, dan sinkronisasi yang dapat dikelola berdasarkan waktu tanpa mengubah state operasional aplikasi.

## ADDED Requirements

### Requirement: Separate activity from operational state

Sistem SHALL memisahkan master ke schema `ref`, transaksi/state operasional ke `public`, dan aktivitas ke `log`. Kedaluwarsa log tidak boleh membatalkan sesi atau menghapus idempotensi sinkronisasi.

#### Scenario: Expire activity logs
- **WHEN** partisi log lama dibuang sesuai kebijakan retention
- **THEN** master, workout, sesi yang masih valid, serta hasil idempotensi tetap bekerja

### Requirement: Time-partition-ready events

Log SHALL siap dipartisi bulanan UTC berdasarkan waktu pencatatan server, dengan waktu kejadian asli terpisah untuk aktivitas offline. Event pada batas bulan dan saat partisi khusus belum tersedia tidak boleh hilang diam-diam.

#### Scenario: Late offline event
- **WHEN** event terjadi bulan lalu tetapi diterima server bulan ini
- **THEN** waktu asli tetap dapat dilihat dan event dicatat menurut periode penerimaan server

#### Scenario: Missing monthly partition
- **WHEN** periode baru dimulai sebelum partisi khususnya tersedia
- **THEN** event masuk fallback yang dipantau dan tetap dapat ditelusuri, tanpa dianggap berhasil jika penulisan gagal

### Requirement: Safe log content and deletion

Log SHALL membatasi metadata dan tidak menyimpan secret, token, video/frame/pose stream, atau profil yang tidak diperlukan. Penghapusan akun harus menghapus atau menghilangkan identitas pada aktivitas terkait tanpa mempertahankan metadata yang masih mengidentifikasi pengguna.

#### Scenario: Authentication activity
- **WHEN** login atau logout dicatat
- **THEN** log berisi tipe/outcome/correlation yang diperlukan tanpa nilai token atau credential

#### Scenario: Account removal
- **WHEN** akun dihapus
- **THEN** event lama tidak menghalangi penghapusan dan identitas terkait diproses sesuai aturan penghapusan data
