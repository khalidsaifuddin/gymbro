CREATE SCHEMA IF NOT EXISTS ref;
CREATE TABLE ref.users (
 id UUID PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE CHECK(length(google_sub)>0),
 display_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ref.exercises (
 id UUID PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 equipment TEXT NOT NULL, load_convention TEXT NOT NULL, recognition_version TEXT NOT NULL,
 automatic_candidate BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE ref.exercise_assets (
 id UUID PRIMARY KEY, exercise_id UUID NOT NULL REFERENCES ref.exercises(id),
 path TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, creator TEXT NOT NULL, license TEXT NOT NULL,
 attribution TEXT NOT NULL, source_url TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$')
);
CREATE TABLE public.workouts (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES ref.users(id) ON DELETE CASCADE,
 started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ,
 duration_ms BIGINT NOT NULL DEFAULT 0 CHECK(duration_ms>=0),
 paused_duration_ms BIGINT NOT NULL DEFAULT 0 CHECK(paused_duration_ms>=0),
 rest_duration_ms BIGINT NOT NULL DEFAULT 0 CHECK(rest_duration_ms>=0),
 status TEXT NOT NULL CHECK(status IN('active','paused','completed','deleted')),
 revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>=1), deleted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(finished_at IS NULL OR finished_at>=started_at),
 CHECK((status='deleted')=(deleted_at IS NOT NULL)),
 CHECK(status<>'completed' OR finished_at IS NOT NULL)
);
CREATE INDEX workouts_user_started_idx ON public.workouts(user_id,started_at DESC);
CREATE TABLE public.workout_exercises (
 id UUID PRIMARY KEY, workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
 exercise_id UUID NOT NULL REFERENCES ref.exercises(id), position INTEGER NOT NULL CHECK(position>=0),
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2048),
 rest_target_seconds INTEGER NOT NULL DEFAULT 120 CHECK(rest_target_seconds BETWEEN 0 AND 3600),
 UNIQUE(workout_id,position)
);
CREATE TABLE public.workout_sets (
 id UUID PRIMARY KEY, workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0), detected_reps INTEGER NOT NULL CHECK(detected_reps>=0),
 reps INTEGER NOT NULL CHECK(reps>=0), rep_source TEXT NOT NULL CHECK(rep_source IN('automatic','manual','mixed')),
 detected_exercise_id UUID REFERENCES ref.exercises(id),
 recognition_status TEXT NOT NULL DEFAULT 'unknown' CHECK(recognition_status IN('known','unknown','manual')),
 load_kg NUMERIC(8,3) CHECK(load_kg>=0), implement_count SMALLINT NOT NULL DEFAULT 1 CHECK(implement_count>=1),
 started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ, last_rep_at TIMESTAMPTZ NOT NULL,
 rest_duration_ms BIGINT NOT NULL DEFAULT 0 CHECK(rest_duration_ms>=0),
 source_ids UUID[] NOT NULL CHECK(cardinality(source_ids)>0),
 merged_from JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(merged_from)='array'), load_edited BOOLEAN NOT NULL DEFAULT false,
 UNIQUE(workout_exercise_id,position), CHECK(last_rep_at>=started_at), CHECK(ended_at IS NULL OR ended_at>=last_rep_at)
);
CREATE TABLE public.auth_sessions (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES ref.users(id) ON DELETE CASCADE,
 token_hash BYTEA NOT NULL UNIQUE CHECK(octet_length(token_hash)=32),
 csrf_hash BYTEA NOT NULL CHECK(octet_length(csrf_hash)=32), expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_expiry_idx ON public.auth_sessions(user_id,expires_at);
CREATE TABLE public.sync_mutations (
 user_id UUID NOT NULL REFERENCES ref.users(id) ON DELETE CASCADE, mutation_id UUID NOT NULL,
 request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32), workout_id UUID NOT NULL,
 resulting_revision BIGINT NOT NULL CHECK(resulting_revision>=1),
 outcome JSONB NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,mutation_id)
);
INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version) VALUES('00000000-0000-4000-8000-000000000001','squat','Squat','bodyweight','optional-external-kg','pose-v1-prototype');
INSERT INTO ref.exercise_assets(id,exercise_id,path,mime_type,creator,license,attribution,source_url,sha256) VALUES('00000000-0000-4000-8000-000000100001','00000000-0000-4000-8000-000000000001','/exercises/squat.svg','image/svg+xml','Gymbro contributors','CC-BY-4.0','Gymbro contributors — Gymbro exercise guides — CC-BY-4.0','https://github.com/khalidsaifuddin/gymbro/blob/b26f16d90222d4d3e0a4c94fabb74cb9b6f36d28/frontend/public/exercises/squat.svg','7bdf4dfc8cf1cb169d171646374dc3767fe8071e8b8b2719a36e453cfb694f3e');
INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version) VALUES('00000000-0000-4000-8000-000000000002','push-up','Push-up','bodyweight','optional-external-kg','pose-v1-prototype');
INSERT INTO ref.exercise_assets(id,exercise_id,path,mime_type,creator,license,attribution,source_url,sha256) VALUES('00000000-0000-4000-8000-000000100002','00000000-0000-4000-8000-000000000002','/exercises/push-up.svg','image/svg+xml','Gymbro contributors','CC-BY-4.0','Gymbro contributors — Gymbro exercise guides — CC-BY-4.0','https://github.com/khalidsaifuddin/gymbro/blob/b26f16d90222d4d3e0a4c94fabb74cb9b6f36d28/frontend/public/exercises/push-up.svg','82d1369f5240ff3ebf03e38aa37e0921ff8e69ab79df1d7653501b26b7138006');
INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version) VALUES('00000000-0000-4000-8000-000000000003','dumbbell-curl','Dumbbell curl','dumbbell','per-dumbbell-kg','pose-v1-prototype');
INSERT INTO ref.exercise_assets(id,exercise_id,path,mime_type,creator,license,attribution,source_url,sha256) VALUES('00000000-0000-4000-8000-000000100003','00000000-0000-4000-8000-000000000003','/exercises/dumbbell-curl.svg','image/svg+xml','Gymbro contributors','CC-BY-4.0','Gymbro contributors — Gymbro exercise guides — CC-BY-4.0','https://github.com/khalidsaifuddin/gymbro/blob/b26f16d90222d4d3e0a4c94fabb74cb9b6f36d28/frontend/public/exercises/dumbbell-curl.svg','ed950531e16313d98a131f3104fa20703e3d50f417b3e7da258bea87197546dc');
INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version) VALUES('00000000-0000-4000-8000-000000000004','machine-shoulder-press','Seated machine shoulder press','machine','selected-machine-kg','pose-v1-prototype');
INSERT INTO ref.exercise_assets(id,exercise_id,path,mime_type,creator,license,attribution,source_url,sha256) VALUES('00000000-0000-4000-8000-000000100004','00000000-0000-4000-8000-000000000004','/exercises/machine-shoulder-press.svg','image/svg+xml','Gymbro contributors','CC-BY-4.0','Gymbro contributors — Gymbro exercise guides — CC-BY-4.0','https://github.com/khalidsaifuddin/gymbro/blob/b26f16d90222d4d3e0a4c94fabb74cb9b6f36d28/frontend/public/exercises/machine-shoulder-press.svg','320ec82d80ea827ba710eb4bb77bf1caa8792fa7955c5d2a34e58e4c65386504');
INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version) VALUES('00000000-0000-4000-8000-000000000005','bench-press','Flat barbell bench press','barbell','total-including-bar-kg','pose-v1-prototype');
INSERT INTO ref.exercise_assets(id,exercise_id,path,mime_type,creator,license,attribution,source_url,sha256) VALUES('00000000-0000-4000-8000-000000100005','00000000-0000-4000-8000-000000000005','/exercises/bench-press.svg','image/svg+xml','Gymbro contributors','CC-BY-4.0','Gymbro contributors — Gymbro exercise guides — CC-BY-4.0','https://github.com/khalidsaifuddin/gymbro/blob/b26f16d90222d4d3e0a4c94fabb74cb9b6f36d28/frontend/public/exercises/bench-press.svg','b80239b66c703a524753b63233f2c63691a4cddf3374854b21415d6798fa4c55');
