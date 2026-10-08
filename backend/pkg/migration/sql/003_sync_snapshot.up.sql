ALTER TABLE public.workouts ADD COLUMN captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.workouts ADD COLUMN pause_intervals JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(pause_intervals)='array');
ALTER TABLE public.workout_sets ADD COLUMN label_source TEXT NOT NULL DEFAULT 'unknown' CHECK(label_source IN('automatic','profile','manual','mixed','unknown'));
