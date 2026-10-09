# Tasks

Checkbox mencatat pekerjaan yang telah selesai atau masih terbuka. Ikuti `AGENTS.md` dan `docs/implementation-plan.md`; setiap tahap dimulai dari plan tertulis sebelum kode.

## 1. Fondasi dan domain workout

- [x] 1.1 Tulis plan tahap domain dengan file, dependency pins, acceptance scenarios, dan command tes; verifikasi setiap aturan tracking dipetakan ke skenario.
- [x] 1.2 Scaffold backend berlapis serta frontend Expo/TypeScript dan test runners; verifikasi frozen install, type check, dan Go module resolution tanpa mengklaim empty-test run sebagai validasi perilaku.
- [x] 1.3 RED: tulis tes complete/partial/interrupted reps serta bilateral curl; verifikasi kegagalan berasal dari perilaku yang belum tersedia.
- [x] 1.4 GREEN: implementasikan state machine reps agar tes 1.3 lulus; REFACTOR boundary domain/adapter dan rerun suite yang sama.
- [x] 1.5 RED: tes tracking loss, boundary 15 detik, change confirmation, manual end, merge/correction, pause, dan rest; verifikasi setiap tes gagal sesuai skenario.
- [x] 1.6 GREEN/REFACTOR: implementasikan aturan waktu dan koreksi memakai clock injeksi; verifikasi tes 1.5 lulus tanpa sleep nyata.
- [x] 1.7 RED → GREEN → REFACTOR: normalisasi kg, implement count, beban NULL/bodyweight, dan summary setelah edit; verifikasi contoh dua dumbbell 10 kg × 10 reps menghasilkan 200 kg.
- [x] 1.8 Dokumentasikan API domain serta command tes aktual; verifikasi contoh replay menghasilkan set/reps yang diharapkan.

## 2. Prototipe pengenalan kamera

- [x] 2.1 Tulis plan prototipe untuk lima gerakan, verifikasi sumber/lisensi/checksum model, serta pin versi; deliver manifest model dan protokol evaluasi yang memisahkan tuning/evaluation.
- [x] 2.2 RED: tes adapter keypoint/replay untuk smoothing, debounce, confidence rendah, landmark hilang, partial cycles, dan non-workout negatives; verifikasi failure sebelum implementasi.
- [x] 2.3 GREEN/REFACTOR: implementasikan adapter browser/worker dan temporal classifier; verifikasi replay tests lulus dan tidak ada upload media/pose melalui network assertions.
- [x] 2.4 RED → GREEN → REFACTOR: unknown/manual fallback, panduan posisi, tracking-loss guard, serta pergantian latihan; verifikasi scenario tests pada kelima gerakan.
- [ ] 2.5 Susun contoh real-workout berlabel dan berizin minimal 20 set per gerakan dari ≥5 orang; verifikasi label, partisipan, kondisi kamera, dan split tuning/evaluation dalam manifest tanpa memakai data sintetis sebagai pengganti.
- [ ] 2.6 Jalankan evaluasi label/reps otomatis per gerakan; deliver laporan kedua metrik, unknown failures, dan gate ≥90%/≥90%, serta diagnosis jika gate gagal.
- [ ] 2.7 Dokumentasikan batas kamera/model dan hasil prototipe sebenarnya; verifikasi klaim dukungan cocok dengan laporan, bukan hasil yang dikoreksi pengguna.

## 3. UI, persistence lokal, dan rekaman

