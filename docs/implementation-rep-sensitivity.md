# Plan: repetisi kamera yang terlewat

## Cakupan dan komponen

Prioritas pengguna adalah menangkap lebih banyak repetisi squat/curl. Adapter pose memakai smoothing lebih responsif, debounce lebih pendek, endpoint rentang sedang, toleransi perbedaan fase sesaat kedua lengan, dan confidence moderat untuk sendi yang tetap terukur. Kamera memproses maksimal 30 frame/detik, tetap satu inference pada satu waktu. Profil latihan lain mempertahankan parameter adapter lama. Koordinat hilang/invalid, confidence sangat rendah, pergantian sisi, atau gap nyata tetap memutus siklus. Tidak menyimpan atau mengunggah pose/video.

Komponen: `pose-phase-adapter`, `pose-geometry`, loop kamera web, tes replay adapter→WorkoutSession, spesifikasi kamera.

## Skenario penerimaan

- Tiga siklus bergerak kontinu dengan turnaround singkat pada 30 fps menghasilkan tiga rep tanpa menahan endpoint 80 ms.
- Curl serempak dengan selisih sudut kecil yang melintasi ambang berbeda tidak kehilangan siklus; kedua lengan tetap harus mencapai kedua endpoint.
- Confidence 0.5 pada sendi yang koordinatnya valid tidak membuang siklus squat/curl; 0.3 dan sendi hilang tetap memutus.
- Pose diam, jitter di sekitar satu ambang, satu spike fleksi, curl satu tangan/alternating, dan siklus terputus tidak menambah rep.
- Parameter debounce eksplisit tetap dihormati.

## Urutan dan validasi

1. Catat plan/task/spec; tulis replay perilaku baru, jalankan dan catat RED.
2. Terapkan minimum perubahan parameter/geometri bilateral dan loop kamera; jalankan GREEN.
3. Jalankan seluruh unit, typecheck, build web; inspeksi diff. Build memperbarui aplikasi localhost.

Commands dari `frontend`, Node 24.21.0 melalui Volta: `npm test -- src/detection/pose-phase-adapter.test.ts`, `npm test`, `npm run typecheck`, `npm run build:web`.

Tes sintetis membuktikan logika replay, bukan akurasi model pada perangkat. Pengguna perlu membandingkan 10 rep aktual dengan hasil otomatis sebelum koreksi; evaluasi corpus berlabel di task 2.5/2.6 tetap terbuka.

Implementasi dan validasi otomatis selesai; hasil RED/GREEN dan batas bukti ada di `validation-rep-sensitivity.md`.
