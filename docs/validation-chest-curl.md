# Validasi curl dekat dada — 2026-10-09

## Feedback dan hipotesis

Pengguna melaporkan curl menjauhi badan terdeteksi tetapi curl mendekati dada terlewat. Jumlah rep, perangkat, frame, dan sudut kamera tidak diberikan; sebab model belum dikonfirmasi. Investigasi kode menemukan sudut hanya 2D dan worldLandmarks model dibuang. Dokumentasi resmi [MediaPipe Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) menyebut worldLandmarks x/y/z dalam meter. Kedalaman ini merupakan estimasi kamera monocular, bukan LiDAR.

## RED → GREEN

Run pertama `npm test -- src/detection/chest-curl.test.ts src/detection/pose.worker.test.ts`: **7 gagal, 6 lulus**. Replay curl depth menghasilkan 0 dari 3 rep; forearm berimpit di gambar menghasilkan 0 dari 1; wrist visibility 0.4 dekat dada memutus rep. Worker tidak meneruskan worldLandmarks. Tiga regresi menunjukkan koordinat world invalid diabaikan dan image pose dapat menghasilkan rep palsu.

Setelah implementasi: **13/13** tes awal lulus. Dua tes tambahan memverifikasi koordinat world negatif serta rasio video portrait/landscape tidak mengubah sudut world. Regresi mencakup satu lengan tetap lurus, missing/NaN/segmen nol, presence/visibility 0.3, wrist confidence rendah di luar dada, pergantian sumber sudut, serta fallback 2D legacy.

Perubahan: curl menggunakan sudut siku 3D ketika frame menyertakan worldLandmarks. Geometry world invalid memutus tracking. Frame legacy tanpa field memakai 2D; pergantian sumber membuang siklus parsial. Wrist visibility minimal 0.35 hanya pada area dada dengan presence minimal 0.45; body joints tetap memakai batas sebelumnya. Squat/cable/press/push-up dan overlay tidak berpindah ke 3D.

## Perintah dan hasil aktual

Dari `frontend`, Volta Node 24.21.0:

- `npm test`: **274/274**, 20 file lulus.
- `npm run typecheck`: lulus setelah memperbaiki narrowing TypeScript dan tipe fixture.
- `npm run build:web`: lulus, worker lokal/dist/cache offline diperbarui.
- `npm exec -- playwright test camera-prototype.spec.ts vision.spec.ts`: **6/6** lulus. Lima alur kamera memakai fake stream/replay; smoke keenam menjalankan model/WASM asli pada frame kosong serta memeriksa worldLandmarks dan seluruh request same-origin GET tanpa upload.
- `git diff --check`: lulus. Localhost:8080 health ok dan menyajikan bundle hasil build baru.

Tidak ada perubahan backend/schema; tes PostgreSQL tidak diulang. Akurasi curl dekat dada dengan tubuh nyata **belum diukur**. Uji berikutnya: 10 curl bilateral dekat dada dan 10 menjauhi badan dengan posisi kamera sama, catat hasil otomatis sebelum koreksi. Corpus berlabel dan gate akurasi OpenSpec tetap terbuka. Ketika model benar-benar kehilangan sendi, sistem tetap membuang siklus tersebut.
