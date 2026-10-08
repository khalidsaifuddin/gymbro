# Gymbro: kebutuhan produk

## Kebutuhan yang disepakati

- Kamera digunakan untuk mengenali gerakan workout, menghitung set dan repetisi, serta menghasilkan ringkasan workout.
- Cakupan produk mencakup latihan bodyweight dan latihan gym dengan beban atau mesin.
- Penyimpanan rekaman video opsional: pengguna dapat menyimpan atau menghapus video dan tetap memperoleh hasil deteksi serta hitungan set/repetisi.
- Web menjadi platform pertama, kemudian iOS dan Android.
- Backend menggunakan Go dengan clean architecture.
- Frontend menggunakan React Native dengan sasaran web, iOS, dan Android.
- Pengguna mengikuti rekomendasi frontend: Expo dan React Native Web untuk tahap web pertama, dengan adapter kamera/deteksi khusus platform.
- Arsitektur backend mengacu pada pola backend https://github.com/khalidsaifuddin/widyaprada/tree/main/backend. Stack MVP: Gin, GORM, PostgreSQL, dan migrasi database berversi. Redis tidak diperlukan pada MVP. Domain dan use case tidak bergantung pada Gin/GORM.
- Gerakan MVP: squat, push-up, dumbbell biceps curl, seated machine shoulder press, dan flat barbell bench press. Incline, decline, dan dumbbell bench press berada di luar MVP.
- Satu orang per sesi, kamera diam, dan bagian tubuh yang diperlukan terlihat jelas. Aplikasi memberi panduan posisi kamera sesuai latihan dan meminta penyesuaian saat pandangan terhalang.
- Posisi kamera dipilih sebelum sesi workout dan tetap sampai sesi selesai, termasuk saat istirahat dan pergantian latihan. Perpindahan posisi memerlukan sesi baru. Pilihan beberapa sudut direncanakan; dukungan otomatis tiap kombinasi sudut/latihan harus divalidasi, bukan diasumsikan dari kemampuan MediaPipe.
- Deteksi berjalan langsung di browser; video tidak diunggah ke server. Backend menyimpan hasil workout.
- Perekaman video mati secara default dan harus diaktifkan sebelum workout. Setelah workout, pengguna dapat menyimpan video ke perangkat atau membuangnya; MVP tidak menyimpan video di cloud.
- Berat beban dimasukkan pengguna, bukan ditentukan dari kamera.
- Jika deteksi meragukan, aplikasi menampilkan "gerakan belum dikenali" dan meminta pengguna memilih gerakan; klasifikasi tidak dipaksakan.
- Satu repetisi otomatis dihitung hanya setelah satu siklus gerakan lengkap. Gerakan parsial tidak dihitung pada MVP. Pengguna dapat mengoreksi hitungan setelah set.
- Aturan awal batas set: set ditutup otomatis setelah 15 detik tanpa repetisi. Pengguna dapat menutup set secara manual dan menggabungkan set yang terpisah keliru.
- Ringkasan memuat jenis latihan, repetisi per set, berat yang dimasukkan pengguna, total set/repetisi, durasi workout, dan durasi istirahat. Estimasi kalori dan penilaian teknik gerakan berada di luar MVP.
- Workout dapat dilakukan tanpa login. Hasil pengguna tamu disimpan lokal; login Google memungkinkan penyimpanan riwayat lintas perangkat. Pengguna memilih apakah hasil tamu dipindahkan ke akun.
- Setelah aplikasi dan model dimuat, workout dapat berjalan ketika koneksi terputus. Hasil disinkronkan saat koneksi kembali. Pemakaian pertama memerlukan internet.
- Tampilan saat latihan memuat kamera, gerakan yang terdeteksi, nomor set, hitungan repetisi langsung, timer istirahat, peringatan posisi kamera, serta tombol pause dan selesai workout. Hitungan harus terbaca dari jarak penempatan kamera.
- Referensi visual pemantauan workout: screenshot Hevy yang diberikan pengguna, dengan kartu per latihan, tabel set, hasil sebelumnya, input berat/repetisi, dan timer istirahat. Adaptasi Gymbro tersedia pada mode kamera/log dengan satu session aggregate.
- Pengguna meminta pencarian animasi tiap gerakan yang open source; sumber dan lisensi aset harus diverifikasi sebelum digunakan.
- Animasi demonstrasi untuk lima gerakan dibuat sebagai SVG original dengan source di repository dan lisensi aset CC-BY-4.0. Aset tersedia di frontend/public/exercises; hasil riset sumber pihak ketiga tercatat di docs/exercise-animation-research.md.
- Timer target istirahat default 2 menit, dapat diubah per latihan. Pengguna dapat mulai set berikutnya sebelum timer habis. Durasi istirahat dimulai dari akhir repetisi terakhir, bukan setelah menunggu batas 15 detik untuk menutup set.
- Satuan beban MVP adalah kg. Beban barbell mencakup berat batang; beban dumbbell dicatat per dumbbell; beban mesin mengikuti angka yang dipilih. Label input menjelaskan konvensi tersebut.
- Volume latihan dihitung sebagai repetisi dikali total beban eksternal yang digunakan pada repetisi tersebut. Dua dumbbell masing-masing 10 kg yang bergerak bersama selama 10 repetisi menghasilkan volume 200 kg. Bodyweight dicatat sebagai set/repetisi tanpa perkiraan berat tubuh atau volume beban tubuh.

