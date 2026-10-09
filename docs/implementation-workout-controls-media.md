# Implementation plan: kontrol set, push-up, dan detail latihan

Status: **implementasi berjalan**, 2026-10-09. Kode berada pada branch `feature/pushup-set-controls-exercise-details`. Awal perubahan berasal dari `02cf972`; perubahan plan dari sesi terdahulu tetap dipertahankan.

## 1. Cakupan dan keputusan

- Perbaiki push-up yang tidak menghasilkan rep; pertahankan perilaku curl/squat yang menurut live testing pengguna meningkat drastis. Laporan pengguna ini belum berupa evaluasi akurasi berlabel dengan jumlah set/rep.
- Tambahkan `Akhiri set & kembali` di sebelah `Akhiri set` pada kamera satu viewport. Workout tetap aktif.
- Set selesai pada kartu latihan dapat diedit kg/reps secara manual, dihapus, dan di-uncheck.
- Default uncheck: row tetap ada dengan nilai terakhir, tidak masuk completed totals, dapat dicentang ulang. Pengguna menyetujui pelaksanaan plan ini.
- Detail latihan dapat dibuka dari Explore, picker, routine, dan kartu workout, dengan alat, otot, instruksi, demonstrasi, serta navigasi kembali yang menjaga konteks.
- Gunakan visual Flow dataset yang dipilih pengguna: import 1.257 animasi SVG/3.771 frames dan tampilkan 67 exercise tanpa placeholder palsu. Metadata instruksi lama tetap dari dataset ber-ID sama.
- Pending rows/target/draft tetap browser-local seperti routine dan rencana sesi sekarang; hasil set selesai, koreksi, uncheck yang menghapus hasil selesai, dan delete memakai sinkronisasi aggregate yang sudah ada. Draft pending tidak dijanjikan lintas perangkat.
- Kamera hanya untuk sembilan latihan yang didukung, termasuk setelah media katalog tersedia. GIF demonstrasi tidak menjadi data training atau bukti deteksi.

## 2. Temuan kode yang menentukan desain

1. `PosePhaseAdapter`: push-up memakai alpha 0.65, debounce 80 ms, ready 155° dan peak 100°. `allowsSingleSide('auto')` false, sedangkan guide default push-up meminta kamera samping. Jauh arm yang tertutup dapat membuat semua frame invalid.
2. Posture horizontal dan posisi tangan relatif torso digunakan untuk membedakan push-up/bench press. Guard ini tidak boleh dihapus agar sekadar menambah count.
3. `ExercisePlanCards`: completed kg/reps adalah `<span>`, done adalah simbol `✓` bahkan untuk set aktif; `actual[index]` mencocokkan row berdasarkan posisi. Menghapus/uncheck row tengah saat ini akan menggeser pasangan target/result.
4. `WorkoutSession` sudah punya `correctSet`, `setLoad`, `endSet`, raw `detectedReps`, label source, serta merge provenance. Belum ada delete atau restore completed set. Koreksi reps hanya untuk set selesai.
5. `WorkoutLog` sudah punya input edit tetapi terpisah dari kartu utama; checkbox di sana berarti **merge**, bukan completion.
6. `closeCamera` menghentikan resource dan kembali ke sesi tanpa `endSet`; aksi gabungan perlu menutup set sebelum keluar.
7. `WorkoutStore` menyimpan preferences dan snapshot bersama dalam satu record dengan optimistic revision. Validator menolak field tidak dikenal, sehingga penambahan state row wajib disertai validator/recovery.
8. Sync DTO memuat hasil set dan provenance, bukan rencana pending. `SyncStore.receive/resolve` saat ini mempertahankan camera preferences tetapi tidak rencana row; perlu rekonsiliasi eksplisit ketika menerima server snapshot.
9. Metadata impor tidak menyimpan `gif_url`, media ID, supporting muscles. Source teks lama dipin pada `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`; identitas dataset/UUID tidak boleh berubah ketika mengambil media dari versi source lain.
10. `prepare-offline.mjs` mengumpulkan seluruh file dist untuk precache. Animasi Flow sekitar 49 MB dan tidak boleh diunduh sekaligus saat install; service worker mengecualikan direktori library.

