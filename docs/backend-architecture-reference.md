# Referensi arsitektur backend

Sumber yang diminta pengguna: [backend Widyaprada](https://github.com/khalidsaifuddin/widyaprada/tree/main/backend), diperiksa pada commit `e323537dfde523d6a81bc39ae59eb563bf805d64`.

## Pola yang teramati

- `core/entity`: entitas serta tipe permintaan/hasil.
- `core/repository`: kontrak repository yang digunakan use case.
- `core/usecase/<fitur>`: use case dengan constructor injection terhadap kontrak repository; file `init.go` dan `func_*.go` per operasi.
- `handler/api/<fitur>`: adapter HTTP Gin yang memanggil use case.
- `repository/<fitur>-repo`: implementasi repository menggunakan GORM dan DTO penyimpanan.
- `handler/middleware`: middleware serta perakitan router/dependensi.
- `config` dan `pkg`: konfigurasi, koneksi, autentikasi, migrasi, serta utilitas.
- `main.go`: inisialisasi konfigurasi, database, migrasi, router, dan server.

Referensi menggunakan REST/JSON, Gin, GORM, Swagger, serta driver PostgreSQL dan SQLite. Go module menetapkan Go 1.24.0 dan toolchain 1.24.4; ini fakta referensi, bukan pin Gymbro.

## Adaptasi yang diusulkan untuk Gymbro

Pertahankan pembagian folder dan constructor injection yang familier. Arah ketergantungan menuju core: use case hanya mengenal kontrak, sedangkan adapter HTTP dan database mengenal core. Gin/GORM tidak menjadi dependensi domain atau use case.

Fitur Gymbro akan berkaitan dengan katalog latihan, sesi workout, set, riwayat, autentikasi Google, dan sinkronisasi hasil lokal. Deteksi kamera berada di frontend; backend tidak menerima video untuk analisis.

Stack yang disetujui: Gin, GORM, PostgreSQL, serta migrasi berversi. Redis berada di luar MVP. Rancangan autentikasi sesi, protokol sinkronisasi, dan tiga schema terdapat dalam change OpenSpec `gymbro-web-mvp` serta `database-design.md`; implementasi belum tersedia.
