# Validasi sensitivitas repetisi — 2026-10-09

## RED

`npm test -- src/detection/pose-phase-adapter.test.ts`: 5 gagal, 34 lulus. Replay kontinu squat/curl masing-masing menghasilkan 0 dari 3 rep; curl sedikit berbeda fase menjadi invisible; confidence 0.5 menyebabkan squat/curl 0 dari 1 rep. Kegagalan ini mereproduksi logika yang kehilangan rep secara sintetis, bukan rekaman pengguna.

## GREEN dan refactor

- Squat/curl: alpha EMA 0.65 → 0.85, debounce 80 → 30 ms dengan minimal dua frame; squat ready/peak 150/125 → 145/130 derajat; curl 145/90 → 140/100 derajat.
- Confidence sendi squat/curl 0.55 → 0.45; koordinat harus tetap valid, semua sendi wajib tersedia. Confidence 0.3 dan landmark hilang tetap memutus siklus, tanpa meneruskan gerakan yang tidak terlihat.
- Curl tidak invalid hanya karena kedua lengan melintasi ambang pada frame berbeda. Selisih >30 derajat tetap invalid; kedua lengan harus mencapai endpoint ready dan peak. Tes negatif tambahan memastikan satu lengan peak dan satu lengan moving tidak dihitung walau selisih <30 derajat.
- Sampling kamera maksimal 10 → 30 fps, inference tetap serial. FPS aktual perangkat belum diukur.

Perintah benar-benar dijalankan, dari `frontend` dengan Volta Node 24.21.0:

- `npm test`: **259/259**, 18 file lulus.
- Setelah refactor ekspresi fase: `npm test -- src/detection/pose-phase-adapter.test.ts`: **40/40** lulus.
- `npm run typecheck`: lulus.
- `npm run build:web`: lulus; dist lokal dan versi cache offline diperbarui.
- `npm run test:camera`: **5/5** browser tests lulus, termasuk replay set aktif, pause/resume/background, dan izin ditolak.
- `git diff --check`: lulus. `/health` localhost:8080 mengembalikan status ok.

Backend/schema tidak berubah; tes PostgreSQL tidak dijalankan ulang. Browser memakai fake stream dan replay pose, sehingga hasil ini belum membuktikan akurasi model dengan tubuh nyata. Corpus/evaluasi berlabel tetap terbuka; prioritas berikutnya membandingkan rep aktual vs hitungan otomatis squat/curl sebelum koreksi pada perangkat pengguna. Threshold lebih sensitif dapat menerima gerakan lebih dangkal; angka hitungan bukan penilaian teknik.
