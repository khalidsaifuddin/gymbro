CREATE SCHEMA log;
DO $migration$
DECLARE parent TEXT; moment TIMESTAMPTZ; next_moment TIMESTAMPTZ; offset_month INTEGER;
BEGIN
 FOREACH parent IN ARRAY ARRAY['workout_events','auth_events','sync_events'] LOOP
  EXECUTE format('CREATE TABLE log.%I (
   id UUID NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), occurred_at TIMESTAMPTZ,
   event_type TEXT NOT NULL, actor_id UUID, workout_id UUID, correlation_id UUID,
   metadata JSONB NOT NULL DEFAULT ''{}''::jsonb CHECK(jsonb_typeof(metadata)=''object''),
   PRIMARY KEY(recorded_at,id)
  ) PARTITION BY RANGE(recorded_at)',parent);
  EXECUTE format('CREATE INDEX ON log.%I(actor_id,recorded_at)',parent);
  EXECUTE format('CREATE TABLE log.%I PARTITION OF log.%I DEFAULT',parent||'_default',parent);
  FOR offset_month IN 0..1 LOOP
   moment := (date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + make_interval(months=>offset_month)) AT TIME ZONE 'UTC';
   next_moment := ((moment AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';
   EXECUTE format('CREATE TABLE log.%I PARTITION OF log.%I FOR VALUES FROM (%L) TO (%L)',parent||'_'||to_char(moment AT TIME ZONE 'UTC','YYYY_MM'),parent,moment,next_moment);
  END LOOP;
 END LOOP;
END $migration$;
