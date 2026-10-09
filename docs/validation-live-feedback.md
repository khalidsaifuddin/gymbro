# Validation: workout UI and live-feedback revision

Date: 9 October 2026. Browser tests used local Chromium, the verified local MediaPipe model, and a disposable PostgreSQL `gymbro_test` container. The account browser suite used its isolated database and signed OIDC fixture, not a production Google login.

## RED and GREEN evidence

- Workout/routine UI: initial behavior tests had 8 failing unit cases and 4 failing browser flows before implementation. The routine, session, Explore, and camera flows subsequently passed.
- Detection sensitivity: moderate squat (170° → 120° → 170°) and bilateral curl (170° → 85° → 170°) replay cases failed with the prior thresholds (2 failures among 34 adapter cases). After threshold, smoothing, and debounce tuning, 34 adapter cases passed. Jitter, partial, asymmetric curl, tracking loss, and perspective replay remain in the suite.
- Live feedback browser checks: four new scenarios failed against the previous build: phone page scrolling, cyan theme, per-exercise camera angles, and imported catalog/manual-only controls. They passed on the updated build. A new IndexedDB angle-map test failed before implementation and passed after it.
- PostgreSQL migration: the new 1,324-row catalog and manual exercise persistence integration checks failed before migration 005 and passed against disposable PostgreSQL after implementation. The full backend integration suite passed. Existing API/migration tests were updated to expect 1,333 catalog entries and five migrations.
- Frontend unit suite: 253 tests in 18 files passed; TypeScript typecheck and Expo web export passed. The offline asset manifest contains 35 same-origin assets, with no imported third-party media.
- The complete account browser suite passed 8/8 scenarios, including guest import, offline sync, conflict handling, deletion, and a manual imported exercise with a stable PostgreSQL ID.
- The first complete guest browser run passed 40/42 scenarios: one old guide test iterated over manual-only imported exercises and one recording test timed out during model startup. After correcting those tests, both focused cases passed. The second complete run passed 41/42; its sole failure was another five-second camera startup wait while the UI showed `LOADING`. After increasing that case's readiness wait to 20 seconds, the focused camera pause/background test passed (1/1, 10.6 seconds). No failing browser scenario remains, though a third entire-suite run was not performed.

## Limits of these results

Synthetic landmark replay and fake-camera browser tests prove state transitions, UI, persistence, and network boundaries. They do not measure real-camera detection accuracy or the user's actual curl/squat sensitivity. No labeled workout video or device session was available to this run, so automatic accuracy, false-positive rate, and the product's live evaluation gate remain unverified. Chrome Android, Edge, Safari, native apps, and a real Google OAuth configuration were not tested here. The user can continue live movement trials on the local app; individual missed/extra reps should be captured as labeled examples for subsequent tuning.

## Final regression results

The local server at `http://localhost:8080` was restarted with the new build and additive migration. `/health` returned 200 and `/api/v1/exercises` returned 1,333 records. Camera page scrolling, cyan computed color, per-exercise angle recovery, full catalog browsing, offline reload, and recording were all exercised in Chromium.
