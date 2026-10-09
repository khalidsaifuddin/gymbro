# Imported exercise catalog

Gymbro imports text and metadata from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) at commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. The checked source JSON has SHA-256 `656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d`. Run `node frontend/scripts/import-exercise-dataset.mjs /path/to/exercises.json` to regenerate the frontend catalog and SQL migration from that exact source.

All 1,324 entries are available for search, routines, targets, manual sets, and account sync. They have IDs `dataset:NNNN` in the app and stable UUIDs `00000000-0000-4000-8001-00000000NNNN` in PostgreSQL. The nine original Gymbro IDs and UUIDs remain unchanged. Imported records are `manual-only`; camera detection is available only for the nine original movements. Their entered kg represents total external load once. Bodyweight is not estimated.

The upstream code, exercise data, and instruction text are MIT licensed; the copied license is in `frontend/src/data/EXERCISES_DATASET_LICENSE.txt`. Upstream exercise images and GIFs are credited to Gym visual and have separate license terms. Gymbro imports no upstream media. The frontend keeps only English instructions and catalog metadata; the original Gymbro SVG guides remain for supported camera exercises.
