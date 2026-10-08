# Validasi tahap 7: sudut kamera tetap per sesi

Tanggal: 9 Oktober 2026, Asia/Jakarta. Branch: `feat/fixed-camera-views`, baseline `ab2bd95`. Implementation plan ditulis sebelum kode pada `implementation-stage-7.md`.

## Perilaku yang tersedia

- Pilihan depan/belakang, empat diagonal, dua samping, atau panduan latihan default sebelum sesi. Pilihan dikunci saat sesi dibuat, tetap terkunci saat pause/rest/pergantian latihan/recovery/selesai, dan terbuka kembali untuk workout baru. Ini mengunci konfigurasi aplikasi; pengguna tetap harus menjaga posisi fisik kamera.
- Field optional `cameraView` tersimpan di preferences IndexedDB. Data lama tetap terbaca. CAS save menolak perubahan arah workout yang sama secara atomic. Riwayat/conflict server mempertahankan konfigurasi lokal yang sudah ada; API tidak mengirim field tersebut dan tidak memerlukan migration database.
- Profil samping/diagonal memilih sisi dengan sendi terlihat/confidence terbaik, mempertahankan sisi selama valid, dan membuang siklus saat berpindah sisi. Curl tetap bilateral; default/depan/belakang memerlukan dua sisi. Aspect-ratio correction, smoothing/debounce, dan unknown/manual tetap berlaku.
- Panduan default memberi saran penempatan sebelum sesi. Pergantian latihan pada sesi aktif hanya memberi kebutuhan visibility, sehingga tidak menyuruh pengguna memindahkan kamera.
- Antrean akun diperiksa kembali setelah flush berhasil supaya save akhir yang tiba saat busy segera dikirim. Failure memakai retry online/manual/timer; konflik tetap memerlukan pilihan pengguna.

## Bukti RED → GREEN

RED pertama: tiga file unit menghasilkan **58 gagal, 21 lulus**. Replay dengan sisi jauh tertutup tidak menghasilkan rep; `cameraView` ditolak sebagai preferences yang belum dikenal. Dua tes browser awal gagal karena dropdown sudut belum tersedia. Sesudah implementasi, semua 79 tes pada tiga file tersebut lulus; empat browser tests tambahan mencakup lock/recovery, setiap arah, replay kamera satu sisi dan data legacy.

Regresi akun terungkap pada dua run bersamaan dengan suite guest: masing-masing satu tes deletion/merged history gagal karena status server masih `active` sementara UI sudah selesai. Trace menunjukkan mutasi aktif mendapat 200 dan outbox akhir masih pending; notifikasi save datang saat flush busy. Sesudah pemeriksaan pending queue ditambahkan, keenam tes akun lulus bersama suite guest dengan assertion dan timeout yang sama. Tes baru menahan respons mutasi aktif, menyelesaikan workout saat in-flight, lalu memeriksa status completed serta tidak adanya camera configuration dalam payload.

RED panduan: satu dari dua tes gagal karena pergantian latihan masih menampilkan instruksi penempatan kamera baru. GREEN memakai kebutuhan sendi saja ketika posisi sudah terkunci.

## Hasil validasi

| Pemeriksaan | Hasil |
| --- | --- |
| `npm --prefix frontend test` | 194 lulus, 13 file; 0 gagal/skipped |
| `npm --prefix frontend run typecheck` | Lulus |
| `EXPO_NO_TELEMETRY=1 npm --prefix frontend run build:web` | Lulus; model lokal checksum terverifikasi dan 25 aset cache offline |
| `npm run test:e2e` | 22 lulus, Chromium; termasuk empat tes arah kamera |
| `npm run test:account` | 6 lulus, Chromium + PostgreSQL nyata + signed OIDC fixture |
| OpenSpec strict validation dan `git diff --check` | Lulus |
| Server Go localhost | Health, katalog lima latihan, save/reload/history arah terkunci, dan bench press 6 × 40 kg = 240 kg diverifikasi |

Cloud menggunakan `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright`, Go 1.27.1 dengan cache workspace, dan PostgreSQL Compose test pada loopback 55432. Lihat panduan localhost untuk command portable. Build awal tanpa aktivasi `EXPO_NO_TELEMETRY=1` gagal menulis konfigurasi Expo di home lingkungan; rerun dengan aktivasi yang didokumentasikan berhasil. Lockfile/dependency tidak berubah.

## Batas bukti dan kelanjutan

Fixture pose geometris hanya membuktikan aturan siklus, visibility dan kontinuitas, termasuk sisi kiri/kanan, mirroring, scaling/translation, dan aspect ratio. Ini bukan video dari berbagai perspektif dan tidak membuktikan angka akurasi. Sudut sendi tetap 2D; MediaPipe tidak menjamin classifier invariant terhadap perspektif. Tidak ada detektor khusus perpindahan kamera. Bila sendi terhalang atau geometry tidak valid, gunakan manual; satu posisi belum tentu cocok bagi semua latihan.

Live testing setiap kombinasi arah/latihan, ≥20 set/latihan dari ≥5 orang dengan split tuning/evaluation, metrik label/reps raw dan unknown failures tetap terbuka. Tidak mengklaim Chrome Android/Edge fisik, Safari/native, ataupun deployment berhasil dari tes Chromium ini.

Pada run ini nama environment `GYMBRO_GOOGLE_CLIENT_ID`, `GYMBRO_GOOGLE_CLIENT_SECRET`, dan `GYMBRO_PUBLIC_URL` terdeteksi terisi; nilainya tidak dicetak/disalin. API capabilities mengembalikan `google_configured: true`. Ini hanya membuktikan konfigurasi terbaca; login Google eksternal dengan akun pengguna belum diuji. Jangan menandai task 5.4 selesai berdasarkan fixture atau capabilities.

Task tahap 7 yang bergantung data nyata tetap terbuka, bersama gate eksternal MVP sebelumnya. Branch/PR ini tidak mengarsipkan change dan tidak melakukan deployment atau merge ke main.
