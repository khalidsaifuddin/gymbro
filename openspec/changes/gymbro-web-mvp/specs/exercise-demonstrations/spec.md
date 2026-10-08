# Spec Delta

## Purpose

Menyediakan demonstrasi visual gerakan MVP yang dapat diedit dan digunakan kembali melalui aset berlisensi terbuka.

## ADDED Requirements

### Requirement: Five original demonstrations

Aplikasi SHALL menyediakan animasi SVG original untuk squat, push-up, curl dumbbell bilateral, seated machine shoulder press, dan flat barbell bench press, dengan source yang dapat diedit dalam repository.

#### Scenario: Open an exercise guide
- **WHEN** pengguna membuka panduan salah satu dari lima gerakan MVP
- **THEN** demonstrasi sesuai gerakan tersedia dan tidak digantikan slideshow dua foto yang diklaim sebagai animasi mulus

### Requirement: Explicit asset licensing

Setiap animasi SHALL memiliki lisensi CC-BY-4.0 dan informasi pembuat/atribusi. Lisensi aset harus terpisah dan jelas cakupannya terhadap lisensi kode aplikasi.

#### Scenario: Reuse demonstration source
- **WHEN** developer atau pengguna membuka source animasi
- **THEN** lisensi aset dan cara memberi atribusi dapat ditemukan tanpa menganggap lisensi kode berlaku otomatis

### Requirement: Demonstrations independent of recognition

Aplikasi SHALL tidak menganggap animasi demonstrasi sebagai bukti akurasi model atau penilaian teknik pengguna.

#### Scenario: Guide visible with camera unavailable
- **WHEN** panduan latihan tersedia tetapi kamera/model tidak dapat dijalankan
- **THEN** animasi tetap menjadi panduan dan UI tidak mengklaim deteksi pengguna sedang berhasil