- [x] 3.1 Tulis plan UI/outbox/recording dengan skenario tiap adapter; verifikasi komponen kamera dan log berbagi satu session aggregate.
- [x] 3.2 RED: interaction tests penghitung besar, kartu/tabel set, prior result, input beban, timer, koreksi, serta summary; verifikasi failures sesuai kebutuhan.
- [x] 3.3 GREEN/REFACTOR: implementasikan mode kamera dan log ala referensi Hevy; verifikasi tests 3.2 lulus dengan label beban jelas dan summary konsisten.
- [x] 3.4 RED → GREEN → REFACTOR: IndexedDB incremental save, reload recovery, permission denial, pause/background, cache/model readiness, dan network interruption; verifikasi data tidak hilang setelah reload dan offline continuation.
- [x] 3.5 RED → GREEN → REFACTOR: recorder default off, opt-in sebelum sesi, pause, unsupported MIME, save/discard lokal; verifikasi workout tetap tersimpan saat video dibuang dan tidak ada video upload.
- [x] 3.6 Buat lima SVG original beserta source, metadata atribusi, dan CC-BY-4.0 asset license; verifikasi tiap gerakan memiliki animasi yang cocok, lisensi dapat ditemukan, dan rendering bekerja di target web.
- [ ] 3.7 Dokumentasikan dan jalankan smoke test guest workout serta recording pada perangkat nyata; deliver hasil browser/perangkat, permission flow, dan keterbatasan video reload yang benar.

## 4. Database tiga schema dan activity logs

- [x] 4.1 Tulis plan migration/repository dengan daftar tabel qualified dan partition lifecycle; verifikasi mapping sesuai `docs/database-design.md` dan siapkan PostgreSQL disposable.
- [x] 4.2 RED: integration tests fresh install, constraints/FKs, owner scoping, aggregate transaction, dan NUMERIC load; verifikasi failures sebelum migration/repository.
- [x] 4.3 GREEN/REFACTOR: versioned migrations `ref`/`public` serta repository GORM qualified; verifikasi suite 4.2 lulus dan domain/use case tidak mengimpor adapter.
- [x] 4.4 RED: integration tests log insertion, UTC month boundary, delayed offline event, absent-partition fallback, dan expiry isolation; verifikasi failure pada skenario partition.
- [x] 4.5 GREEN/REFACTOR: migration log parents/monthly partitions/fallback dan maintenance command; verifikasi 4.4 lulus, fallback overlap dapat dipindahkan, serta drop partisi tidak menghapus state public/ref.
- [x] 4.6 Dokumentasikan fresh migration, seed repeatability, maintenance, dan rollback pada DB disposable; verifikasi command yang ditulis berhasil tanpa merusak data pengguna.

## 5. API, Google login, riwayat dan sinkronisasi

- [x] 5.1 Tulis plan API/auth/outbox dengan kontrak request/response dan aturan revisi; verifikasi ownership selalu berasal dari sesi server.
- [x] 5.2 RED → GREEN → REFACTOR: katalog dan owner-scoped history/mutation handlers serta use cases; verifikasi validasi nested IDs dan rejection akses akun lain.
- [x] 5.3 RED → GREEN → REFACTOR: verified Google identity, state/nonce/PKCE, session hashing/expiry/logout dan CSRF; verifikasi penolakan identitas/sesi tidak sah serta tidak ada token plaintext di DB/log.
- [ ] 5.4 Periksa binding/config names yang tersedia sebelum menambahkan kebutuhan OAuth; setelah nilai sah tersedia, jalankan login Google end-to-end dan dokumentasikan callback/config tanpa secret. Catat blocker bila belum tersedia.
- [x] 5.5 RED: PostgreSQL concurrency tests retry outcome identik, reuse mutation ID beda payload, revision conflict, dan transaksi atomic; verifikasi failures sebelum sync handler.
- [x] 5.6 GREEN/REFACTOR: idempotent mutation protocol dan outbox client dengan explicit conflict choice; verifikasi 5.5 lulus, retry respons hilang tidak duplikat, dan dua perangkat tidak overwrite diam-diam.
- [x] 5.7 RED → GREEN → REFACTOR: opt-in guest import, workout/account deletion, log identifier cleanup, session invalidation, dan stale-sync tombstone; verifikasi data terhapus tidak muncul kembali.
- [x] 5.8 Dokumentasikan kontrak API, errors/revisions, dan auth lifecycle; verifikasi contoh request sesuai integration tests serta history sesudah koreksi cocok dengan summary.

## 6. Validasi integrasi dan perangkat

