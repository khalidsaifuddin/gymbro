# Rencana implementasi: overlay sendi dan posisi kamera

## Cakupan

Tambahkan overlay pada preview kamera web yang menggambar sendi serta sambungan pose dari MediaPipe yang sudah diproses di perangkat. Tampilkan bingkai panduan dan pesan singkat agar pengguna dapat menempatkan bagian tubuh yang diperlukan untuk profil latihan yang dipilih. Overlay membantu framing; status pengenalan gerakan dan hitungan rep tetap berasal dari recognizer yang ada. Tidak ada sensor LiDAR, estimasi kedalaman, upload pose/video, perubahan API, atau klaim akurasi baru.

Layout workout satu layar penuh ditunda untuk tahap UI/UX berikutnya sesuai keputusan pengguna; perubahan ini mempertahankan layout halaman sekarang.

Rencana ini melanjutkan panduan posisi dan tracking loss pada `docs/implementation-plan.md` tahap 2–3, task 2.4/3.2 pada change `gymbro-web-mvp`, dan requirement camera positioning pada spec change tersebut.

## Komponen terdampak

- `frontend/src/detection/camera-framing.ts`: evaluasi sendi yang dibutuhkan per latihan/sudut, posisi dalam frame, dan data sambungan yang dapat digambar tanpa DOM.
- `frontend/src/components/CameraPrototype.web.tsx`: overlay SVG yang mengikuti area video termasuk letterbox, pesan framing di atas preview, dan reset saat kamera dijeda/berhenti.
- `frontend/src/detection/camera-framing.test.ts` dan `frontend/e2e/camera-framing.spec.ts`: tes perilaku dari pose sintetis dan rendering browser.
- `frontend/scripts/serve-vision-smoke.mjs` dan `frontend/playwright.config.ts`: pindahkan output sementara tes browser dari path cloud `/workspace` ke cache lokal yang diabaikan Git dan gunakan Python 3 untuk server statis agar tes dapat berjalan pada macOS.
- Spec/task OpenSpec kamera dan dokumentasi validasi: kriteria penerimaan serta batas bukti.

## Skenario penerimaan

1. Sebelum pose terdeteksi, preview menampilkan bingkai dan instruksi menempatkan tubuh tanpa menampilkan kerangka palsu.
2. Saat pose terdeteksi, hanya sendi dengan koordinat/visibility valid yang digambar; sambungan tidak melintasi sendi yang hilang. Koordinat cocok dengan video dalam orientasi portrait maupun landscape dan saat `object-fit: contain` memberi letterbox.
3. Untuk curl, kedua bahu, siku, pergelangan tangan, dan pinggul harus terlihat. Bila satu pergelangan hilang, overlay memberi instruksi menampilkannya dan tidak menyebut framing baik.
4. Profil lain memakai sendi yang sesuai. Sudut samping/diagonal boleh memakai satu sisi untuk latihan yang memang mendukungnya; curl dan cable tetap bilateral. Bingkai memberi petunjuk pusat/tepi tanpa mengubah sudut kamera yang sudah terkunci.
5. Status overlay berbeda dari status recognizer: framing baik tidak berarti gerakan dikenali atau rep dihitung. Saat pause, error, atau workout selesai, kerangka lama hilang. Overlay tidak menangkap klik, tidak direkam sebagai data workout, dan tidak menambah request media/pose ke server.

## Urutan kerja dan validasi

1. RED: tulis tes unit untuk sendi/sambungan valid, curl bilateral, profil satu sisi, tubuh di tepi, dan tes browser untuk preview/pose/pause. Jalankan tes terarah dan catat kegagalan karena overlay belum ada.
2. GREEN: implementasikan evaluasi framing dan SVG overlay memakai landmark yang sudah dikirim worker; pertahankan pengenalan dan recording.
3. REFACTOR: sederhanakan peta sendi, periksa ukuran portrait/landscape dan aksesibilitas pesan, lalu jalankan tes yang relevan.
4. Verifikasi `volta run --node 24 --bundled-npm npm --prefix frontend test`, `run typecheck`, `run build:web`, dan `npm run test:e2e` terarah. Uji perangkat nyata dan akurasi pengenalan tetap terpisah; tes sintetis hanya membuktikan logika/visual overlay.
