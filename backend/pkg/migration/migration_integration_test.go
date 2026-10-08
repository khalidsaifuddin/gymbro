//go:build integration

package migration

import (
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"testing"
	"time"
)

func TestFreshSchemasAndRepeatableSeed(t *testing.T) {
	db := testdb.New(t)
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"ref.users", "ref.exercises", "ref.exercise_assets", "public.workouts", "public.workout_exercises", "public.workout_sets", "public.auth_sessions", "public.sync_mutations"} {
		var exists bool
		if err := db.Raw(`SELECT to_regclass(?) IS NOT NULL`, table).Scan(&exists).Error; err != nil || !exists {
			t.Fatalf("missing table %s: %v", table, err)
		}
	}
	var count int64
	if err := db.Raw(`SELECT count(*) FROM ref.exercises`).Scan(&count).Error; err != nil || count != 5 {
		t.Fatalf("exercise seed: %d, %v", count, err)
	}
	if err := db.Raw(`SELECT count(*) FROM ref.exercise_assets WHERE license='CC-BY-4.0' AND mime_type='image/svg+xml'`).Scan(&count).Error; err != nil || count != 5 {
		t.Fatalf("asset seed: %d, %v", count, err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	if err := db.Raw(`SELECT count(*) FROM ref.exercises`).Scan(&count).Error; err != nil || count != 5 {
		t.Fatalf("repeatable seed: %d, %v", count, err)
	}
}
func TestConstraintsAndNumericStorage(t *testing.T) {
	db := testdb.New(t)
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	uid := "10000000-0000-4000-8000-000000000001"
	wid := "20000000-0000-4000-8000-000000000001"
	eid := "30000000-0000-4000-8000-000000000001"
	sid := "40000000-0000-4000-8000-000000000001"
	must := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	must(`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,?,?)`, uid, "test-sub", "Test")
	must(`INSERT INTO public.workouts(id,user_id,started_at,status) VALUES(?,?,now(),'active')`, wid, uid)
	must(`INSERT INTO public.workout_exercises(id,workout_id,exercise_id,position) SELECT ?,?,id,0 FROM ref.exercises WHERE slug='bench-press'`, eid, wid)
	must(`INSERT INTO public.workout_sets(id,workout_exercise_id,position,detected_reps,reps,rep_source,started_at,last_rep_at,load_kg,source_ids) VALUES(?,?,0,8,8,'automatic',now(),now(),40.125,ARRAY[?]::uuid[])`, sid, eid, sid)
	var load string
	mustQuery := db.Raw(`SELECT load_kg::text FROM public.workout_sets WHERE id=?`, sid).Scan(&load).Error
	if mustQuery != nil || load != "40.125" {
		t.Fatalf("decimal roundtrip: %q, %v", load, mustQuery)
	}
	for _, sql := range []string{
		`UPDATE public.workout_sets SET reps=-1`, `UPDATE public.workout_sets SET load_kg=-1`, `UPDATE public.workout_sets SET implement_count=0`,
		`UPDATE public.workout_exercises SET rest_target_seconds=-1`, `UPDATE public.workouts SET revision=0`,
		`UPDATE public.workouts SET user_id='10000000-0000-4000-8000-999999999999'`,
		`UPDATE public.workout_exercises SET exercise_id='10000000-0000-4000-8000-999999999999'`,
		`INSERT INTO public.workout_exercises(id,workout_id,exercise_id,position) SELECT gen_random_uuid(),workout_id,exercise_id,position FROM public.workout_exercises`,
	} {
		if err := db.Exec(sql).Error; err == nil {
			t.Fatalf("constraint accepted: %s", sql)
		}
	}
	var schema, typeName string
	if err := db.Raw(`SELECT table_schema,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='workout_sets' AND column_name='load_kg'`).Row().Scan(&schema, &typeName); err != nil || typeName != "numeric" {
		t.Fatalf("numeric type: %s/%s: %v", schema, typeName, err)
	}
}
func TestFreshRollbackIsRestrictedAndReinstallable(t *testing.T) {
	db := testdb.New(t)
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	if err := DownDisposable(db); err != nil {
		t.Fatal(err)
	}
	var exists bool
	if err := db.Raw(`SELECT to_regclass('ref.exercises') IS NOT NULL`).Scan(&exists).Error; err != nil || exists {
		t.Fatalf("rollback failed: %v", err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
}

func TestUTCPartitionBoundsWithNonUTCSessionTimezone(t *testing.T) {
	db := testdb.New(t)
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	if err := db.Exec(`SET TIME ZONE 'America/New_York'`).Error; err != nil {
		t.Fatal(err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Raw(`SELECT count(*) FROM pg_inherits WHERE inhparent='log.workout_events'::regclass`).Scan(&count).Error; err != nil || count != 3 {
		t.Fatalf("current/next/default partitions: %d %v", count, err)
	}
	var month time.Time
	if err := db.Raw(`SELECT date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`).Scan(&month).Error; err != nil {
		t.Fatal(err)
	}
	month = month.UTC()
	for _, point := range []time.Time{month, month.AddDate(0, 1, 0).Add(-time.Microsecond), month.AddDate(0, 1, 0)} {
		if err := db.Exec(`INSERT INTO log.workout_events(id,recorded_at,event_type) VALUES(gen_random_uuid(),?,'test')`, point).Error; err != nil {
			t.Fatal(err)
		}
		var table string
		if err := db.Raw(`SELECT tableoid::regclass::text FROM log.workout_events WHERE recorded_at=?`, point).Scan(&table).Error; err != nil || table != "log.workout_events_"+point.Format("2006_01") {
			t.Fatalf("UTC boundary route: %s %v", table, err)
		}
	}
}
