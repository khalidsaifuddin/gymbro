# Implementation plan tahap 8: empat latihan tarik

Tanggal: 9 Oktober 2026, Asia/Jakarta. Pengguna menyetujui empat varian cable bilateral di bawah. Total katalog menjadi sembilan gerakan. Plan ditulis sebelum kode; implementasi mengikuti TDD. Akurasi perangkat nyata belum diklaim.

## Cakupan yang disepakati

Varian disepakati: lat pulldown bilateral ke depan dada, seated cable row bilateral, rope face pull bilateral, dan straight-arm cable pulldown bilateral. Satu siklus kedua tangan bersama dihitung satu rep; beban menggunakan angka satu weight stack dengan implement count 1. Behind-the-neck, single-arm, dan chest-supported machine row di luar batch ini.

| Gerakan | Siklus kandidat untuk diuji | Ciri pembeda |
| --- | --- | --- |
| Lat pulldown | Tangan di atas → tarik ke dada dengan siku menekuk → kembali ke atas | Tarikan vertikal, tubuh duduk; perlu dibedakan dari shoulder press |
| Seated row | Lengan terulur di depan → tarik ke torso → kembali terulur | Tubuh duduk, tarikan horizontal ke torso |
| Face pull | Lengan terulur → tangan mendekati wajah dan siku membuka → kembali | Berdiri, tarikan ke wajah; membutuhkan landmark kepala yang terlihat |
| Straight-arm pulldown | Tangan di depan/atas → turun mendekati pinggul → kembali | Berdiri, sudut bahu berubah sementara siku relatif lurus |

Tabel ini adalah desain awal fitur, bukan ambang final atau penilaian teknik. Hitung hanya siklus lengkap; siklus parsial, occlusion, pergantian sisi dan pause membuang siklus yang terputus tanpa menghapus rep terverifikasi. Tetap satu posisi kamera sepanjang sesi. Panduan posisi samping/diagonal adalah kandidat untuk pengujian; tidak menjanjikan semua perspektif cocok. Visibility bilateral dan bagian tubuh pembeda harus dievaluasi per gerakan.

Pose tubuh tidak memastikan cable, attachment, atau berat yang digunakan. Pisahkan raw classification dari profil latihan pilihan pengguna. Jika dua pola tidak dapat dibedakan, keluarkan unknown dan sediakan profil latihan/manual, tanpa menjadikan profil sebagai label otomatis. Untuk satu weight stack yang digerakkan bersama, rekomendasi beban adalah angka kg mesin dengan implement count 1, bukan dikali dua karena dua tangan.

## Komponen dan kompatibilitas

- Katalog frontend: satukan metadata gerakan yang kini tersebar pada domain, snapshot/local validators, recognition registry, panduan, input beban dan mapper. Pertahankan UUID lima gerakan lama; tetapkan UUID stabil bagi empat gerakan baru.
- Deteksi: perlu fitur arah lengan/tangan relatif shoulder/hip, posisi seated/standing, rentang siku dan kepala untuk face pull. MediaPipe yang sudah dipin tetap dipakai; tanpa model baru, inferensi server atau upload landmark/video. Uji ambiguity dengan machine shoulder press, curl, bench press, serta empat pola baru satu sama lain.
- Tes pembeda pulldown/shoulder press memerlukan guard bahwa tangan pada press berada dekat/di atas bahu, sedangkan pulldown mencapai depan dada. Fixture press lama memakai lengan curl dengan tangan di bawah bahu; perbaiki koordinat sintetis sesuai pose press pada panduan SVG, tanpa mengurangi assertion satu siklus/satu rep. Catat perubahan ini sebagai koreksi fixture dan threshold prototipe, bukan bukti akurasi nyata.
- Persistence/sync: catatan lima gerakan lama tetap valid. Binding lama belum memiliki occurrence ID gerakan baru; lengkapi ID saat diperlukan tanpa mengubah envelope mutasi yang sudah sending. Unknown catalogue pada client lama tidak boleh menyebabkan silent overwrite atau kehilangan data lokal.
- Backend: migration baru menambah rows `ref.exercises` dan metadata `ref.exercise_assets`; jangan mengedit migrations 001–003 yang sudah diterapkan. Public/log tetap memakai struktur existing. Verifikasi summary kg, owner isolation dan FK dengan PostgreSQL nyata.
- Aset: empat SVG animasi dan pose awal/akhir original, source generator, manifest/checksum serta atribusi CC-BY-4.0. Ilustrasi bukan data pelatihan atau bukti akurasi.

## TDD dan urutan pekerjaan

1. Finalisasi varian dari jawaban pengguna, tambahkan OpenSpec change untuk perluasan sembilan gerakan, dan buat branch fitur terpisah. PR kamera #1 masih terbuka saat draft ditulis; tentukan base sesuai status merge saat implementasi dimulai, tanpa memasukkan fitur baru ke PR itu.
2. RED katalog/compatibility: old snapshot, new exercise validity, input beban mesin, stable IDs, dan binding lama yang menerima gerakan baru. GREEN registry serta pengayaan binding; preserve immutable in-flight jobs.
3. RED pose/domain: lengkap/parsial/reversed direction, kepala/sendi hilang, gerak satu tangan, jitter, pause, perubahan sisi dan false reps dari sway tubuh. RED temporal: label ambiguity dan regresi lima gerakan lama. GREEN fitur/adapter/state yang minimum dan tetap unknown pada sinyal ambigu.
4. RED PostgreSQL: katalog sembilan, upgrade database yang sudah berisi data tanpa mengubah workout/history/session lama, FK gerakan baru, persistence/summary cable stack serta rollback hanya DB disposable. GREEN migration/master/assets sesuai varian final.
5. RED browser: empat profil dan panduan/SVG, replay camera output, manual fallback, set/reps/summary/koreksi, lock posisi sesi, recovery/offline dan guest-to-account history. GREEN UI/API sync; periksa requests tanpa media/pose.
6. REFACTOR dan verifikasi frontend unit/type/build, backend integration/race, guest/account browser suites, OpenSpec strict serta startup/readiness localhost. Simpan failures RED dan hasil GREEN sebenarnya.

Command dasar: `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build:web`; `go test -tags integration -race ./...` dari backend dengan PostgreSQL test yang didokumentasikan; guest/account Playwright dari frontend. Gunakan tool/env activation pada panduan localhost/cloud. Jangan mengganti tes perilaku dengan sekadar penambahan nama katalog.

## Evaluasi nyata

Susun data berizin dengan split tuning/evaluation per partisipan. Gate per latihan tetap ≥90% label benar dan ≥90% set dengan error maksimal satu rep, pada minimal 20 set dari ≥5 orang. Unknown dihitung gagal untuk label dan koreksi manual tidak memperbaiki skor otomatis. Catat kondisi kamera/alat, occlusion dan confusion antar gerakan; jangan mengklaim semua sudut didukung berdasarkan fixture geometris. Live testing berlangsung setelah aplikasi runnable sesuai keputusan pengguna.
