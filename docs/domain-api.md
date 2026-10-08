# Domain workout tahap 1

`frontend/src/domain/workout.ts` adalah domain TypeScript tanpa DOM atau dependency model. Adapter kamera tahap berikutnya menerjemahkan hasil pose ke observation; modul ini belum mendeteksi manusia atau gerakan dari video.

## API

- `new WorkoutSession({ clock, idFactory })`: injeksi waktu milliseconds serta generator UUID/ID. Gunakan clock monotonic untuk replay/tes dan generator unik untuk setiap set.
- `observe({ exercise, phase, visible, bilateral })`: input fase `ready`, `peak`, atau `moving`. Satu siklus ready → peak → ready menambah satu rep. Unknown/invisible/unilateral curl tidak dihitung. Mid-set class change menunggu konfirmasi.
- `tick()`: evaluasi batas set pada timer UI; waktu invalid tracking atau pause tidak menutup set. `endSet()` menutup manual pada waktu rep terverifikasi terakhir.
- `getSets()` menghasilkan deep copy. `getPendingExercise()` dan `confirmExerciseChange()` mendukung pergantian yang diminta; set berikutnya dimulai dari anchor baru.
- `correctSet(id, reps)` hanya untuk set selesai; raw `detectedReps` dipertahankan. `mergeSets(ids)` mempertahankan lineage/source snapshots dan total raw/final reps.
- `setLoad(id, kg, implementCount?)`: kg nonnegative finite, dibulatkan tiga desimal dan dibatasi ke rentang NUMERIC(8,3). Nilai NULL tetap absent. Dumbbell default dua alat, barbell/mesin satu.
- `pause()`, `resume()`, `finish()`: siklus terputus dibuang. Finish membekukan waktu; hasil final masih dapat dikoreksi tanpa menjalankan kamera kembali.
- `summary()`: total set/reps, known external volume, completeness, durasi aktif, pause, dan istirahat. Durasi/rest mengecualikan pause eksplisit. Bodyweight tanpa external load dikecualikan dari volume.

Jika dua set dengan beban berbeda digabung, sumber beban dipertahankan untuk menghitung volume awal. Setelah reps gabungan dikoreksi, distribusi beban per rep tidak dapat ditebak; volume ditandai incomplete sampai pengguna memasukkan beban gabungan yang sesuai. Persistence/API tahap berikutnya harus mempertahankan provenance merge ini.

## Replay yang telah dijalankan

Dari `frontend`:

```bash
node --input-type=module - <<'JS'
import { WorkoutSession } from './src/domain/workout.ts';
let now = 0, next = 0;
const workout = new WorkoutSession({ clock: () => now, idFactory: () => `set-${++next}` });
for (const [time, phase] of [[0,'ready'],[1000,'peak'],[2000,'ready'],[3000,'peak'],[4000,'ready']]) {
  now = time;
  workout.observe({exercise: 'dumbbell-curl', phase, visible: true, bilateral: true});
}
workout.setLoad(workout.getSets()[0].id, 10);
now = 6000;
console.log(workout.finish());
JS
```

Hasil: satu set, dua reps, volume eksternal 40 kg, durasi aktif 6000 ms. Ini functional check domain, bukan validasi deteksi kamera.

## Command developer

- Frontend: `npm ci`, `npm test`, `npm run typecheck`, `CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run build:web`.
- Backend: gunakan compiler Go 1.27.1; `go mod download`, `go test ./...`, `go test -race ./...`, `go build -o bin/gymbro .`, `go run .`.
- Endpoint backend tahap 1: `GET /health` mengembalikan status/server dasar. Belum menguji koneksi database atau login.

Pada cloud, export PATH compiler Go resmi serta arahkan GOCACHE/GOMODCACHE/GOPATH ke `/workspace/.cache`. `EXPO_NO_TELEMETRY=1` menghindari penulisan telemetry ke home yang read-only; offline build memakai dependencies yang sudah terpasang.
