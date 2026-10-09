# Implementation plan: live camera feedback and expanded exercise catalog

Date: 9 October 2026. Continue `feat/workout-routines-ui` and its unfinished UI validation. This revision follows the user's live curl/squat trial and replaces the previous session-wide camera angle decision.

## Scope and decisions

- Make squat and bilateral dumbbell curl detection more responsive to a complete movement with a smaller practical range of motion. Retain a ready → peak → ready cycle, bilateral curl requirement, tracking-loss reset, and no count for jitter/partial movement. Threshold changes are provisional until evaluated with labeled live workouts; synthetic fixtures cannot establish accuracy.
- Import every record from `hasaneyldrm/exercises-dataset` at pinned commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. The 1,324 entries must be searchable in Explore and selectable for browser-local routines and manual session logging. Camera controls appear only on the nine Gymbro exercises with implemented pose detection. The upstream code/data/instruction text is MIT; upstream thumbnails/GIFs are third-party Gym visual media requiring a separate license. Import only metadata and English instructions, keep attribution/license and existing original Gymbro SVGs for the nine supported movements. Do not include upstream media.
- Add deterministic catalog IDs and backend `ref.exercises` rows for imported exercises so account sync of manual workouts works. Existing nine IDs and local records remain valid. Imported exercise loads use the entered total external kg once; bodyweight has no inferred weight. Dataset entries are manual-only.
- Restore ordinary vertical scrolling on home, editor, Explore, and workout pages in desktop and mobile browsers. Keep body scroll locked only while the full-viewport camera is open.
- Store camera angle by supported exercise in workout preferences. The user can select or change an exercise's angle before starting its camera, including after switching to another exercise in the same workout. An angle change resets partial detection state; a live set must be ended before changing its angle. Persist settings through reload/recovery and read legacy session-wide `cameraView` as an initial fallback.
- Use SAKA's cyan preset across the web UI, including framing/skeleton and status colors. Keep offline support and focus/contrast behavior.

## Components and data

- Frontend catalog module and generated slim JSON, Explore/picker, routine/session cards, manual entry, workout snapshot/store validation, sync mapper and binding handling.
- Backend versioned migration for `ref.exercises` and real PostgreSQL integration test for a dataset exercise/synced manual set.
- Pose phase adapter and focused replay tests for squat/curl; camera controls, per-exercise preference validation and recovery tests.
- SAKA root theme and Gymbro CSS, plus browser tests for touch/wheel scrolling and cyan computed colors.
- OpenSpec active change, product requirements, and validation report.

## Acceptance scenarios

1. Full shallow-but-complete squat and bilateral curl replay counts one rep after ready → peak → ready; near-threshold jitter, partial motion, one-arm curl, occlusion, and camera-side changes do not add reps. Document actual automated counts and remaining live validation.
2. Explore lists 1,324 imported entries in addition to existing supported exercises, with search/filter/detail instructions. A dataset-only exercise can be added to routine, started, manually logged, recovered, and synced to an account; it has no Camera button. Nine supported cards retain Camera.
3. A phone viewport can scroll to actions below the fold on home/session/Explore. The full-screen camera continues to fit one viewport and returns to normal page scrolling when closed.
4. Curl and squat can hold distinct camera angles in one workout; switching exercise permits changing the next angle. A partial cycle is discarded when angle changes, and both settings survive recovery. Legacy snapshots still open.
5. Cyan SAKA colors appear on web home, forms, camera overlay, and controls. No third-party exercise images/GIFs or remote media requests are added.

## Work order and validation

1. RED: add behavior tests for sensitivity without false positives, full catalog identity/validation, manual-only sync via PostgreSQL, per-exercise angle/recovery, scroll, and cyan. Execute and capture failures.
2. GREEN: implement catalog data/migration and manual flow, detector tuning, per-exercise camera state, scroll fix, and cyan theme.
3. REFACTOR: keep supported camera IDs separate from catalog IDs, avoid eagerly allocating data for every exercise in each workout, preserve legacy data, and document source/license.
4. Run frontend unit/type/build/browser and account sync suites, plus the PostgreSQL integration test. Record actual pass/fail counts. Inspect phone-width pages and test a real camera separately when a labeled movement sample and device are available.

Commands: `volta run --node 24.21.0 --bundled-npm npm --prefix frontend test`, `run typecheck`, `run build:web`, `run test:e2e`, `run test:account`; `GYMBRO_TEST_DATABASE_URL=postgres://gymbro_test@127.0.0.1:55432/gymbro_test?sslmode=disable go test -tags=integration ./...` from `backend`, only against the documented disposable local PostgreSQL fixture.
