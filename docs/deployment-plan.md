# Rencana deployment lanjutan

Deployment pertama sudah dijalankan pada 9 Oktober 2026 ke VPS yang diotorisasi pengguna. GitHub Actions telah disiapkan di branch kerja, tetapi belum aktif di `main` karena perubahan belum dipublikasikan dan secret repository belum dapat disetel dari sesi ini.

## Rancangan awal

- Backend Go dan frontend web hasil Expo export dijalankan sebagai service PM2, memakai PostgreSQL VPS, serta reverse proxy/TLS nginx. Hosting memakai subdomain frontend dan API terpisah; CORS, cookie, CSRF, serta OAuth callback harus mengikuti origin tersebut.
- GitHub Actions menjalankan tes/domain, build/type check frontend, tes backend dan PostgreSQL integration sebelum release.
- Deploy dari `main` setelah first deployment telah dikonfigurasi dan divalidasi; gunakan immutable image/tag commit, deployment concurrency, health checks, serta rollback aplikasi.
- Migration database berversi dijalankan sebagai langkah terkontrol. Backup diverifikasi sebelum perubahan data; rollback image tidak otomatis membalik migration atau menghapus data.
- Simpan credential melalui pengaturan secret yang sesuai; jangan menulis private SSH key, password database, atau OAuth secret ke source, log, atau chat.

## Status deployment pertama

- Frontend: `https://gymbro.spmbbanjarkab.web.id` → PM2 `gymbro-web` → `127.0.0.1:4121`.
- API: `https://gymbro-backend.spmbbanjarkab.web.id` → PM2 `gymbro-api` → `127.0.0.1:4120`.
- Kedua domain memiliki sertifikat Let's Encrypt terpisah yang valid sampai 7 Januari 2027. HTTP dialihkan ke HTTPS. Timer pembaruan Certbot aktif; dry-run renew untuk kedua sertifikat berhasil.
- Nginx, PostgreSQL, dan PM2 aktif. Database/role baru khusus Gymbro dibuat; database lain tidak diubah. Kredensial hanya berada di file konfigurasi privat pada VPS.
- Deploy release memakai direktori bernomor, health check, symlink `current`, dan rollback aplikasi. PM2 disimpan untuk startup systemd.
- Login Google belum aktif. Daftarkan callback `https://gymbro-backend.spmbbanjarkab.web.id/api/v1/auth/google/callback` dan masukkan client ID/secret melalui environment privat VPS jika login akun diperlukan.
- Workflow `deploy-vps.yml` menguji/build sebelum deploy ke setiap push `main`, tetapi membutuhkan merge ke `main` dan GitHub Actions secret `GYMBRO_DEPLOY_KEY` sebelum otomatisasi berjalan.

## Prasyarat sebelum implementasi deployment

Sebelum deployment, periksa host VPS, sistem operasi/arsitektur, akses SSH yang sah, domain/DNS, HTTPS, port yang tersedia, volume data/backup, dan callback Google OAuth. Nilai secret tidak diminta di chat. Putuskan retention log produksi dan kapasitas disk sebelum mengaktifkan cleanup partisi. Pemeriksaan awal pada deployment ini menemukan tidak ada database Gymbro sebelumnya; data database lain tetap utuh.

Pekerjaan ini menjadi tahap lanjutan dengan implementation plan dan tes/validasi sendiri. Native mobile, Safari, serta akurasi kamera tidak dianggap selesai hanya karena deploy berhasil.
