# Validasi overlay sendi dan posisi kamera

Tanggal: 9 Oktober 2026, Asia/Jakarta. Branch: `feat/camera-framing-overlay`. Rencana tertulis pada `implementation-camera-framing-overlay.md` sebelum implementasi.

## Perilaku yang tersedia

- Preview kamera web menampilkan bingkai panduan, sendi, sambungan, dan pesan posisi dari landmark MediaPipe yang diproses lokal. Sebelum pose tersedia, hanya bingkai dan instruksi awal yang tampil.
- Sendi tanpa koordinat, presence, atau visibility yang valid tidak digambar; sambungan yang menyentuh sendi tersebut juga tidak digambar. Panduan membutuhkan sendi menurut profil latihan. Curl dan cable tetap bilateral; profil samping/diagonal lain dapat memakai satu sisi sesuai aturan recognizer.
- Pesan membedakan sendi yang hilang, tubuh terlalu ke tepi, terlalu dekat ke tepi gambar, terlalu jauh, dan framing yang cukup. Framing cukup hanya berarti sendi yang diperlukan terlihat; status pengenalan dan jumlah rep tetap berasal dari recognizer.
- Kerangka lama dibersihkan saat pause/stop dan ketika tracking terputus. Overlay tidak menangkap interaksi dan tidak menambah upload frame, video, atau pose.
- Output sementara tes browser sekarang berada di cache `node_modules` yang diabaikan Git, dan server statis memakai `python3` agar tes berjalan pada macOS.

Layout kamera dan hitungan rep/set satu layar penuh ditunda untuk tahap UI/UX berikutnya sesuai keputusan pengguna.

## Bukti RED → GREEN → REFACTOR

- RED unit: setelah kontrak tes ditulis dan fungsi masih berupa stub, **5 tes gagal, 1 lulus**. Kegagalan mencakup curl yang belum dinilai framed, pergelangan hilang, pandangan samping, centering, dan rasio video.
- RED browser: **2 tes gagal** pada build tanpa overlay karena elemen `camera-framing-overlay` dan `camera-framing-status` belum ada.
- GREEN: penilaian framing, SVG di atas video, dan pembersihan state ditambahkan. Tujuh tes unit baru serta dua tes browser baru lulus. Tes browser memeriksa pergelangan yang hilang, pause, rep tetap 0 pada pose statis, dan alignment sendi terhadap isi video pada lebar desktop serta viewport 390 px.
- REFACTOR/regresi: seluruh suite unit frontend dan suite browser kamera terkait tetap lulus setelah implementasi. Tidak ada perubahan recognizer, API, database, dependency, atau lockfile.

## Hasil validasi yang dieksekusi

| Pemeriksaan | Hasil |
| --- | --- |
| `volta run --node 24 --bundled-npm npm --prefix frontend test` | 238 lulus, 16 file |
| `volta run --node 24 --bundled-npm npm --prefix frontend run typecheck` | Lulus |
| `volta run --node 24 --bundled-npm npm --prefix frontend run build:web` | Lulus; model/WASM lokal diverifikasi |
| `volta run --node 24 --bundled-npm npm --prefix frontend run test:e2e -- camera-framing.spec.ts` | 2 lulus, Chromium |
| `volta run --node 24 --bundled-npm npm --prefix frontend run test:e2e -- camera-prototype.spec.ts camera-views.spec.ts cable-exercises.spec.ts vision.spec.ts --reporter=dot` | 20 lulus, Chromium |
| Server Go pada `http://localhost:8080/` | Mengirim bundle frontend terbaru dengan overlay |
| `git diff --check` | Lulus |

## Batas bukti dan kelanjutan

Tes memakai landmark/replay sintetis dan Chromium, sehingga hanya memvalidasi aturan dan rendering overlay. Belum ada pengukuran akurasi deteksi atau usability pada kamera dan workout nyata. Pengenalan gerakan, salah hitung rep, sudut kamera, occlusion, dan pencahayaan masih memerlukan evaluasi berlabel pada perangkat nyata; jangan menyimpulkan akurasi dari status framing. Kamera ponsel pada alamat HTTP LAN masih membutuhkan origin HTTPS tepercaya agar izin kamera browser tersedia. Layout satu layar penuh akan ditangani pada pekerjaan UI/UX berikutnya.