## 3. Push-up: desain dan penerimaan

### Perubahan terarah

- Tambahkan policy shared, misalnya `visibleSidePolicy(exercise, cameraView)`. Untuk **push-up + auto**, policy default mengikuti guide samping: satu sisi lengkap yang confidence-nya memadai. Front/back eksplisit tetap membutuhkan kedua sisi; side/diagonal eksplisit tetap menggunakan satu sisi konsisten. Jangan mengubah aturan bilateral curl.
- Gunakan policy yang sama di adapter dan framing overlay agar guide tidak meminta sendi yang sengaja tidak diperlukan. Kamera pilihan tersimpan tetap `auto`; tidak mengklaim sudut kamera diinfer dari pose.
- Seleksi sisi memakai shoulder/elbow/wrist/hip dari sisi yang sama. Sisi tidak boleh berganti di tengah rep; jika berganti, buang siklus parsial.
- RED terlebih dahulu untuk default side view dengan arm jauh occluded, fixture realistis dengan wrist tetap di lantai dan shoulder/elbow/hip bergerak, dan siklus tanpa tahan endpoint.
- Parameter push-up yang diusulkan: EMA 0.85, minimal dua frame/30 ms, ready ≥145°, peak ≤110°, confidence sendi relevan ≥0.45. Terapkan hanya setelah replay menunjukkan kegagalan pada profil lama. Siklus harus kembali ready sebelum satu rep dicatat; jangan menghitung setiap frame peak.
- Pertahankan batas torso horizontal, wrist berada pada sisi lantai relatif torso, bounds gambar, timestamp, frame gap, dan interruption. Variasi knee/incline/decline belum otomatis dianggap profil standard push-up.
- Tampilkan status singkat yang dapat ditindaklanjuti (`Posisi atas`, `Turun`, `Sendi sisi yang dipantau tidak terlihat`) dalam area status kamera yang ada. Detail teknis angle/fps tidak menjadi alur utama pengguna.
- Sudut 3D curl tetap khusus curl. Tidak memperluas 3D ke semua latihan tanpa kebutuhan yang direproduksi.

### Acceptance

- Tiga siklus lengkap side view default dengan sisi jauh tidak terlihat menghasilkan tiga rep; sisi dekat harus lengkap.
- Gerakan 148° → 108° → 148° dengan endpoint singkat menghasilkan rep pada timing produksi 30 fps.
- Plank diam, jitter dekat ready/peak, satu spike, gerakan belum kembali atas, berdiri, bench press, kehilangan wrist, dan perubahan sisi tidak menambah rep palsu.
- Explicit front/back tidak diam-diam menerima satu sisi. Curl/squat/cable/press suites tetap lulus.
- Uji pengguna: 10 push-up actual vs automatic count sebelum koreksi, catat perangkat, posisi kamera, tracking reason bila gagal. Tes sintetis tidak membuktikan ≥90% akurasi.

## 4. Identitas row, edit, uncheck, delete

### State yang diusulkan

Pertahankan `WorkoutSet`/snapshot v1 sebagai hasil yang dihitung. Tambahkan browser-local `sessionRows?: Partial<Record<ExerciseId, SessionSetRow[]>>` pada `WorkoutPreferences`:

```ts
type SessionSetRow = {
  id: string;                 // UUID row, stabil; bukan index render
  target: SetTarget;          // reps/loadKg terakhir untuk row pending
  resultSetId?: string;       // menunjuk hasil pada snapshot ketika tercatat
  savedResult?: WorkoutSet;   // sumber asli ketika hasil di-uncheck
};
```