## Keputusan lanjutan yang disepakati

- Gangguan pandangan kamera menghentikan hitungan dan penutupan set otomatis; tidak dianggap akhir set. Pertahankan repetisi terverifikasi, buang siklus terputus, dan lanjutkan saat posisi pulih.
- Jenis latihan boleh berubah otomatis di antara set. Perubahan yang terdeteksi saat set aktif memerlukan konfirmasi pengguna.
- Dumbbell curl otomatis mendukung kedua tangan yang bergerak bersamaan; satu siklus bilateral adalah satu repetisi. Curl bergantian atau satu tangan dicatat manual pada MVP.
- Target per gerakan: minimal 90% set berlabel latihan yang benar dan minimal 90% set memiliki selisih hitungan maksimal satu repetisi. Uji minimal 20 set per gerakan dari sedikitnya 5 orang pada kondisi kamera yang didukung. Label belum dikenali dihitung sebagai kegagalan pengenalan; koreksi pengguna tidak dihitung sebagai keberhasilan otomatis.
- Browser awal: Chrome/Edge desktop dan Chrome Android. Safari menyusul setelah validasi khusus.
- Pause eksplisit atau aplikasi masuk background menjeda deteksi dan perekaman. Repetisi terverifikasi disimpan bertahap. Reload menawarkan pemulihan catatan sesi dengan aktivasi ulang kamera. Gerakan selama jeda tidak dihitung; pemulihan file video setelah reload belum dijamin.
- Konflik edit lintas perangkat meminta pengguna memilih versi, tanpa overwrite diam-diam. Retry sinkronisasi offline tidak boleh menghasilkan duplikasi.
- Pengguna dapat menghapus workout atau akun beserta riwayat server. Video yang telah diunduh tetap dikelola pengguna. Hasil tamu berada di browser dan dapat hilang saat data situs dibersihkan.
- PostgreSQL dibagi menjadi `public` untuk transaksi, `ref` untuk reference/master, dan `log` untuk log/activity yang siap dipartisi.
- Selalu mulai implementasi dari implementation plan dan gunakan TDD: RED, GREEN, REFACTOR.

## Status dan validasi

Kebutuhan MVP sudah disepakati. Domain, prototipe kamera, UI log, persistence tamu/recovery/offline, rekaman lokal dan SVG tersedia. Migration/repository PostgreSQL tiga schema serta partisi log diuji pada database nyata. API/auth/durable sync tersedia dan diuji melalui issuer OIDC fixture bertanda tangan, PostgreSQL nyata serta browser. Login Google eksternal menunggu konfigurasi OAuth sah. Live testing dan evaluasi akurasi dijadwalkan setelah MVP dapat dijalankan serta diakses dari localhost, sesuai instruksi pengguna. Definisi fase gerakan dan ambang deteksi merupakan parameter prototipe yang harus diuji, bukan janji akurasi.

Lihat `implementation-plan.md`, `database-design.md`, dan change OpenSpec `gymbro-web-mvp` untuk rencana serta skenario penerimaan. Kredensial Google, deployment HTTPS, kebijakan retention log produksi, dan data evaluasi berizin akan disiapkan ketika tahap terkait dimulai; pekerjaan domain dan prototipe dapat berjalan lebih dahulu.
