# Rencana deployment lanjutan

Pengguna akan meminta first deployment ke VPS miliknya setelah implementasi, serta auto-deployment menggunakan GitHub Actions. Deployment belum dimulai; tidak ada koneksi VPS atau secret deployment yang disiapkan.

## Rancangan awal

- Container backend Go, frontend web hasil Expo export, PostgreSQL, serta reverse proxy/TLS pada VPS. Frontend dan API satu origin untuk menyederhanakan cookie/CSRF dan kamera HTTPS.
- GitHub Actions menjalankan tes/domain, build/type check frontend, tes backend dan PostgreSQL integration sebelum release.
- Deploy dari `main` setelah first deployment telah dikonfigurasi dan divalidasi; gunakan immutable image/tag commit, deployment concurrency, health checks, serta rollback aplikasi.
- Migration database berversi dijalankan sebagai langkah terkontrol. Backup diverifikasi sebelum perubahan data; rollback image tidak otomatis membalik migration atau menghapus data.
- Simpan credential melalui pengaturan secret yang sesuai; jangan menulis private SSH key, password database, atau OAuth secret ke source, log, atau chat.

## Prasyarat sebelum implementasi deployment

Periksa akses/config yang sudah ada, lalu tentukan host VPS, sistem operasi/arsitektur, akses SSH yang sah, domain/DNS, HTTPS, port yang tersedia, volume data/backup, dan callback Google OAuth. Nilai secret tidak diminta di chat. Putuskan retention log produksi dan kapasitas disk sebelum mengaktifkan cleanup partisi.

Pekerjaan ini menjadi tahap lanjutan dengan implementation plan dan tes/validasi sendiri. Native mobile, Safari, serta akurasi kamera tidak dianggap selesai hanya karena deploy berhasil.
