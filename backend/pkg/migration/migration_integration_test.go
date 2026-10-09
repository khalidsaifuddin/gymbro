//go:build integration

package migration

import (
	"crypto/sha256"
	"fmt"
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
	if err := db.Raw(`SELECT count(*) FROM ref.exercises`).Scan(&count).Error; err != nil || count != 9 {
		t.Fatalf("exercise seed: %d, %v", count, err)
	}
	if err := db.Raw(`SELECT count(*) FROM ref.exercise_assets WHERE license='CC-BY-4.0' AND mime_type='image/svg+xml'`).Scan(&count).Error; err != nil || count != 9 {
		t.Fatalf("asset seed: %d, %v", count, err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	if err := db.Raw(`SELECT count(*) FROM ref.exercises`).Scan(&count).Error; err != nil || count != 9 {
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

func TestPauseAndRawLabelColumnsForSync(t *testing.T) {
	db := testdb.New(t)
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	for _, column := range []struct{ table, name string }{{"workouts", "captured_at"}, {"workouts", "pause_intervals"}, {"workout_sets", "label_source"}} {
		var exists bool
		if err := db.Raw(`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=? AND column_name=?)`, column.table, column.name).Scan(&exists).Error; err != nil || !exists {
			t.Fatalf("missing sync column %s.%s: %v", column.table, column.name, err)
		}
	}
}

func TestUpgradeKeepsExistingWorkoutAndBackfillsSnapshotColumns(t *testing.T) {
	db := testdb.New(t)
	if err := db.Exec(`CREATE TABLE public.schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`).Error; err != nil {
		t.Fatal(err)
	}
	for i, file := range []string{"sql/001_schema.up.sql", "sql/002_activity.up.sql"} {
		body, err := scripts.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if err = db.Exec(string(body)).Error; err != nil {
			t.Fatal(err)
		}
		hash := fmt.Sprintf("%x", sha256.Sum256(body))
		if err = db.Exec(`INSERT INTO public.schema_migrations(version,name,sha256) VALUES(?,?,?)`, i+1, file, hash).Error; err != nil {
			t.Fatal(err)
		}
	}
	owner, wid := "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012"
	if err := db.Exec(`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,'upgrade-fixture','Fixture')`, owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO public.workouts(id,user_id,started_at,status,revision) VALUES(?,?,now()-interval '1 day','active',7)`, wid, owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	var row struct {
		ID             string
		Revision       int64
		CapturedAt     time.Time
		PauseIntervals string
	}
	if err := db.Raw(`SELECT id,revision,captured_at,pause_intervals::text FROM public.workouts WHERE id=?`, wid).Scan(&row).Error; err != nil || row.ID != wid || row.Revision != 7 || row.CapturedAt.IsZero() || row.PauseIntervals != "[]" {
		t.Fatalf("upgrade lost/backfill data: %+v %v", row, err)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
}

func TestCableCatalogueUpgradePreservesExistingDataAndLedger(t *testing.T) {
	db := testdb.New(t)
	if err := db.Exec(`CREATE TABLE public.schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`).Error; err != nil {
		t.Fatal(err)
	}
	hashes := make(map[int]string)
	for i, file := range []string{"sql/001_schema.up.sql", "sql/002_activity.up.sql", "sql/003_sync_snapshot.up.sql"} {
		body, err := scripts.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if err = db.Exec(string(body)).Error; err != nil {
			t.Fatal(err)
		}
		hashes[i+1] = fmt.Sprintf("%x", sha256.Sum256(body))
		if err = db.Exec(`INSERT INTO public.schema_migrations(version,name,sha256) VALUES(?,?,?)`, i+1, file, hashes[i+1]).Error; err != nil {
			t.Fatal(err)
		}
	}
	owner, wid, eid, sid, auth := "00000000-0000-4000-8000-000000000021", "00000000-0000-4000-8000-000000000022", "00000000-0000-4000-8000-000000000023", "00000000-0000-4000-8000-000000000024", "00000000-0000-4000-8000-000000000025"
	queries := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,'cable-upgrade','Fixture')`, []any{owner}},
		{`INSERT INTO public.workouts(id,user_id,started_at,status,revision) VALUES(?,?,now(),'active',7)`, []any{wid, owner}},
		{`INSERT INTO public.workout_exercises(id,workout_id,exercise_id,position) VALUES(?,?,'00000000-0000-4000-8000-000000000005',0)`, []any{eid, wid}},
		{`INSERT INTO public.workout_sets(id,workout_exercise_id,position,detected_reps,reps,rep_source,started_at,last_rep_at,load_kg,source_ids) VALUES(?,?,0,8,10,'mixed',now(),now(),40.125,ARRAY[?]::uuid[])`, []any{sid, eid, sid}},
		{`INSERT INTO public.auth_sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES(?,?,decode(repeat('ab',32),'hex'),decode(repeat('cd',32),'hex'),now()+interval '1 day')`, []any{auth, owner}},
	}
	for _, q := range queries {
		if err := db.Exec(q.sql, q.args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	var before, after string
	const snapshot = `SELECT row_to_json(w)::text || row_to_json(e)::text || row_to_json(s)::text || row_to_json(a)::text FROM public.workouts w JOIN public.workout_exercises e ON e.workout_id=w.id JOIN public.workout_sets s ON s.workout_exercise_id=e.id JOIN public.auth_sessions a ON a.user_id=w.user_id WHERE w.id=?`
	if err := db.Raw(snapshot, wid).Scan(&before).Error; err != nil {
		t.Fatal(err)
	}
	for n := 0; n < 2; n++ {
		if err := Up(db); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Raw(snapshot, wid).Scan(&after).Error; err != nil || before != after {
		t.Fatalf("existing data changed: %v", err)
	}
	for version, hash := range hashes {
		var actual string
		if err := db.Raw(`SELECT sha256 FROM public.schema_migrations WHERE version=?`, version).Scan(&actual).Error; err != nil || actual != hash {
			t.Fatalf("ledger changed: %d %v", version, err)
		}
	}
	var exercises, assets int64
	db.Raw(`SELECT count(*) FROM ref.exercises`).Scan(&exercises)
	db.Raw(`SELECT count(*) FROM ref.exercise_assets WHERE license='CC-BY-4.0'`).Scan(&assets)
	if exercises != 9 || assets != 9 {
		t.Fatalf("upgraded catalogue: %d exercises/%d assets", exercises, assets)
	}
	for i, slug := range []string{"lat-pulldown", "seated-cable-row", "face-pull", "straight-arm-pulldown"} {
		var row struct{ ID, Equipment, LoadConvention string }
		if err := db.Raw(`SELECT id,equipment,load_convention FROM ref.exercises WHERE slug=?`, slug).Scan(&row).Error; err != nil || row.ID != fmt.Sprintf("00000000-0000-4000-8000-%012d", i+6) || row.Equipment != "machine" || row.LoadConvention != "selected-machine-kg" {
			t.Fatalf("cable metadata %s: %+v %v", slug, row, err)
		}
	}
}

func TestCableRollbackRefusesReferencedMastersAtomically(t *testing.T) {
	db := testdb.New(t)
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
	for _, sql := range []string{
		`INSERT INTO ref.users(id,google_sub,display_name) VALUES('10000000-0000-4000-8000-000000000031','cable-rollback','Fixture')`,
		`INSERT INTO public.workouts(id,user_id,started_at,status) VALUES('20000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000031',now(),'active')`,
		`INSERT INTO public.workout_exercises(id,workout_id,exercise_id,position) VALUES('30000000-0000-4000-8000-000000000031','20000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000006',0)`,
	} {
		if err := db.Exec(sql).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := DownDisposable(db); err == nil {
		t.Fatal("rollback removed a referenced cable master")
	}
	var assets, versions, workouts int64
	db.Raw(`SELECT count(*) FROM ref.exercise_assets`).Scan(&assets)
	db.Raw(`SELECT count(*) FROM public.schema_migrations`).Scan(&versions)
	db.Raw(`SELECT count(*) FROM public.workouts`).Scan(&workouts)
	if assets != 9 || versions != 4 || workouts != 1 {
		t.Fatalf("rollback was partial: assets=%d versions=%d workouts=%d", assets, versions, workouts)
	}
	if err := Up(db); err != nil {
		t.Fatal(err)
	}
}
