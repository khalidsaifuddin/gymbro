# Menjalankan Gymbro dan melanjutkan dengan Codex CLI

Milestone web mencakup kamera/deteksi lokal, log set/reps, koreksi/merge, summary, IndexedDB/recovery, cache offline, video opt-in/save/discard, panduan SVG, PostgreSQL, API, dan sinkronisasi akun. Login Google eksternal memerlukan credential OAuth milikmu. Live testing/akurasi dilakukan setelah MVP runnable, sesuai keputusan pengguna.

## Prasyarat

- Node.js 24 (lockfile npm), Go 1.27.1, Docker dengan Compose v2.
- Chrome/Edge desktop untuk penggunaan awal. Chrome Android masuk live testing berikutnya.
- Terminal Bash di Linux/macOS; di Windows gunakan WSL2. Startup yang dieksekusi di cloud adalah Linux x86_64; host macOS/Windows belum diuji. Image PostgreSQL 17.11 tersedia untuk amd64/arm64.
- Kamera digunakan pada browser mesin yang menjalankan aplikasi. Pemakaian pertama perlu mengunduh model/WASM; semua inference berikutnya berlangsung di browser.

## Instalasi dan startup

Dari terminal lokal:

```bash
git clone https://github.com/khalidsaifuddin/gymbro.git
cd gymbro
node --version
go version
docker compose version
npm --prefix frontend ci
npm --prefix frontend run build:web
docker compose up -d --wait db
bash scripts/start-local.sh
```

Jika repo sudah ada, gunakan `git pull --ff-only` setelah menyimpan perubahan lokal. Script startup membangun binary Go, menerapkan versioned SQL migrations secara transactional, lalu menyajikan API dan build web pada origin yang sama. Buka **localhost port 8080**. Terminal tetap berjalan; hentikan server dengan Ctrl+C. Jalankan kembali script untuk restart. Ulangi `npm --prefix frontend run build:web` setelah perubahan frontend; reload browser setelah cache service worker berganti.

Selama PR fitur belum di-merge, gunakan branch `feat/cable-pull-exercises` untuk sembilan gerakan dan pilihan sudut kamera. Dari clone baru `main`, jalankan `git fetch origin feat/cable-pull-exercises` lalu `git switch --track origin/feat/cable-pull-exercises` **sebelum build**. Jika branch lokal sudah ada, gunakan `git switch feat/cable-pull-exercises`. Branch ini dibangun di atas `feat/fixed-camera-views` (PR tahap 7); setelah seluruh PR di-merge, fitur tersedia melalui pembaruan `main` biasa. Jika memakai milestone lama di `main`, katalognya masih lima gerakan.

Database development berada di loopback port 54329, database/user `gymbro_local`. Password default `gymbro-local-development-only` hanya contoh development lokal. Compose menyimpan data dalam volume `gymbro_local-postgres`. Untuk mengganti konfigurasi, salin `.env.example` menjadi `.env`, lalu isi secara lokal. Mengganti password pada Compose tidak otomatis mengubah password di volume PostgreSQL yang sudah diinisialisasi. Jangan commit `.env` atau credential nyata.

```bash
curl --fail http://localhost:8080/health
curl --fail http://localhost:8080/api/v1/exercises
```

Health mengembalikan `{"service":"gymbro","status":"ok"}`; katalog pada branch tahap 8 berisi sembilan latihan dan atribusi SVG. `GET /api/v1/auth/capabilities` mengembalikan `google_configured: false` jika dua variabel OAuth belum diisi. Guest tetap berfungsi.

Untuk menghentikan PostgreSQL dengan data tetap tersimpan:

```bash
docker compose stop db
```

Startup ulang memakai `docker compose up -d --wait db`. Jangan menghapus volume jika ingin mempertahankan riwayat akun.

## Google OAuth lokal

Buat OAuth client **Web application** di Google Cloud Console. Gunakan origin `http://localhost:8080` dan authorized redirect URI persis:

```text
http://localhost:8080/api/v1/auth/google/callback
```

