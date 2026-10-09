# Spec Delta

## Purpose

Mengenali gerakan workout dari kamera perangkat tanpa mengunggah video, dengan batas dukungan dan evaluasi akurasi yang eksplisit.

## ADDED Requirements

### Requirement: On-device supported recognition

Aplikasi SHALL memproses kamera di perangkat untuk squat, push-up, curl dumbbell bilateral, seated machine shoulder press, dan flat barbell bench press. Penggunaan awal mendukung satu orang, kamera diam, dan bagian tubuh relevan terlihat.

#### Scenario: Supported exercise
- **WHEN** satu orang melakukan salah satu gerakan yang didukung dengan pandangan kamera valid
- **THEN** aplikasi mencoba mengenali jenis latihan otomatis tanpa mengirim video, frame, atau stream pose ke server

### Requirement: Unknown and unsupported recognition

Aplikasi SHALL menampilkan gerakan belum dikenali ketika sinyal tidak meyakinkan dan menyediakan pemilihan manual, tanpa memaksakan label gerakan.

#### Scenario: Ambiguous movement
- **WHEN** bukti pose/gerakan tidak cukup membedakan latihan
- **THEN** pengguna melihat status belum dikenali dan dapat memilih latihan manual

### Requirement: Camera positioning and tracking loss

Aplikasi SHALL memberi panduan kamera sesuai latihan dan peringatan saat tubuh terhalang/keluar gambar. Gangguan menghentikan hitungan serta penutupan set otomatis, mempertahankan rep terverifikasi, dan membuang siklus terputus.

#### Scenario: Visible joint and framing overlay
- **WHEN** preview kamera menerima landmark pose lokal
- **THEN** aplikasi menggambar sendi dan sambungan yang valid di atas video, memberi panduan bagian tubuh yang harus masuk bingkai sesuai profil, dan tidak menyebut framing baik sebagai bukti gerakan dikenali
- **AND** sendi yang hilang tidak digambar sebagai sambungan semu, serta overlay dibersihkan saat kamera dijeda atau berhenti

#### Scenario: Camera occlusion exceeds boundary
- **WHEN** tubuh hilang dari pandangan selama lebih dari 15 detik saat set aktif
- **THEN** aplikasi memperingatkan pengguna dan tidak menutup set hanya karena gangguan tersebut

#### Scenario: Tracking returns
- **WHEN** pandangan valid kembali setelah siklus terputus
- **THEN** hitungan berlanjut dari hasil terverifikasi tanpa menghitung gerakan yang tidak terlihat

### Requirement: Fixed camera position throughout the workout session

Aplikasi SHALL memberi instruksi agar posisi fisik kamera tetap selama seluruh sesi. Perubahan posisi dilakukan pada sesi baru. Dukungan otomatis suatu sudut SHALL hanya diklaim setelah kombinasi sudut/latihan tersebut dievaluasi; pose estimation saja bukan bukti dukungan.

#### Scenario: Recover the fixed camera view
- **WHEN** catatan sesi aktif dipulihkan setelah reload
- **THEN** arah kamera lokal yang tersimpan tetap terkunci dan kamera diaktifkan kembali dari posisi semula

#### Scenario: Exercise changes at the same camera position
- **WHEN** pengguna mengganti latihan dalam sesi yang belum selesai
- **THEN** posisi kamera tetap sama dan pencatatan manual tersedia jika pandangan tidak cukup untuk deteksi otomatis latihan berikutnya

#### Scenario: Position adjustment needs another session
- **WHEN** pengguna memerlukan posisi kamera berbeda
- **THEN** pengguna menyelesaikan sesi saat ini sebelum memulai sesi baru dengan posisi tersebut

#### Scenario: Detected view interruption
- **WHEN** gangguan pandangan terdeteksi ketika set berlangsung
- **THEN** aplikasi membuang siklus parsial, mempertahankan reps terverifikasi, menghentikan hitungan dan penutupan set otomatis, serta meminta pemulihan pandangan dari posisi semula

### Requirement: Local camera view selection and recovery

Aplikasi SHALL menyediakan pilihan arah sebelum sesi dan menguncinya sampai sesi selesai, termasuk saat pause, istirahat dan pergantian latihan. Recovery lokal SHALL mempertahankan pilihan; catatan lama tanpa arah memakai panduan default yang terkunci.

#### Scenario: Select a direction before the workout
- **WHEN** sesi belum dimulai
- **THEN** pengguna dapat memilih depan, belakang, diagonal kiri/kanan depan/belakang, samping kiri/kanan, atau panduan latihan default

#### Scenario: Change direction while paused
- **WHEN** sesi telah dimulai dan sedang dijeda
- **THEN** pilihan arah tetap terkunci sampai pengguna menyelesaikan sesi dan memulai workout baru

### Requirement: Consistent visible-side tracking

Profil samping/diagonal SHALL menggunakan sisi tubuh dengan sendi relevan terlihat secara konsisten untuk squat, push-up dan press. Perubahan sisi yang dipantau SHALL membuang siklus parsial. Curl otomatis SHALL tetap memerlukan kedua lengan terlihat dan bergerak serempak. Pilihan arah SHALL tidak dijadikan bukti label latihan otomatis atau mengatasi landmark/geometry invalid.

#### Scenario: The tracked limb becomes occluded
- **WHEN** sisi tubuh yang dipantau hilang dan sisi lain menjadi terlihat di tengah siklus
- **THEN** observasi pergantian sisi menghentikan siklus dan rep berikutnya memerlukan siklus lengkap dari sisi yang baru

#### Scenario: A single arm is visible during curl
- **WHEN** hanya satu lengan terlihat pada profil samping atau diagonal
- **THEN** aplikasi menghentikan hitungan curl otomatis dan menyediakan pencatatan manual

### Requirement: Exercise transitions

Aplikasi SHALL mengizinkan penggantian latihan otomatis di antara set dan meminta konfirmasi ketika gerakan berbeda terdeteksi pada set aktif.

#### Scenario: Change mid-set
- **WHEN** jenis gerakan berbeda terdeteksi pada set yang belum selesai
- **THEN** aplikasi meminta konfirmasi sebelum mengubah jenis latihan atau memasukkan repetisi ke jenis baru

#### Scenario: Change between sets
- **WHEN** set selesai dan gerakan lain dikenali dengan yakin
- **THEN** aplikasi dapat memulai pencatatan jenis latihan baru otomatis

### Requirement: Browser support and camera errors

Aplikasi SHALL mendukung Chrome/Edge desktop dan Chrome Android pada MVP, serta menampilkan kegagalan izin/kamera/model yang dapat ditindaklanjuti. Safari tidak diklaim didukung sebelum validasi khusus.

#### Scenario: Camera denied
- **WHEN** izin kamera ditolak
- **THEN** aplikasi menjelaskan cara mengaktifkan izin dan tetap menawarkan pencatatan manual

### Requirement: Recognition acceptance evidence

Rilis kemampuan otomatis SHALL memiliki evaluasi terpisah per gerakan: ≥90% label set benar dan ≥90% set berselisih maksimal satu rep, pada minimal 20 set dari sedikitnya 5 orang dalam kondisi didukung. Unknown dihitung sebagai kegagalan label; hasil koreksi pengguna tidak meningkatkan skor otomatis.

#### Scenario: Accuracy report
- **WHEN** evaluasi kelima gerakan dijalankan pada data berlabel yang terpisah dari tuning
- **THEN** laporan menyebut jumlah set/orang, label unknown, akurasi label dan selisih reps per gerakan, serta gate yang lulus atau gagal
