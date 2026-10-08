# Riset aset demonstrasi latihan

## Kesimpulan

Belum ditemukan koleksi animasi lengkap untuk lima gerakan MVP dengan lisensi media yang terverifikasi. Lisensi kode suatu repository tidak otomatis menjadi lisensi foto, GIF, atau video yang dirujuknya.

## free-exercise-db

[Repository](https://github.com/yuhonas/free-exercise-db), commit diperiksa: `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.

| Gerakan | ID | Media yang ditemukan |
| --- | --- | --- |
| Squat bodyweight | `Bodyweight_Squat` | Dua JPG statis |
| Push-up | `Pushups` | Dua JPG statis |
| Dumbbell biceps curl | `Dumbbell_Bicep_Curl` | Dua JPG statis |
| Machine shoulder press | `Machine_Shoulder_Military_Press` | Dua JPG statis |
| Flat barbell bench press | `Barbell_Bench_Press_-_Medium_Grip` | Dua JPG statis |

[README](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/README.md) menyatakan dataset public domain dan penggunaan JSON/gambar secara lokal. [LICENSE.md](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/LICENSE.md) berisi Unlicense, yang mengizinkan penggunaan komersial tanpa kewajiban atribusi/share-alike.

README merujuk sumber [wrkout/exercises.json](https://github.com/wrkout/exercises.json), tetapi kepemilikan dan lisensi fotografer tidak tercatat per aset. Ini kandidat gambar berdasarkan deklarasi penerbit, bukan verifikasi hak setiap foto. Tidak ditemukan GIF/video/model animasi dalam tree yang diperiksa; mengganti dua gambar menghasilkan slideshow dua pose, bukan animasi gerakan mulus.

## Wger

[README](https://github.com/wger-project/wger/blob/master/README.md#license) membedakan kode AGPL-3.0-or-later dari data latihan Creative Commons dengan lisensi individual.

[Model gambar](https://github.com/wger-project/wger/blob/master/wger/exercises/models/image.py) memvalidasi gambar statis dan menolak animasi. [Model video](https://github.com/wger-project/wger/blob/master/wger/exercises/models/video.py) mendukung video dengan metadata lisensi individual. [Fixture lisensi](https://github.com/wger-project/wger/blob/master/wger/core/fixtures/licenses.json) mencakup CC0, CC-BY, dan CC-BY-SA, di antaranya.

API katalog langsung mengembalikan proxy HTTP 403 dalam lingkungan ini; cakupan video untuk kelima gerakan belum terverifikasi. Sebelum mengambil aset, periksa lisensi tiap video dan catat pembuat, sumber, serta perubahan. CC-BY memerlukan atribusi; CC-BY-SA juga memerlukan lisensi sama untuk adaptasi aset; CC0 tidak mewajibkan atribusi.

## ExerciseDB

[Repository](https://github.com/ExerciseDB/exercisedb-api) mengiklankan GIF/video dan merujuk pricing serta terms of use. Hak redistribusi media secara terbuka belum terverifikasi; sumber ini belum dipilih.

## Opsi lanjutan yang diusulkan

1. Buat animasi SVG original untuk kelima gerakan, simpan source yang dapat diedit, dan tetapkan lisensi terbuka untuk aset. Ini pekerjaan produksi aset baru, bukan animasi yang sudah ditemukan.
2. Verifikasi video Wger satu per satu bila katalog dapat diakses.
3. Gunakan ilustrasi statis sebagai fallback dengan batas bukti lisensi di atas.

Pengguna menyetujui opsi 1. Lima SVG original dan lima diagram pose awal/akhir kini tersedia di `frontend/public/exercises`, source yang dapat diedit `frontend/scripts/generate-exercise-guides.mjs`, metadata manifest dan lisensi aset CC-BY-4.0 dengan atribusi Gymbro contributors. Animasi menggunakan interpolasi posisi anggota tubuh; reduced motion menampilkan diagram statis. Belum ada media pihak ketiga yang diimpor. Animasi demonstrasi bukan model pengenalan gerakan dan bukan bukti akurasi deteksi.