Tambahkan akun penguji jika consent screen masih Testing. Isi `GYMBRO_GOOGLE_CLIENT_ID` dan `GYMBRO_GOOGLE_CLIENT_SECRET` di `.env` lokal, mengikuti format contoh, lalu restart backend. Client ID dan secret tidak diperlukan untuk guest. Untuk konfigurasi cloud, masukkan nilainya melalui Environment Settings; jangan kirim secret di chat.

Gunakan hostname yang sama dengan `GYMBRO_PUBLIC_URL`. Membuka `127.0.0.1:8080` ketika origin dikonfigurasi `localhost:8080` menyebabkan mutasi akun ditolak oleh pemeriksaan Origin/CSRF. Host/port berbeda juga memiliki IndexedDB/cookie/cache berbeda.

Login tidak otomatis memindahkan workout tamu. Pilih **Impor workout tamu** untuk workout selesai. Gunakan **Muat riwayat akun** pada perangkat lain. Workout baru saat login tersimpan ke antrean akun; offline/retry tetap menyimpan hasil. Jika revisi bertabrakan, pilih **Gunakan hasil lokal/server**. Workout yang sudah dihapus server tidak bisa dihidupkan kembali lewat stale sync.

## Verifikasi penggunaan awal

1. Catat bench press manual 10 reps dengan total 40 kg. Summary harus menghasilkan 1 set, 10 reps, volume 400 kg. Selesaikan, reload, lalu **Lihat workout**.
2. Buka mode log untuk mengubah reps/beban, timer rest, dan merge set selesai. Raw reps kamera tetap terpisah dari koreksi.
3. Tunggu **Aplikasi dan model siap offline** sebelum memutus jaringan. Reload/recovery memulihkan catatan, dengan sesi aktif kembali dalam keadaan jeda.
4. Sebelum memulai workout, pilih **Sudut kamera**: depan, belakang, diagonal kiri/kanan depan/belakang, samping kiri/kanan, atau panduan latihan default. Kiri/kanan mengacu pada tubuh pengguna. Pilihan terkunci selama sesi, termasuk saat pause, istirahat, dan pergantian latihan; untuk posisi lain pilih **Selesaikan workout** lalu **Workout baru**. Pilih profil latihan atau otomatis, baca panduan sendi yang harus terlihat, dan pertahankan posisi fisik kamera. Profile selection bukan hasil klasifikasi otomatis. Jika posisi yang sama tidak cocok untuk latihan berikutnya, catat manual. Gate akurasi tiap sudut belum diuji pada workout nyata.
5. Rekam video default mati. Aktifkan sebelum sesi, simpan file tiap segmen setelah selesai atau buang. Pause/resume menghasilkan segmen terpisah; reload tidak memulihkan video.

Untuk kamera dari perangkat lain melalui alamat IP jaringan, diperlukan HTTPS. Deteksi browser pada localhost desktop dapat diuji terlebih dahulu; jangan menganggap pengujian kamera sintetis sebagai bukti dukungan perangkat fisik.

Pilihan sudut tersimpan lokal dan dipulihkan setelah reload bersama catatan sesi. Sesi lama tanpa field sudut, atau riwayat dari perangkat lain, memakai panduan default yang terkunci; gunakan posisi fisik semula atau pencatatan manual. Konfigurasi sudut tidak disinkronkan ke backend. Aplikasi menangani sendi hilang dan pergantian sisi tubuh, tetapi belum memiliki detektor khusus untuk setiap perpindahan kamera. Curl dan empat cable otomatis selalu memerlukan kedua lengan terlihat dan bergerak serempak. Untuk cable, lat pulldown ke depan dada dan seated cable row dilakukan duduk; rope face pull dan straight-arm cable pulldown dilakukan berdiri. Face pull memerlukan kepala terlihat; straight-arm memerlukan siku relatif lurus. Isi angka kg satu weight stack: 40 kg × 10 reps = 400 kg. Profil pilihan pengguna tetap terpisah dari hasil klasifikasi otomatis.