- Invariant: satu row tidak boleh punya `resultSetId` sekaligus `savedResult`; satu result ID hanya terikat pada satu row, exercise harus cocok, row IDs unik, field/angka/source set divalidasi ketat. `savedResult` harus completed dan mempertahankan provenance, bukan blob bebas.
- Routine targets tetap model yang ada; ketika mulai sesi, buat row UUID baru dan copy target. Mengubah row sesi tidak mengubah routine sumber.
- Migrasi record legacy dilakukan satu kali pada load: setiap exercise punya row sebanyak max(target count, result count), padankan index lama satu kali lalu simpan reference ID. Semua operasi sesudah migrasi memakai ID.
- Hasil kamera baru diikat ke row pending kosong pertama untuk exercise tersebut, atau append row jika tidak ada. Row pending hasil uncheck dengan `savedResult` tidak otomatis diisi ulang oleh kamera; restore dilakukan lewat checkbox agar hasil lama tidak tertimpa.
- Kartu juga menampilkan hasil tanpa plan (misalnya global automatic camera/manual logger); buat row identity sebelum render interaktif. Result aktif ditandai `LIVE`, bukan checkbox completed.
- `WorkoutLog`/merge dan kartu memakai hasil domain yang sama. Setelah merge, rekonsiliasi references untuk ID sumber yang hilang; satu row menunjuk merged set, row sumber lain menjadi target pending tanpa restore sumber yang akan menggandakan merge.

### Operasi domain dan UI

1. **Edit completed**: input lokal kg/reps + Save atau commit on blur/Enter; validasi seluruh edit sebelum mengubah domain, lalu `correctSet` dan `setLoad`. Batalkan mengembalikan nilai lama. Reps integer 0..2147483647; kg kosong = null, nilai 0..99999.999 dengan tiga desimal. `detectedReps`, raw exercise/label source, source IDs, dan waktu asli tidak ditulis ulang oleh koreksi.
2. **Uncheck**: salin hasil completed ke `savedResult`, salin nilai final ke target, hapus hasil dari `WorkoutSession`, kosongkan result reference. Simpan snapshot+preferences dalam satu record/revision. Total set/reps/volume segera berubah. Row lain tidak bergeser.
3. **Recheck**: jika savedResult ada, restore completed result dengan ID/provenance/waktu lama dan kg/reps terakhir yang diedit; jangan membuatnya seolah-olah hasil kamera baru. Jika row target baru, gunakan manual completion dengan timestamp sekarang. Repeated clicks tidak membuat duplikat.
4. **Delete set**: action menu per row, confirmation menyebut nomor/latihan, lalu hapus row serta actual result atau saved draft terkait. Jangan menghapus exercise/routine atau set lain. Render nomor berurutan setelah delete namun identity/reference row tetap stabil. Add Set tetap tersedia, termasuk setelah row terakhir dihapus.
5. **Active set**: reps/delete/uncheck disabled dengan pesan untuk mengakhiri set dahulu; edit load aktif tetap mengikuti kemampuan domain yang ada. Tidak kehilangan streaming count karena input user.
6. **Finished history**: gunakan domain corrections yang ada dan normal aggregate upsert; tidak membuka kembali sesi atau mengubah finishedAt. Pending row yang di-uncheck tetap draft lokal, bukan set selesai pada history server.

Tambahkan domain APIs `removeCompletedSet(id)` dan `restoreCompletedSet(saved, edits)` (nama final boleh konsisten dengan style repo). Validasi ID, exercise, timestamps, provenance, duplicate IDs, completed status dan input sebelum mutasi. Restore insert berdasarkan timeline asli; summary/rest memakai remaining chronological results. Delete/uncheck tidak mereset session start/finish/pause. Domain tidak menyimpan UI row state.

### Persistence/sync

- `WorkoutStore.validateRecord`: accept dan validate sessionRows; reject references asing/duplikat/cross-exercise. Draft bukan bagian session snapshot/DTO.
- Simpan perubahan row dan snapshot atomik dalam transaksi IndexedDB yang sama; error persistence menampilkan status gagal, tidak memberi klaim tersimpan.
- Server tidak membutuhkan status checkbox/schema baru: unchecked/deleted results memang tidak dikirim dalam aggregate. Repository replacement/upsert yang ada harus menghapus nested row lama pada revision baru.
- Extend `SyncStore.receive/resolve` dengan rekonsiliasi rows terhadap server snapshot: jangan recreate result yang dihapus server; preserve unrelated pending targets lokal pada pull normal. Saat memilih versi server untuk conflict, source hasil lokal yang berbeda tidak boleh tersedia sebagai silent restore; buang savedResult yang konflik dan gunakan server IDs/current values.
- Pending draft/targets hanya pada browser asal. Completed IDs/provenance tetap melalui DTO. Jangan mengiklankan pending row cross-device sync.
- Tidak rencana migration SQL untuk row editing. Bila integration RED menunjukkan aggregate deletion tidak benar, perbaiki repository qualified yang ada, tanpa migration kosong.

