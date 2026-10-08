# Validasi tahap 3: workout lokal dan panduan visual

## Bukti TDD

- Snapshot RED: 11 tes gagal karena `exportSnapshot` belum tersedia. GREEN: 11 lulus, mencakup delapan rep, partial-cycle reset, durasi pause, finished summary, clone, provenance merge, dan snapshot invalid.
- IndexedDB RED: suite gagal dimuat karena adapter belum ada (0 tes dieksekusi; bukan lima assertion failures). GREEN: lima tes transaksi/reopen/conflict/delete/validation lulus memakai fake-indexeddb 6.2.5, kemudian recovery dan konflik dua tab diuji pada IndexedDB Chromium nyata.
- Log browser RED: tes pertama gagal karena tidak ada persistence acknowledgement; tiga tes lain belum dijalankan pada run baseline dengan `--max-failures=1`. GREEN: interaction assertions untuk tabel, edit reps/beban, invalid input, merge, previous result, timer per latihan dan recovery lulus.
- Checkpoint RED: waktu snapshot tidak maju selama sesi idle. GREEN: waktu aktif disimpan tiap lima detik, sedangkan sesi paused tidak melakukan write berkala.
- Offline RED: status cache siap tidak tersedia. GREEN: aplikasi dan worker MediaPipe nyata berhasil dimuat ulang tanpa jaringan, catatan delapan rep dipulihkan, ditambah tiga rep manual dan finished history bertahan setelah reload offline.
- Recorder RED: suite unit gagal dimuat karena adapter belum ada; dua browser scenarios gagal karena opt-in belum tersedia. Tes stop failure tambahan gagal karena error dan lifecycle belum ditangani. GREEN: tujuh tes unit dan tiga browser scenarios lulus, termasuk default tidak membuat MediaRecorder serta file segmen WebM yang bisa dibaca/diputar.
- SVG RED: objek demonstrasi belum tersedia. GREEN: kedua browser scenarios lulus untuk lima aset, interpolasi antara pose (bukan dua-frame slideshow), diagram awal/akhir, lisensi dan reduced motion.

## Hasil suite

Frontend: **112 tes unit dalam delapan file**, **18 tes browser**, type check dan web build lulus. Playwright Chromium 156.0.8078.4 headless memakai synthetic camera; worker smoke menjalankan model/WASM nyata pada canvas kosong. Network assertions kamera/recording hanya GET ke origin lokal, tanpa video/frame/pose upload. Screenshot tabel/log serta contact sheet kelima panduan diperiksa; angka live kamera besar, log memakai tabel lebih ringkas.

Command aktual dari `frontend`: `npm test`, `npm run typecheck`, `EXPO_NO_TELEMETRY=1 npm run build:web`, `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/playwright npm run test:e2e`. Web build disajikan di port 8082 dan GET root berhasil untuk readiness/visual review. Server Playwright sendiri memakai 8081/8091.

## Perilaku persistence dan batasnya

IndexedDB menyimpan snapshot terverifikasi, preferences dan revisi; tidak menyimpan video, frame, atau pose. Penyimpanan bertahap berjalan saat hasil/set/pause/preferences berubah, ditambah checkpoint waktu tiap lima detik selama sesi aktif. Recovery menawarkan sesi paused, membuang state siklus, dan meminta kamera diaktifkan kembali. Interval dari checkpoint terakhir ke recovery dianggap pause; durasi aktif hingga lima detik sebelum crash dapat terpotong. Clock snapshot memakai waktu perangkat.

Write berurutan; UI "Tersimpan" menunggu write terbaru. CAS dalam transaksi menolak tab dengan revisi lama tanpa overwrite. Storage unavailable/error menampilkan bahwa hasil hanya ada di memori; JSON export tersedia. Data corrupt tidak dihapus otomatis. Riwayat tamu hanya milik browser ini dan hilang bila data situs dibersihkan. Store outbox disiapkan tetapi auth/sync akun dan pilihan konflik server adalah pekerjaan tahap 5, belum diklaim berfungsi.

Service worker pada **web build** precache aplikasi/model/WASM/SVG same-origin dan memberi ready acknowledgement setelah seluruh aset ada. Versi baru menghapus cache aplikasi lama. Initial usage membutuhkan internet dan ruang cache sekitar 47 MB. Mode Expo development tidak menjanjikan offline reload; gunakan port terpisah untuk development dan static build agar service worker tidak menutupi dev server.

Recorder mati secara default, hanya opt-in sebelum sesi. Pause/background menghentikan segmen; resume membuat file mandiri baru. Save berupa download Blob lokal; discard/revoke URL tidak menghapus workout. Segmen terlalu singkat tanpa frame ter-encode dapat tidak menghasilkan file. Video tidak disimpan di IndexedDB dan tidak dipulihkan setelah reload. Format dipilih dari dukungan browser WebM/MP4; Safari/native belum tervalidasi.

## Bukti yang masih belum ada

Belum ada live testing kamera/rekaman/performa pada perangkat fisik dan belum ada metrik akurasi lima latihan. Sesuai instruksi pengguna, lakukan setelah MVP bisa diakses dari localhost. Task 2.5–2.7, 3.7 dan 6.4 tetap terbuka. Tidak mengubah gate ≥90% label dan ≥90% hitungan dalam ±1 rep atau memakai koreksi sebagai skor otomatis. Database, API workout, OAuth, account sync dan deployment belum selesai pada milestone ini.