Pemilih kamera depan/belakang belum tersedia: adapter web saat ini meminta kamera depan melalui `facingMode: user`, mengikuti ketersediaan perangkat/browser. Pilihan **Sudut kamera** mendeskripsikan posisi terhadap tubuh, bukan memilih kamera perangkat. Dukungan memilih sensor depan/belakang atau webcam terpisah merupakan fitur lanjutan; kamera dan posisi tetap sepanjang sesi.

## Menjalankan tes

Frontend:

```bash
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build:web
cd frontend
npx playwright install chromium
npm run test:e2e
cd ..
```

Guest E2E memakai port 8081/8091. Jangan menjalankan Expo dev server pada port yang sama saat suite berjalan. Suite akun memakai 8093/8094. Server aplikasi 8080 dapat tetap berjalan.

PostgreSQL tes terpisah dari database development:

```bash
docker compose --profile test up -d --wait db-test
export GYMBRO_TEST_DATABASE_URL='postgres://gymbro_test@127.0.0.1:55432/gymbro_test?sslmode=disable'
cd backend
go test ./...
go test -tags integration -race ./...
go vet ./...
go build ./...
cd ../frontend
npm run test:account
cd ..
```

Integration tests membuat database unik `gymbro_test_*`, lalu menghapus database milik tes itu. Test fixture PostgreSQL hanya untuk loopback dan disposable. Suite akun memakai verifikasi OIDC/JWKS bertanda tangan + handler produksi + PostgreSQL nyata. Issuer itu fixture ber-build-tag `integration`; bukan login Google nyata dan tidak tersedia di binary server biasa. Gunakan nilai OAuth sah untuk menguji Google sebenarnya. Jika port 55432 terpakai, hentikan hanya server tes milikmu atau sesuaikan konfigurasi port/URL dengan konsisten.

## Melanjutkan dengan Codex CLI

Jalankan `codex` dari root repo setelah clone/pull. Authentication Codex CLI mengikuti instalasi/account lokalmu; konfigurasi cloud `/workspace/tools`, cache, dan runtime secrets tidak otomatis ikut.

Prompt awal yang dapat digunakan:

```text
Lanjutkan proyek Gymbro. Baca AGENTS.md, GLOSSARY.md, README.md,
docs/implementation-plan.md, docs/implementation-stage-5.md,
docs/implementation-stage-6.md, docs/validation-stage-5.md,
docs/localhost-guide.md, docs/implementation-stage-7.md, docs/implementation-stage-8.md,
docs/validation-stage-8.md, serta OpenSpec changes gymbro-web-mvp dan
cable-pull-exercises beserta task terbukanya.
Mulai setiap perubahan dengan implementation plan tertulis dan TDD RED/GREEN/REFACTOR.
Pertahankan deteksi/media di perangkat dan tiga schema PostgreSQL.
Jalankan aplikasi localhost dan tes yang relevan sebelum mengubah status task.
Live testing/akurasi setelah MVP runnable; jangan klaim fixture sebagai data perangkat nyata.
Jangan mengubah konfigurasi/push/deploy hanya untuk menyamai lingkungan cloud.
```

Skill OpenSpec versioned berada di `.agents/skills`. CLI OpenSpec dapat dipasang dengan `npm install --global @fission-ai/openspec@1.14.1`, lalu `openspec instructions apply --change gymbro-web-mvp --json` dan `openspec validate gymbro-web-mvp --strict`. Skill interview tambahan di cloud (`grill-with-docs`, `grilling`, `domain-modeling`) berada di `/workspace/skills`, sehingga perlu diinstal terpisah jika dibutuhkan lokal; sumbernya https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs. Hasil keputusan, ADR dan glossary sudah tersimpan di repo.

Milestone MVP boleh dipush langsung `main` sesuai izin pengguna. Setelah MVP selesai, improvement/fitur baru memakai branch dan pull request. Baca `docs/deployment-plan.md` saat pengguna meminta VPS/GitHub Actions deployment. Riwayat chat cloud tidak otomatis tersedia di Codex CLI; gunakan dokumen/task dan minta konteks yang benar-benar belum tercatat.