### Acceptance minimum

- Tiga completed rows A/B/C: edit B, uncheck B, reload, recheck B, lalu delete B; A/C mempertahankan ID/nilai, target tidak bergeser, jumlah tidak duplikat.
- Automatic B 10 detected reps dikoreksi 8, uncheck/recheck: raw tetap 10, final 8. Dua dumbbell 10 kg ×8 menghasilkan 160 kg.
- Uncheck 8-rep set mengurangi totals 8; nilai input tetap tersedia. Delete menghapus row, uncheck mempertahankan row.
- Reps/kg invalid tidak mengubah domain maupun persistence. kg kosong berbeda dari 0. Aktif tidak bisa dihapus/uncheck.
- Delete/uncheck terakhir menghasilkan total 0 yang valid; duration/finishedAt/pause tetap. Merge tidak bisa menggandakan hasil lewat recheck.
- Real PostgreSQL: edit/delete/uncheck completed aggregate, retry idempotent, pull, owner isolation, dan conflict/stale revision tidak membangkitkan set lama.

## 5. Aksi kamera: akhiri dan kembali

- Pertahankan `Akhiri set`: `endSet`, refresh, tetap di kamera untuk set berikutnya.
- Tambahkan `Akhiri set & kembali`: disable saat model sedang memulai/aksi sedang diproses; stop frame scheduling dan streaming resource, `endSet` satu kali, refresh/persist, tampilkan session.
- Sediakan satu helper controller agar camera stop, recorder segment handling, detector worker cleanup, overlay reset, dan navigation tidak punya dua implementasi berbeda.
- `Back to workout` yang ada tetap menutup kamera sambil mempertahankan hasil; jangan diam-diam menjadikannya finish workout. Pending profile change diselesaikan/direset konsisten sebelum exit.
- Acceptance: sesudah dua rep, aksi gabungan menampilkan tepat satu completed set dua rep pada session; workout tidak finished, kamera/worker/recorder tidak aktif, tidak ada rep baru dari promise/frame terlambat, reload memulihkan hasil.
- Jika belum ada rep, aksi gabungan tetap kembali tanpa membuat empty/fake set. Tombol dapat dijangkau tanpa scroll pada viewport ponsel portrait/landscape bersama kontrol lain.

## 6. Detail latihan dan animasi Flow

### Dataset visual terpilih (diperiksa 2026-10-09)

