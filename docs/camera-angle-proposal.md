# Usulan dukungan beberapa sudut kamera

Pengguna menanyakan kemungkinan depan/belakang dan diagonal kiri/kanan depan/belakang. Arah ini belum menjadi capability yang diuji pada milestone web saat ini. Kamera MVP tetap satu orang, diam, dengan sendi relevan terlihat. Pilihan apakah kamera harus tetap selama sesi atau boleh berpindah saat set berlangsung ditanyakan; keputusan belum dicatat.

Rekomendasi awal: beberapa profil sudut, kamera tetap per sesi. MediaPipe dapat mencari landmark pada banyak perspektif, tetapi ini tidak otomatis membuat classifier/reps invariant terhadap arah. Front/back dapat menutup sendi; bench/machine press bisa tertutup alat; perspektif diagonal memengaruhi projected joint angles. Pose estimation saja tidak membuktikan alat yang dipakai.

Sebelum implementasi, tulis plan + OpenSpec delta sesuai pilihan pengguna. Rencana penerimaan: profil camera view, estimasi visibility/side yang layak, normalisasi fitur tubuh, ready→peak→ready hanya saat sinyal valid, confidence rendah tetap unknown/manual, dan raw metrics dipisahkan dari profile selection/koreksi. Uji tiap sudut per exercise dengan labeled fixtures dan real data berizin; jangan mengklaim semua sudut memenuhi gate tanpa laporan per kondisi.

Jika kamera boleh bergerak saat set, plan perlu aturan stabilisasi/perubahan view, reset partial cycle, dan perlindungan false reps akibat pergerakan kamera. Satu complete cycle tidak boleh menggabungkan observasi dari sudut yang berubah/occluded. Pertahankan verified reps; lanjut setelah tracking stabil. Perpindahan view tidak boleh mengarang set baru atau menganggap tracking loss sebagai quiet boundary.

Live testing tetap setelah aplikasi runnable sesuai keputusan pengguna. Sebelum memakai Codex CLI lokal, baca usulan ini bersama latest user steering; jangan menganggap pertanyaan capability sebagai persetujuan semua detail desain.
