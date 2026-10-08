# Implementation plan tahap 6: integrasi runnable localhost

Sebelum menambahkan UI akun/E2E, hubungkan aggregate lokal, durable outbox dan API pada satu origin. Server Go menyajikan build React Native Web; PostgreSQL memakai migrations 001–003. Kamera tetap di browser.

RED → GREEN → REFACTOR: Playwright dua browser contexts memakai handler produksi + Google adapter produksi dengan issuer/JWKS fixture bertanda tangan dan PostgreSQL disposable. Fixture hanya ada dalam build-tag `integration`; bukan login Google sebenarnya. Cakup login browser binding/PKCE, import guest opt-in, riwayat perangkat kedua, offline-save/reconnect, dua client melakukan koreksi pada revision sama dan memilih conflict, workout deletion/stale sync, account deletion/cookie invalidation. Periksa requests hanya JSON, tanpa pose/media. Tambahkan tes store untuk transisi yang sulit dipicu browser (lost response, in-flight edits, account switching).

Verifikasi frontend unit/type/build serta dua suite Playwright (guest dan API); backend semua tests/race/build/vet/module verification dan migration upgrade. Jalankan localhost startup nyata, request health/catalogue, dan buka halaman hasil build. Dokumentasikan perintah yang benar-benar diuji. Tes build tanpa tag memastikan fixture tidak tersedia pada server aplikasi.

Matriks: Chromium otomatis desktop = E2E; Chrome/Edge desktop dan Chrome Android perangkat nyata = live testing sesudah MVP runnable, sesuai keputusan pengguna. Safari/iOS/Android native belum tahap ini. Akurasi ≥90% masih menunggu corpus berizin dan live testing. Google OAuth end-to-end eksternal memerlukan konfigurasi client ID/secret; fixture kriptografis tidak menghapus gate itu. Deployment VPS/GitHub Actions menunggu tahap deployment.
