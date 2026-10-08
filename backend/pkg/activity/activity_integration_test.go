//go:build integration

package activity_test

import (
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/activity"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	"gorm.io/gorm"
	"testing"
	"time"
)

func ready(t *testing.T) *gorm.DB {
	t.Helper()
	db := testdb.New(t)
	if err := migration.Up(db); err != nil {
		t.Fatal(err)
	}
	return db
}
func TestUTCPartitionBoundaryAndDelayedOfflineTime(t *testing.T) {
	db := ready(t)
	start := time.Date(2040, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := activity.EnsureMonths(db, start, 2); err != nil {
		t.Fatal(err)
	}
	occurred := start.AddDate(0, -1, 0)
	points := []time.Time{start.AddDate(0, 1, 0).Add(-time.Microsecond), start.AddDate(0, 1, 0)}
	for i, point := range points {
		event := activity.Event{ID: uuid.NewString(), RecordedAt: point, OccurredAt: &occurred, Type: "workout.created", Metadata: map[string]any{"revision": int64(1)}}
		if err := activity.Record(db, "workout", event); err != nil {
			t.Fatal(err)
		}
		var partition string
		var original time.Time
		if err := db.Raw(`SELECT tableoid::regclass::text,occurred_at FROM log.workout_events WHERE id=?`, event.ID).Row().Scan(&partition, &original); err != nil {
			t.Fatal(err)
		}
		wanted := []string{"log.workout_events_2040_01", "log.workout_events_2040_02"}[i]
		if partition != wanted || !original.Equal(occurred) {
			t.Fatalf("route/original: %s %s", partition, original)
		}
	}
}
func TestMissingPartitionFallbackMovesWithoutLoss(t *testing.T) {
	db := ready(t)
	when := time.Date(2041, 7, 3, 8, 0, 0, 0, time.FixedZone("offset", 7*3600))
	event := activity.Event{ID: uuid.NewString(), RecordedAt: when, Type: "sync.applied", Metadata: map[string]any{"revision": int64(1)}}
	if err := activity.Record(db, "sync", event); err != nil {
		t.Fatal(err)
	}
	var partition string
	if err := db.Raw(`SELECT tableoid::regclass::text FROM log.sync_events WHERE id=?`, event.ID).Scan(&partition).Error; err != nil || partition != "log.sync_events_default" {
		t.Fatalf("fallback: %s %v", partition, err)
	}
	if err := activity.EnsureMonths(db, when, 2); err != nil {
		t.Fatal(err)
	}
	if err := activity.EnsureMonths(db, when, 2); err != nil {
		t.Fatal(err)
	}
	if err := db.Raw(`SELECT tableoid::regclass::text FROM log.sync_events WHERE id=?`, event.ID).Scan(&partition).Error; err != nil || partition != "log.sync_events_2041_07" {
		t.Fatalf("moved route: %s %v", partition, err)
	}
	var count int64
	db.Raw(`SELECT count(*) FROM log.sync_events WHERE id=?`, event.ID).Scan(&count)
	if count != 1 {
		t.Fatalf("lost/duplicated fallback row: %d", count)
	}
}
func TestLogExpiryDoesNotDeleteOperationalState(t *testing.T) {
	db := ready(t)
	uid := uuid.NewString()
	if err := db.Exec(`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,?,?)`, uid, uid, "Test").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO public.workouts(id,user_id,started_at,status) VALUES(?,?,now(),'active')`, uuid.NewString(), uid).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO public.auth_sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES(?,?,decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),now()+interval '1 day')`, uuid.NewString(), uid).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO public.sync_mutations(user_id,mutation_id,request_hash,workout_id,resulting_revision,outcome) VALUES(?,?,decode(repeat('01',32),'hex'),?,1,'{}')`, uid, uuid.NewString(), uuid.NewString()).Error; err != nil {
		t.Fatal(err)
	}
	when := time.Date(2042, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := activity.EnsureMonths(db, when, 1); err != nil {
		t.Fatal(err)
	}
	if err := activity.Record(db, "auth", activity.Event{ID: uuid.NewString(), ActorID: &uid, RecordedAt: when, Type: "auth.login"}); err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`DROP TABLE log.auth_events_2042_01`).Error; err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"ref.users", "public.workouts", "public.auth_sessions", "public.sync_mutations"} {
		var count int64
		if err := db.Table(table).Count(&count).Error; err != nil || count != 1 {
			t.Fatalf("state affected by retention %s: %d %v", table, count, err)
		}
	}
}
func TestLogsRejectSecretsMediaAndInvalidTableNames(t *testing.T) {
	db := ready(t)
	for _, key := range []string{"token", "video", "pose", "email", "client_secret"} {
		if err := activity.Record(db, "auth", activity.Event{ID: uuid.NewString(), Type: "auth.login", Metadata: map[string]any{key: "private"}}); err == nil {
			t.Fatalf("unsafe metadata accepted: %s", key)
		}
	}
	if err := activity.Record(db, "auth;DROP SCHEMA ref CASCADE", activity.Event{ID: uuid.NewString(), Type: "auth.login"}); err == nil {
		t.Fatal("unsafe identifier accepted")
	}
}
