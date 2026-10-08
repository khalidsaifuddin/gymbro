# Implementation plan tahap 7: pilihan sudut dengan posisi tetap per sesi

Plan ditulis sebelum implementasi pada 9 Oktober 2026. Status: pilihan arah, lock/recovery, side tracking dan regresi sync telah diimplementasikan; bukti tes ada pada `validation-stage-7.md`. Keputusan pengguna: satu posisi kamera selama satu sesi; tidak berpindah saat set, istirahat, atau pergantian latihan. Akurasi sudut pada workout/perangkat nyata tetap menunggu live testing.

## Cakupan dan komponen

Frontend menyediakan pilihan posisi sebelum sesi, lalu menguncinya sampai sesi selesai. Kandidat arah: depan, belakang, diagonal kiri/kanan depan/belakang; panduan samping yang sudah tersedia tetap diperhitungkan. Pilihan arah tidak menjamin semua latihan dapat dihitung dari arah tersebut. Pisahkan profil sudut dari profil latihan yang sudah ada.

Komponen terdampak: panduan kamera dan UI setup, adapter pose/temporal recognizer, state konfigurasi sesi serta recovery IndexedDB, dan tes unit/browser. Penentuan sisi tubuh dan visibility harus sesuai kebutuhan latihan: curl bilateral tetap memerlukan dua lengan; gerakan yang terhalang tetap unknown/manual. Jangan mengubah hasil raw menjadi label otomatis hanya karena pengguna memilih profil.

Konfigurasi sudut hanya lokal pada tahap ini; backend tetap menerima hasil workout tanpa frame/video/landmark. Tambahkan field optional `cameraView` pada preferences IndexedDB, bukan snapshot/API; data lama tanpa field memakai panduan default yang tetap terkunci ketika sesi dipulihkan. Lindungi immutability pada CAS save dan pertahankan field lokal saat menerima history/conflict server untuk workout yang sama. Jangan membuat migration database.

Adapter tetap memakai sudut sendi 2D yang sudah dikoreksi aspect ratio; tidak mengklaim rekonstruksi 3D/invariant semua perspektif. Mode default/depan/belakang mempertahankan pemeriksaan kedua sisi. Profil samping/diagonal memilih satu sisi valid secara konsisten untuk squat/push-up/press; curl tetap bilateral. Saat sisi yang dipakai hilang dan sisi lain menggantikannya, keluarkan observasi invalid dan reset debounce agar siklus tidak menggabungkan dua sisi. Panduan menjelaskan sisi kiri/kanan relatif tubuh pengguna, bukan gambar preview.

Panduan default memberikan saran penempatan sebelum sesi saja. Setelah sesi dimulai, pergantian latihan menampilkan kebutuhan visibility tanpa instruksi memindahkan kamera ke posisi lain.

## Skenario penerimaan dan TDD

1. RED: pilihan sudut dapat diubah sebelum mulai; setelah sesi mulai perubahan ditolak, termasuk ketika paused, istirahat, berganti latihan, dan setelah recovery. GREEN: konfigurasi sesi dikunci dan dipulihkan; sesi baru membuka pilihan lagi.
2. RED: panduan menunjukkan kebutuhan sendi untuk latihan/sudut terpilih; pandangan tidak cukup menghasilkan unknown/manual. GREEN: gating visibility per latihan; tidak memaksakan dukungan setiap arah.
3. RED: siklus terputus tidak menambah rep, tidak menutup set, dan tidak menghapus rep terverifikasi; recovery memerlukan siklus lengkap baru. GREEN: pertahankan aturan tracking loss pada pipeline baru. Pose saja belum menjamin deteksi perpindahan kamera; jangan menjanjikan detektor tersebut tanpa implementasi dan evaluasi khusus.
4. RED: replay berlabel untuk arah yang dikerjakan, gerakan parsial, occlusion, sisi kiri/kanan, dan curl unilateral sebagai kasus penolakan. GREEN: normalisasi fitur dan side selection minimum sesuai bukti; raw classification tetap terpisah dari pilihan pengguna.
5. RED browser: mulai sesi, kunci pilihan, pause/resume, ganti latihan, reload/recovery, manual fallback, selesai dan sesi baru. GREEN: UI dan persistence; pastikan tidak ada upload media/pose.
6. REFACTOR: pisahkan konfigurasi sudut, pemilihan fitur, dan adapter browser; jalankan ulang tes relevan tanpa mengubah bukti RED.

## Urutan dan validasi

Regresi yang ditemukan saat suite guest/akun berjalan bersamaan: notifikasi save akhir sesi dapat tiba ketika flush masih busy setelah claim terakhir kosong. Outbox tetap durable, tetapi upload status completed menunggu timer berikutnya. Tambahkan pemeriksaan antrean pending setelah flush sukses dan refresh selesai; lanjutkan segera bila akun masih sama. Jangan memicu retry tanpa batas pada kegagalan jaringan/API atau konflik. Bukti RED: tes deletion dan merged history gagal dengan status server active meskipun UI selesai; trace menunjukkan mutasi active berhasil dan antrean akhir masih pending. Uji ulang kedua suite bersamaan setelah perbaikan tanpa menaikkan timeout atau melemahkan assertion.

Mulai pada branch fitur sesuai workflow setelah milestone runnable, lalu catat task OpenSpec sebelum kode. Implementasikan konfigurasi/UI/recovery dahulu, kemudian adaptasi deteksi dengan fixture berlabel. Validasi dengan `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build:web`, dan `npm --prefix frontend run test:e2e`. Jalankan suite akun jika perubahan snapshot/mapper memengaruhi sync. Jalankan `openspec validate gymbro-web-mvp --strict` setelah memperbarui spesifikasi.

Live testing menyusul sesuai instruksi pengguna. Catat hasil per kombinasi sudut/latihan, unknown, selisih reps, dan kondisi occlusion. Gate awal minimal 20 set dari 5 orang per latihan tetap berlaku; perlu cakupan tambahan tiap arah yang hendak diklaim. Fixture sintetis tidak membuktikan akurasi nyata. Laporkan arah yang belum diuji atau gagal secara eksplisit.
