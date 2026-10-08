# Proposal

## Why

Pencatatan workout manual menyulitkan pengguna memantau repetisi saat sedang bergerak. Gymbro akan mengenali lima latihan dan menghitung set/repetisi dari kamera browser, dengan koreksi pengguna serta riwayat tanpa mengunggah video.

## What Changes

- Tambahkan aplikasi web Expo/React Native dengan mode kamera dan log workout terinspirasi Hevy.
- Tambahkan pengenalan squat, push-up, dumbbell curl bilateral, seated machine shoulder press, dan flat barbell bench press; validasi akurasi terpisah per gerakan.
- Tambahkan aturan set/rest, koreksi, summary, penyimpanan tamu, recovery, serta rekaman opsional ke perangkat.
- Tambahkan backend Go clean architecture, Gin/GORM, dan PostgreSQL dengan schema `ref`, `public`, `log` serta activity logs siap dipartisi.
- Tambahkan login Google, riwayat lintas perangkat, sinkronisasi offline idempotent, konflik eksplisit, dan penghapusan data.
- Buat lima animasi SVG original berlisensi CC-BY-4.0.
- Kerjakan seluruh implementasi melalui plan dan TDD. Native iOS/Android, Safari, kalori, penilaian teknik, curl unilateral/bergantian otomatis, dan video cloud berada di luar MVP.

## Capabilities

### New Capabilities

- `workout-tracking`: sesi, set/repetisi, koreksi, rest, beban, volume, UI dan summary.
- `camera-recognition`: deteksi on-device, kondisi kamera, pergantian gerakan, dan kriteria akurasi.
- `local-recording`: perekaman opsional, save/discard lokal, pause dan batas recovery video.
- `workout-history`: data tamu, recovery, offline sync, idempotensi, konflik dan penghapusan workout.
- `user-auth`: login Google, sesi, owner isolation, serta penghapusan akun.
- `exercise-demonstrations`: demonstrasi lima gerakan dengan source dan lisensi terbuka.
- `activity-logging`: aktivitas terstruktur pada schema log dengan partisi waktu dan pemisahan state operasional.

### Modified Capabilities

Tidak ada; repository belum memiliki spesifikasi aplikasi yang diimplementasikan.

## Impact

Implementasi akan menambahkan `frontend/`, `backend/`, migration, aset, serta test harness. Tidak ada kode aplikasi atau database saat ini. Integrasi Google dan deployment membutuhkan konfigurasi sah saat tahap terkait; target akurasi belum terbukti dan memerlukan data evaluasi berizin serta perangkat nyata.