- [x] 6.1 Tulis plan end-to-end serta matriks Chrome/Edge desktop dan Chrome Android; verifikasi setiap capability memiliki alur penerimaan dan jenis bukti yang sesuai.
- [x] 6.2 RED → GREEN → REFACTOR: E2E lintas domain/UI/API untuk guest-to-account import, offline/reconnect, konflik dua client, serta delete/stale sync; verifikasi browser assertions dan persistence database sebenarnya.
- [x] 6.3 Jalankan build/type check frontend serta tes Go, PostgreSQL integration, dan race detector jika didukung; deliver exit status, jumlah tes, serta failed/skipped/unrun yang terpisah.
- [ ] 6.4 Jalankan kamera/recording/pause/offline pada perangkat nyata dan evaluasi ulang lima gerakan setelah perubahan inference; deliver performa terukur dan bukti gate akurasi tanpa koreksi manual.
- [x] 6.5 Perbarui setup/start instructions berdasarkan command yang telah dijalankan; verifikasi cold start/readiness requests, list konfigurasi yang belum tersedia, dan jangan klaim deployment/native/Safari selesai.

## 7. Sudut kamera tetap per sesi

- [x] 7.1 Catat plan pilihan arah, batas posisi tetap, kompatibilitas data lokal, dan skenario TDD sebelum kode.
- [x] 7.2 RED → GREEN → REFACTOR: pilihan arah terkunci selama sesi termasuk pause/rest/pergantian latihan; recovery mempertahankan arah, data lama tetap terbaca, dan sesi baru membuka pilihan.
- [x] 7.3 RED → GREEN → REFACTOR: gunakan sisi tubuh yang terlihat untuk profil samping/diagonal; curl tetap bilateral, pergantian sisi membuang siklus parsial, dan unknown/tracking loss mempertahankan reps tanpa menutup set.
- [x] 7.4 Jalankan unit/type/build/browser termasuk regresi sync; dokumentasikan bukti sintetis dan pisahkan dari akurasi perangkat nyata yang belum diuji.
- [ ] 7.5 Evaluasi berizin tiap kombinasi arah/latihan yang hendak diklaim; dokumentasikan unknown, error reps, dan arah yang gagal atau belum diuji saat live testing.

## 8. Overlay sendi dan framing kamera

- [x] 8.1 Catat plan, batas overlay versus akurasi, serta skenario profil bilateral/satu sisi sebelum kode.
- [x] 8.2 RED: tes sendi/sambungan valid, framing per profil, koordinat preview, dan pembersihan saat pause.
- [x] 8.3 GREEN/REFACTOR: tampilkan skeleton, bingkai, dan pesan framing lokal tanpa mengubah recognizer atau mengirim pose.
- [x] 8.4 Jalankan unit/type/build/browser dan pisahkan bukti sintetis dari uji kamera nyata.

## 9. Alur workout, routine, explore, dan kamera satu layar

- [x] 9.1 Catat plan, keputusan browser-local, mapping layar referensi, dan acceptance scenarios sebelum kode.
- [x] 9.2 RED → GREEN → REFACTOR: routine CRUD lokal dan salinan target sesi yang bertahan setelah reload/recovery tanpa mengubah routine sumber.
- [x] 9.3 RED → GREEN → REFACTOR: beranda, sesi kosong, routine editor/start, explore/picker, dan kartu latihan/set yang berbagi aggregate workout.
- [x] 9.4 RED → GREEN → REFACTOR: kamera dari tiap kartu memakai viewport penuh dengan skeleton, hitungan, status, dan kontrol tanpa scroll serta mempertahankan data saat kembali.
- [x] 9.5 Validasi unit/type/build/browser, regresi account/recording/offline, dan dokumentasikan batas bukti perangkat/akurasi.

## 10. Revisi hasil uji langsung dan katalog latihan

