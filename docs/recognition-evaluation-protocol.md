# Protokol evaluasi deteksi

Model dan threshold masih kandidat. Evaluasi tidak dijalankan dari hasil unit test atau pose sintetis.

## Data dan izin

Manifest setiap set menyebut sample ID, participant ID pseudonim, latihan/alat, reps berlabel, posisi/sudut kamera, perangkat, kondisi cahaya/occlusion, rentang waktu set, split, dan bukti izin/lisensi. Identitas asli dan video tidak masuk repository publik. Video untuk evaluasi hanya diproses lokal; aplikasi tidak mengunggahnya ke backend.

Pisahkan partisipan tuning dari evaluation. Kelompok evaluation berisi minimal 20 set per latihan dari ≥5 orang yang tidak dipakai tuning. Rekam kondisi yang didukung dan contoh negatif: berjalan, mengambil alat, duduk/berdiri biasa, gerakan lain, curl alternating, serta alat/pose terhalang. Catat contoh out-of-scope terpisah; jangan memasukkannya ke denominator supported-set agar skor tampak lebih baik.

Label manusia dibuat sebelum membaca prediksi. Gerakan awal/akhir dan jumlah siklus penuh menjadi ground truth. Label ambigu ditinjau oleh reviewer kedua dan dicatat alasannya, bukan dibuang karena model gagal.

## Pengukuran

Bekukan model checksum, library version, threshold, preprocessing, dan commit sebelum evaluasi. Jangan mengubah tuning dari hasil held-out evaluation; sesudah perubahan, gunakan evaluation baru atau nyatakan bahwa split sudah terkontaminasi.

Per latihan: `label_accuracy = set berlabel otomatis benar / semua set ground truth`. Unknown, missed set, dan latihan salah dihitung gagal. Untuk reps: `within_one_rep = set dengan abs(predicted_reps - ground_truth_reps) <= 1 / semua set ground truth`; missed set gagal. Rep counts berasal dari domain sebelum koreksi/merge pengguna. Laporkan juga exact-match, signed/absolute error, extra/spurious sets, waktu inferensi, tracking loss, serta false-positive count pada contoh negatif.

Gate wajib terpisah per latihan: minimal 90% label set benar dan 90% set within-one-rep, dengan jumlah set/orang memenuhi minimum. Jangan memakai rata-rata seluruh latihan untuk menyembunyikan gerakan yang gagal. Catat browser/perangkat sesungguhnya; headless Chromium tidak membuktikan Chrome Android atau kamera fisik.

Hasil saat ini: belum ada dataset berizin atau laporan akurasi. Panduan posisi kamera dan contoh pose/animasi akan disesuaikan dengan hasil pengujian ini sebelum dukungan otomatis dirilis.
