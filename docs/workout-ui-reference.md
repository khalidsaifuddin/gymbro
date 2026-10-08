# Referensi tampilan workout aktif

## Referensi pengguna

Pengguna memberikan screenshot Hevy sebagai referensi pemantauan latihan yang sedang berlangsung. Screenshot memperlihatkan header dengan durasi, volume, jumlah set, dan tombol selesai; kartu tiap latihan dengan ilustrasi, catatan, timer istirahat, tabel set, serta tombol tambah set.

Tabel memiliki kolom nomor set, hasil sebelumnya, berat, repetisi, dan status selesai. Pola ini membantu membandingkan latihan sekarang dengan sesi sebelumnya dan mengoreksi input per set.

## Kebutuhan Gymbro yang sudah disepakati

- Deteksi kamera berjalan langsung selama workout.
- Kamera, nama gerakan yang terdeteksi, nomor set, dan repetisi langsung terlihat.
- Ada timer istirahat, peringatan posisi kamera, pause, dan selesai workout.
- Hitungan terbaca ketika perangkat diletakkan agak jauh.
- Berat dimasukkan manual; repetisi dapat dikoreksi setelah set.

## Rancangan frontend berdasarkan rekomendasi

- Dua mode tampilan dalam satu sesi: fokus kamera dengan hitungan besar dan log latihan dengan tabel set.
- Tabel mengacu pada data workout yang sama dengan penghitung kamera, sehingga koreksi tidak membuat catatan duplikat.
- Hasil sebelumnya hanya berasal dari riwayat pengguna sendiri untuk gerakan yang sama.
- Animasi SVG original untuk lima gerakan memakai CC-BY-4.0 beserta source/atribusi; screenshot Hevy menjadi referensi pola interaksi.
- Volume mengikuti konvensi beban yang disepakati dalam `product-requirements.md`; beban kosong tidak diperlakukan sebagai nol yang diketahui.

Pengguna menyerahkan pilihan frontend kepada rekomendasi asisten. Layout ini merupakan rancangan implementasi; belum ada UI yang dibuat atau diuji.