- [x] 10.1 Perbarui plan, spesifikasi, sumber/lisensi dataset, dan skenario penerimaan sebelum kode.
- [x] 10.2 RED → GREEN → REFACTOR: tingkatkan respons squat/curl untuk siklus lengkap beramplitudo sedang tanpa menambah false reps pada jitter, parsial, satu tangan, dan tracking loss.
- [x] 10.3 RED → GREEN → REFACTOR: impor 1.324 metadata/instruksi MIT, katalog/Explore/routine/manual, sinkronisasi latihan manual dengan seed PostgreSQL, dan sembunyikan kamera pada latihan tanpa deteksi.
- [x] 10.4 RED → GREEN → REFACTOR: sudut kamera per latihan dengan recovery/kompatibilitas legacy, scrolling halaman normal, dan tema SAKA cyan.
- [x] 10.5 Jalankan unit, typecheck, build, browser, PostgreSQL/account sync; catat batas validasi otomatis versus akurasi perangkat nyata.

## 11. Repetisi yang terlewat setelah live testing

- [x] 11.1 Catat plan sensitivitas prioritas pengguna dan skenario penerimaan sebelum kode.
- [x] 11.2 RED: replay siklus kontinu singkat, curl sedikit berbeda fase, confidence moderat, serta regresi negatif.
- [x] 11.3 GREEN/REFACTOR: parameter squat/curl responsif, bilateral tanpa reset akibat lintas ambang kecil, dan sampling kamera lebih sering.
- [x] 11.4 Jalankan unit/type/build, catat bukti aktual serta batas evaluasi perangkat nyata.

## 12. Curl mendekati dada

- [x] 12.1 Catat hipotesis, plan, spesifikasi, dan skenario curl dekat dada sebelum kode.
- [x] 12.2 RED: replay curl kedalaman, wrist confidence dekat dada, dan transport worldLandmarks; regresi negatif untuk kehilangan tracking/satu tangan.
- [x] 12.3 GREEN/REFACTOR: sudut 3D curl, fallback legacy 2D, guard pergantian sumber, dan toleransi visibility wrist lokal.
- [x] 12.4 Jalankan unit/type/build/camera/vision dan dokumentasikan batas validasi tubuh nyata.

## 13. Push-up, kontrol set, dan detail/media latihan

- [x] 13.1 Tulis implementation plan grounded pada kode, default uncheck, gate lisensi, acceptance, file, urutan TDD, commands, dan handoff model ringan.
- [x] 13.2 RED: default push-up side view dengan sisi jauh occluded, realistic floor-wrist replay, endpoint singkat, serta negatives/regresi curl dan squat.
- [x] 13.3 GREEN/REFACTOR: policy sisi push-up default yang cocok dengan guide, parameter responsif, serta status kamera; validasi bahwa interrupted/partial/non-workout tidak dihitung.
- [x] 13.4 RED: row identity A/B/C, edit final/raw provenance, uncheck/recheck, delete terakhir/tengah, restore/merge, input invalid, dan legacy reload.
- [x] 13.5 GREEN/REFACTOR: domain remove/restore completed set, sessionRows browser-local, atomic record save dan rekonsiliasi sync tanpa menggandakan atau membangkitkan hasil.
- [x] 13.6 RED → GREEN: completed kg/reps editor, delete/confirmation, completion checkbox yang reversible, LIVE state aktif, dan kamera `Akhiri set & kembali` tanpa frame terlambat/scroll.
- [x] 13.7 RED → GREEN: reusable exercise detail dari Explore/picker/routine/workout dengan back context, instructions, player/fallback animasi SVG Flow dan kamera hanya untuk profil didukung.
- [x] 13.8 RED → GREEN: pin source Flow dan implement manifest/importer deterministic untuk 1.257 animasi custom/3.771 frame; validasi ID/checksum/MIME/dimensions/attribution/provenance; exclude library dari offline precache dan gunakan lazy loading. 67 exercise tanpa animasi tidak boleh memakai ilustrasi pengganti.
- [x] 13.9 Verifikasi inventory serta dokumentasikan provenance caveat: hanya 13 prompt asli tersimpan dari 1.257 animasi; attribution CC0-1.0 sejauh hak dimiliki tetap dekat player. Jangan klaim artwork profesional/divalidasi gerakan.
- [x] 13.10 RED → GREEN: real PostgreSQL/account aggregate edit/delete/uncheck/retry/pull/conflict, dengan pending draft browser-local dan tanpa resurrection.
- [x] 13.11 Jalankan unit/type/build/browser/account/Go, catat RED/GREEN aktual dan blocked/unrun; live test push-up sebelum koreksi terpisah dari gate akurasi formal.
- [x] 13.12 Review diff/secret dan hasil validasi; catat live camera, OAuth, dan GitHub publication yang belum diverifikasi/diaktifkan.
- [ ] 13.13 Publikasikan perubahan di branch fitur dan PR sesuai workflow repo, lalu archive change setelah review.

