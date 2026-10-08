# Aturan kerja Gymbro

## Plan sebelum implementasi

Mulai setiap perubahan implementasi dengan implementation plan tertulis. Catat cakupan, komponen yang terdampak, skenario penerimaan, urutan pekerjaan, dan perintah validasi. Gunakan `docs/implementation-plan.md` serta task pada change OpenSpec sebagai titik awal; perbarui rencana bila cakupan berubah.

## Test-driven development

- RED: tulis tes perilaku yang bermakna dan jalankan untuk memastikan tes gagal karena perilaku yang belum tersedia.
- GREEN: implementasikan perilaku minimum sampai tes lulus.
- REFACTOR: rapikan implementasi dengan seluruh tes relevan tetap lulus.
- Laporkan bukti RED/GREEN dan hasil tes yang benar-benar dieksekusi. Jangan mengganti tes perilaku dengan tes yang hanya meniru implementasi.
- Gunakan PostgreSQL nyata untuk tes integrasi persistence, transaksi, concurrency, schema, dan partisi. Rollback destruktif hanya pada database tes yang dapat dibuang.
- Tes unit dan browser tidak membuktikan akurasi deteksi. Validasi terpisah dengan contoh workout berlabel dan perangkat nyata; laporkan hasil otomatis sebelum koreksi pengguna.

## Arsitektur dan data

- Backend: Go, Gin, GORM, PostgreSQL; pola clean architecture mengacu pada `docs/backend-architecture-reference.md`. Domain/use case tidak mengimpor Gin/GORM.
- Frontend: Expo + React Native Web, web dahulu, kemudian iOS/Android; adapter kamera/deteksi terpisah per platform.
- Deteksi video dilakukan di perangkat. Jangan mengunggah rekaman, frame, atau stream pose ke backend.
- PostgreSQL: `ref` untuk master, `public` untuk transaksi/state operasional, `log` untuk activity logs yang siap dipartisi. Gunakan nama tabel qualified dalam GORM dan SQL.
- Sesi login serta idempotensi sinkronisasi adalah state operasional, bukan log yang boleh kedaluwarsa bersama partisi aktivitas.
- Baca `GLOSSARY.md`, `docs/product-requirements.md`, dan change OpenSpec aktif sebelum mengubah perilaku.

## Lingkungan

Gunakan checkout yang sudah ada. Setiap task cloud sudah terisolasi; jangan membuat Git worktree kecuali pengguna memintanya. Pertahankan perubahan dan file pengguna. Jangan menulis secret ke repository, log, atau dokumen. Gunakan instalasi yang mempertahankan lockfile dan verifikasi paket.

## Git workflow

Pengguna mengizinkan push milestone MVP yang telah lolos validasi langsung ke `main`. Setelah MVP selesai, setiap improvement atau fitur baru memakai branch terpisah dan pull request. Jangan force-push atau mengubah history pengguna. Sebelum push, periksa perubahan, secret, dan hasil tes yang relevan.

Deployment lanjutan ditargetkan ke VPS pengguna dengan GitHub Actions auto-deployment. Baca `docs/deployment-plan.md` ketika pengguna meminta tahap tersebut; akses dan deployment belum dikonfigurasi sekarang.
