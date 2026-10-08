# Kontrak API web MVP

Semua endpoint pada origin web yang sama. Response API `Cache-Control: no-store`; service worker hanya cache aset yang dipaketkan. Tidak ada endpoint upload media/pose. JSON maksimal 1 MiB, Content-Type `application/json`, unknown fields dan trailing JSON ditolak. UUID canonical nonzero, counts/load/time/pauses divalidasi. Go core/use cases memakai ports, tanpa Gin/GORM.

## Endpoint

| Method/path | Perilaku |
| --- | --- |
| `GET /health` | Health server |
| `GET /api/v1/exercises` | Lima master exercise + atribusi/checksum assets |
| `GET /api/v1/auth/capabilities` | `google_configured` |
| `GET /api/v1/auth/google/start` | Redirect authorization, cookie browser binding 5 menit |
| `GET /api/v1/auth/google/callback` | One-time state/binding + code/nonce/PKCE/OIDC verification; issue cookie atau redirect `/?login=failed` |
| `GET /api/v1/auth/me` | `{user:{id,name},csrf}` setelah cookie session/CSRF valid |
| `POST /api/v1/auth/logout` | Invalidate session, clear cookies, 204 |
| `GET /api/v1/workouts` | Full owner-scoped list, tanpa tombstone; snapshot consistent |
| `GET /api/v1/workouts/:id` | `{workout,summary}` hanya owner |
| `POST /api/v1/workout-mutations` | Upsert/delete aggregate transactional/idempotent |
| `DELETE /api/v1/account` | Delete owned server data/outcomes/sessions + identifying logs, 204 |

Mutation/logout/delete membutuhkan cookie `gymbro_session`, header Origin persis `GYMBRO_PUBLIC_URL`, dan `X-CSRF-Token` dari auth/me. Cookie session/CSRF/OAuth binding HttpOnly, SameSite=Lax, Secure pada HTTPS; HTTP hanya diperbolehkan loopback development. Token acak 256-bit, hanya SHA-256 session/CSRF di database. Google access/ID tokens tidak dipersist/log. Validasi Google signature/issuer/audience/expiry/nonce dilakukan oleh adapter go-oidc; pending OAuth flows TTL di memori, restart membatalkan flow pending, sesi database tetap hidup.

## Mutasi

Contoh envelope (UUID/aggregate mengikuti data milik sesi yang sama):

```json
{
  "account_id": "00000000-0000-4000-8000-000000000011",
  "mutation_id": "00000000-0000-4000-8000-000000000022",
  "workout_id": "00000000-0000-4000-8000-000000000033",
  "base_revision": 0,
  "operation": "upsert",
  "occurred_at": "2026-10-08T12:00:00.000Z",
  "workout": {
    "id": "00000000-0000-4000-8000-000000000033",
    "revision": 0,
    "started_at": "2026-10-08T11:59:00.000Z",
    "captured_at": "2026-10-08T12:00:00.000Z",
    "finished_at": "2026-10-08T12:00:00.000Z",
    "pause_intervals": [],
    "duration_ms": 60000,
    "paused_duration_ms": 0,
    "rest_duration_ms": 0,
    "status": "completed",
    "exercises": []
  }
}
```

`account_id` hanya binding client yang harus cocok dengan sesi server; ownership berasal dari sesi. `base_revision=0` untuk UUID baru, >0 untuk update/delete. Delete tidak membawa workout. `occurred_at` tidak boleh >5 menit ke depan. Final revision berasal dari server, bukan `workout.revision` input. Example empty workout adalah aggregate valid; contoh set lengkap diuji pada `handler/api/router_integration_test.go`.

Sets membawa final/raw reps, origin automatic/manual/mixed, label_source automatic/profile/manual/mixed/unknown, raw/detected exercise, kg decimal **string** atau NULL, implement count, source IDs/merged provenance, load-edited flag, timestamps. Profil pilihan pengguna bukan label klasifikasi; source unknown dari legacy tidak ditingkatkan menjadi automatic. Set `position` adalah urutan global sesi; exercise position adalah urutan occurrence. Capture/pause yang asli dan timestamp provenance dipertahankan saat history dibaca.

Canonical typed JSON di-hash SHA-256. `(owner, mutation_id)` terkunci selama transaksi; request hash, business changes, immutable outcome dan log applied tersimpan atomic. Retry identik mengembalikan payload wire yang sama, meski respons pertama hilang. Reuse ID dengan payload berbeda ditolak. Success mengembalikan `{mutation_id,workout_id,revision,deleted,workout?,summary?}`. Summary volume decimal dihitung ulang dari final sets/master equipment, bukan angka summary yang dikirim pengguna.

## Errors dan client outbox

| HTTP/error | Arti/tindakan |
| --- | --- |
| 400 `invalid_request` | Shape/UUID/count/load/time/media invalid; tidak ada partial writes |
| 401 `unauthorized`/`login_required` | Login kembali; cache/outbox owner lama dipertahankan |
| 403 `csrf` | Origin/CSRF invalid; jangan mengirim ulang dengan perlindungan dimatikan |
| 404 `not_found` | ID tidak ada atau bukan milik sesi |
| 409 `revision_conflict` + `server` | Pilih local/server eksplisit; pilihan local membuat mutation ID baru pada revisi server |
| 409 `mutation_reused` | ID pernah diproses dengan payload berbeda |
| 410 `deleted` | UUID tombstoned; hapus salinan lokal, jangan recreate |
| 500 `internal_error` | Transaksi gagal; pending immutable tetap tersedia untuk retry |
| 503 `google_not_available` | OAuth belum tersedia; guest tetap berfungsi |

IndexedDB v2 menjaga workouts, bindings account dan outbox terpisah. Guest tidak diimpor otomatis. Coalesce hanya job belum dikirim; status sending membuat payload immutable. ACK atomik mengubah server revision lalu mengantre local edit yang lebih baru. Conflict menahan mutasi sampai pilihan pengguna. Perubahan metadata sync tidak menaikkan revision CAS lokal; server-version replacement menaikkannya agar tab lain tidak diam-diam menimpa data.

Owner switch tidak mengirim outbox lama; account_id/session check melindungi saat cookie berubah di tab lain. Account deletion membersihkan cache/outbox akun ini, mempertahankan guest. Identity Google yang login lagi memperoleh user UUID baru; cache identitas UUID lama tidak otomatis diimpor. Tombstone workout mempertahankan UUID/revision minimal, isi/pauses/durations dibuang. Outcome idempotensi tetap dipertahankan sampai account deletion; aktivitas log bukan sumber state operasional.