## 14. Layout workout pada ponsel

- [x] 14.1 Catat plan, screenshot symptom, komponen, dan acceptance untuk viewport 320–430 px sebelum kode.
- [ ] 14.2 RED: browser regression sesi aktif memastikan document scroll width tidak melebihi viewport pada beberapa lebar ponsel; cek bounds statistik/kartu serta scroll tabel set yang tetap internal. Test dibuat, tetapi belum dapat dieksekusi karena Chrome abort saat startup.
- [x] 14.3 GREEN/REFACTOR: batasi sizing shell/kartu, izinkan wrap pada header/summary, serta pertahankan scroll tabel set di dalam tabel.
- [ ] 14.4 Jalankan browser regression, unit, typecheck, dan web export; catat RED/GREEN serta hasil aktual. Unit (294), typecheck, dan web export lulus; browser regression terhambat oleh Chrome startup.

## 15. Hapus fallback entry dari sesi workout

- [x] 15.1 Tulis plan, screenshot, cakupan, serta acceptance sebelum implementasi.
- [ ] 15.2 RED: browser test ditulis, tetapi Playwright berhenti sebelum membuka halaman karena Chrome gagal pada `bootstrap_check_in`/MachPort rendezvous.
- [x] 15.3 GREEN/REFACTOR: hapus panel beserta state dan copy yang hanya mendukung fallback, pertahankan target set/manual correction yang sudah ada.
- [ ] 15.4 Jalankan browser regression, unit, typecheck, dan web export; unit 294/294, typecheck, dan export lulus; browser regression terblokir saat startup.

## 16. Animasi detail latihan otomatis

- [x] 16.1 Tulis plan, posisi player, perilaku reduced-motion, dan acceptance sebelum implementasi.
- [ ] 16.2 RED: assertion urutan/autoplay ditulis; eksekusi RED tidak tersedia karena Chromium berhenti saat startup.
- [x] 16.3 GREEN/REFACTOR: pindahkan media di atas kartu detail, mulai playback saat mount, dan tetap mengikuti reduced-motion.
- [ ] 16.4 Jalankan browser regression, unit, typecheck, dan web export; unit 294/294, typecheck, dan export lulus; browser regression terblokir.

## 17. Kamera sebagai tampilan penuh

- [x] 17.1 Tulis plan, screenshot, cakupan viewport, auto-start, overlay, menu ikon, dan acceptance sebelum implementasi.
- [ ] 17.2 RED: browser assertions auto-start, viewport bounds, merged status/framing overlay, collapsed sidebar dan accessible icon controls ditulis; test berhenti sebelum halaman dibuka karena `bootstrap_check_in`/MachPort rendezvous abort.
- [x] 17.3 GREEN/REFACTOR: jadikan video panggung layar penuh, gabungkan status dan cue framing di atas video, sediakan kontrol aksi berikon dalam sidebar kanan yang dapat dilipat, dan mulai kamera saat view masuk dengan guard double-start.
- [ ] 17.4 Unit 294/294, typecheck, dan web export lulus; browser regression terblokir saat startup. Ulangi di runtime yang dapat menjalankan Chrome.

## Workflow follow-up

- Tinjau hasil implementasi dan bukti validasi sebelum archive change serta merge spesifikasi delta menjadi spesifikasi utama.
- Tentukan hosting HTTPS, callback OAuth, dan retention produksi sebelum deployment. Native iOS/Android dan Safari mengikuti tahap tersendiri.