Gunakan [ozansozuozgit/flow-exercise-dataset](https://github.com/ozansozuozgit/flow-exercise-dataset) untuk animasi, menggantikan permintaan GIF dari repository sebelumnya. README menyebut 1.324 record, 1.257 animasi khusus (3.771 SVG frames; ~44 MB), 67 tanpa animasi. [ARTWORK-LICENSE](https://github.com/ozansozuozgit/flow-exercise-dataset/blob/main/ARTWORK-LICENSE) mendedikasikan hak artwork custom yang dimiliki ke CC0-1.0; [NOTICE](https://github.com/ozansozuozgit/flow-exercise-dataset/blob/main/NOTICE.md) mencatat keterbatasan provenance: hanya 13 prompt awal tersisa, sehingga tidak ada jaminan clearance pihak ketiga lengkap. Data teks berasal dari dataset sebelumnya di bawah MIT dan Flow mempertahankan noticenya. Jangan menganggap animasi sebagai coaching tervalidasi; ilustrasi dapat memiliki variasi/ketidakakuratan bentuk.

Pin commit source, catat attribution/licence/provenance notice, dan verifikasi integrity validator sebelum import. Jika network/commit tidak dapat diakses, jangan pin `main` sebagai versi final; selesaikan UI/resolver serta lanjutkan fitur lain tanpa mengarang checksum atau mengklaim assets tersedia.

### Import dan pemutaran

- Pin commit source dan `data/exercises.json` checksum ke manifest yang dihasilkan dari repository asli. Validasi 1.324 ID unik, 1.257×3 frame path, sequence, duration, ukuran, MIME/signature, checksum, dan SVG-only sanitization; `instructions-only` tidak boleh memakai ilustrasi pengganti. Jangan fuzzy match berdasarkan exercise name.
- Map `dataset:NNNN` melalui exact source ID; pertahankan 1.324 ID/UUID Gymbro yang ada dan jangan diam-diam mengganti metadata instruksi lokal. Untuk sembilan Gymbro camera movements, gunakan Flow illustration hanya setelah exact variant review; camera-specific unsupported variant menampilkan detail tanpa ilustrasi yang salah.
- Importer `frontend/scripts/import-exercise-media.mjs` membangun manifest metadata ringan dan menyalin SVG dari source checkout ber-pin ke `frontend/public/exercise-media/<commit>/...`; jangan menyimpan 44 MB assets di Git sebelum ada review ukuran repository/distribusi. NPM script harus idempotent dan gagal jelas pada source/hash/asset mismatch.
- Build tanpa hasil import tetap berjalan dengan unavailable state. Local web build dari checkout Flow yang dipin memuat animasi first-party/static same-origin.
- `prepare-offline.mjs` mengecualikan exercise-media library dari eager install precache. Tidak ada preloading seluruh library: detail memuat tiga frames hanya saat dibuka, stop/back melepas player. Offline tanpa asset cached menunjukkan status unavailable.
- Player memulai explicit click; autoplay mati. Menukar 3 SVG frames memakai sequence `[0,1,2,1]` dan frameDurationMs source, berhenti saat disembunyikan, `prefers-reduced-motion` menunjukkan frame pertama, contain sizing melestarikan viewBox, tombol Play/Stop accessible. Atribusi, lisensi CC0-1.0 caveat dan visual-is-illustrative notice terlihat di dekat animasi.
- Network/file missing atau invalid asset tidak merusak detail/workout dan tidak diam-diam mengarah ke URL eksternal runtime.

### UI details

- Ekstrak detail yang sudah ada di `ExerciseBrowser` ke reusable `ExerciseDetails.web.tsx`; tambahkan `ExerciseMedia.web.tsx` dan resolver manifest terpisah.
- Entry dari icon Info dan nama exercise (session/routine), Explore, serta Info pada picker. Nama picker tetap memilih/add exercise agar tidak memecahkan flow lama.
- Simpan return context: screen, exercise selection, search/filter/limit/scroll, draft routine, dan workout. Back/Escape/browser back tidak membuat sesi/set baru atau kehilangan input.
- Detail memuat nama, equipment, category/target/supporting muscles jika tersedia, konvensi kg, instruksi berurutan, media/license/provenance attribution dan ilustrasi disclaimer, capability camera vs manual, action Add ketika ada picker context.
- Supported IDs memakai panduan asli bila licensed asset tidak tersedia. Dataset-only detail menampilkan instruksi dan unavailable state tanpa tombol kamera.
- Acceptance: source inventory mencapai 1.324 records, 1.257 animations, dan 67 instruction-only; assets tepat untuk setiap ID yang beranimasi; detail dari empat entry points kembali ke konteks yang sama; 1.333 catalog entries tetap ada; search/create routine/start workout tidak memuat frame sekaligus.

## 7. Urutan eksekusi dan file

1. **Push-up RED/GREEN**: `domain/camera-view.ts` atau helper policy baru, `detection/pose-phase-adapter.ts`, `camera-framing.ts`, `camera-guides.ts`, fixtures/tests. Jalankan regresi curl/squat sebelum lanjut.
2. **Row/domain RED/GREEN**: `domain/workout.ts`, helper `domain/session-set-rows.ts`, `session-plan.ts` bila perlu; `workout-snapshot` tetap compatible. `storage/workout-store.ts` dan hook save/recovery, `sync/sync-store.ts` reconciliation. Tests input/IDs/summary/restore/merge/reload.
3. **UI controls RED/GREEN**: `ExercisePlanCards.web.tsx`, `WorkoutLog.web.tsx`, `CameraPrototype.web.tsx`, `public/gymbro-ui.css`, browser tests. Jangan memperluas file kamera monolitik untuk row management; controller/helper terpisah bila perlu.
4. **Details/Flow media RED/GREEN**: `ExerciseBrowser.web.tsx`, `ExerciseDetails.web.tsx`, `ExerciseMedia.web.tsx`, `domain/exercises.ts`, manifest resolver/import tooling, `prepare-offline.mjs`, browser tests dengan media fixture dan Flow source inventory ber-pin.
5. **Flow asset library**: pin commit, inventory serta import seluruh 1.257 custom animations (3.771 SVG frames); simpan 67 no-animation records; verifikasi mapping/size/checksum/attribution/lazy loading and provenance notice.
6. **Integration/validation**: real PostgreSQL/account sync, frontend build/browser/mobile viewport, catat RED/GREEN aktual; live push-up count dibanding label actual terpisah. Inspeksi diff/secret sebelum publikasi sesuai Git workflow yang berlaku.

Tidak memanggil API/DB untuk model inference dan tidak menyimpan frame/video/pose stream. `ref/public/log` tetap qualified; transaksi aggregate/sesi login/idempotensi tidak dipindahkan ke log.

## 8. Commands dan exit gates

Dari frontend, prefix semua npm commands dengan `volta run --node 24.21.0 --bundled-npm`:

```sh
npm test -- src/detection/pose-phase-adapter.test.ts src/detection/camera-views.test.ts src/detection/chest-curl.test.ts
npm test -- src/domain/workout.test.ts src/domain/session-plan.test.ts src/storage/workout-store.test.ts src/sync/sync-store.test.ts
npm test
npm run typecheck
npm run build:web
npm run test:camera
npm run test:vision
npm run test:e2e
npm run test:account
```

Sesuaikan targeted file list dengan tests baru yang benar-benar dibuat; jangan mengklaim command lulus jika file belum ada. Dari backend:

```sh
go test ./...
go test -race ./...
go test -tags integration ./...
```

Integration memakai PostgreSQL disposable yang sudah tersedia sesuai konfigurasi test harness, bukan DB lokal pengguna. Baca env names tanpa mencetak kredensial; jalankan integration dengan fixture yang benar. Browser test servers memerlukan akses localhost. Dokumentasikan command/exit/count failures, RED sebelum implementasi, GREEN setelahnya, dan unrun/blocked terpisah.

Exit gate otomatis: domain row identity/summary/recovery, semua regresi unit, typecheck/build, camera E2E, details/navigation/playback/lazy requests, account edit/delete/pull/conflict/retry pada PostgreSQL nyata. Uji viewport ponsel memastikan kamera tidak scroll dan halaman lain tetap scroll. Gate licensed-library hanya lulus jika seluruh file yang dipetakan tersedia dan hak sudah dipenuhi. Gate akurasi perangkat tetap membutuhkan workout berlabel; user feedback bukan pengganti evaluasi formal.

## 9. Handoff ke model lebih ringan

Execution target yang dipilih pada plan adalah **GPT-6 Luna**, medium reasoning; implementasi aktif dijalankan setelah pengguna menyetujui plan. TDD RED/GREEN sudah direkam untuk push-up dan media, lalu storage/UI.

Handoff prompt (sudah dieksekusi): `Implementasikan docs/implementation-workout-controls-media.md, ikuti task 13 gymbro-web-mvp dan AGENTS.md. Push-up RED/GREEN lalu row controls, kamera exit, detail latihan, dan importer animasi Flow. Pertahankan checkout/data pengguna; laporkan tes aktual dan bedakan uji perangkat.`

Jika test atau kode mengungkap perubahan kontrak/schema yang tidak dicakup, perbarui plan sebelum code. Jangan klaim uji akurasi perangkat tanpa workout berlabel.
