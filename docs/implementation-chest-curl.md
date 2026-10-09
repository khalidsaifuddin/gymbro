# Plan: curl mendekati dada

## Cakupan dan komponen

Feedback pengguna: curl menjauhi badan dihitung, curl mendekati dada terlewat. Hipotesis yang perlu uji perangkat: proyeksi 2D memendekkan lengan dan visibility pergelangan turun ketika menumpuk torso. Worker saat ini membuang worldLandmarks dari model. Teruskan koordinat 3D estimasi model ke adapter curl untuk sudut siku; latihan lain serta overlay tetap memakai koordinat gambar. Tidak menggunakan LiDAR, tidak menyimpan/mengunggah pose.

Untuk curl, visibility wrist dapat turun sampai 0.35 hanya bila wrist berada pada area dada dan presence tetap minimal 0.45. Shoulder/elbow/hip tetap minimal 0.45. Sendi hilang, confidence sangat rendah, geometry 3D invalid, dan pergantian sumber sudut 2D/3D membuang siklus parsial. Frame legacy tanpa worldLandmarks tetap memakai 2D.

File: pose worker/protocol frame, pose-geometry, pose-phase-adapter, tes replay/worker/vision smoke, docs/spec/task change `gymbro-web-mvp`.

## Skenario penerimaan

- Tiga curl bilateral lengkap dengan sudut gambar terproyeksi salah namun sudut siku 3D valid dihitung tiga, tanpa mengubah posisi kamera.
- Forearm berimpit dalam gambar masih bisa dihitung bila geometri 3D lengkap valid.
- Wrist pada dada dengan visibility 0.4 dan presence 0.8 tidak memutus rep; wrist jauh dari dada dengan confidence sama tetap invalid, presence rendah dan visibility 0.3 tetap invalid.
- Salah satu lengan tetap lurus dalam 3D tidak dihitung walau gambar tampak bilateral fleksi.
- Pose 3D NaN/hilang sendi/segmen nol tidak digunakan; perubahan sumber tidak menyambung dua siklus berbeda.
- Worker meneruskan worldLandmarks ke main thread tanpa network upload; replay 2D lama dan latihan lain tidak berubah.

## Urutan dan validasi

1. Plan/spec/task tertulis; RED replay chest curl dan worker result sebelum implementasi.
2. GREEN koordinat 3D serta confidence lokal dada; refactor dengan regresi negatif tetap lulus.
3. Dari frontend dengan Volta Node 24.21.0: `npm test`, `npm run typecheck`, `npm run build:web`, `npm run test:camera`, `npm run test:vision`. Inspeksi diff/secret sebelum push main sesuai instruksi pengguna untuk milestone MVP ini.

Hasil sintetis dan smoke model tidak membuktikan perbaikan akurasi di tubuh pengguna. Uji ulang 10 curl dekat dada vs 10 menjauhi badan pada kamera sama; laporkan hitungan otomatis sebelum koreksi. WorldLandmarks merupakan estimasi monocular, bukan sensor kedalaman.

Sumber model: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js (diperiksa 2026-10-09).

Implementasi dan validasi otomatis selesai; bukti RED/GREEN serta batas uji nyata ada di `validation-chest-curl.md`.
