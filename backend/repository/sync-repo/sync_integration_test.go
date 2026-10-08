//go:build integration

package syncrepo

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	"gorm.io/gorm"
	"sync"
	"testing"
	"time"
)

func fixture(t *testing.T) (*gorm.DB, usecase.Sync, string, usecase.Mutation) {
	t.Helper()
	db := testdb.New(t)
	if err := migration.Up(db); err != nil {
		t.Fatal(err)
	}
	owner := uuid.NewString()
	if err := db.Exec("INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,?,?)", owner, owner, "Fixture").Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	end := now.Add(-time.Second)
	start := end.Add(-time.Minute)
	w := entity.Workout{ID: uuid.NewString(), StartedAt: start, CapturedAt: &now, FinishedAt: &end, Status: "completed", DurationMS: 60000, Exercises: []entity.WorkoutExercise{}}
	m := usecase.Mutation{AccountID: owner, MutationID: uuid.NewString(), WorkoutID: w.ID, Operation: "upsert", OccurredAt: now, Workout: &w}
	return db, usecase.Sync{Port: New(db)}, owner, m
}
func TestConcurrentRetryAndImmutableOutcome(t *testing.T) {
	db, s, owner, m := fixture(t)
	var wg sync.WaitGroup
	out := make([]usecase.Outcome, 8)
	errs := make([]error, 8)
	for i := range out {
		wg.Add(1)
		go func(i int) { defer wg.Done(); out[i], errs[i] = s.Apply(context.Background(), owner, m) }(i)
	}
	wg.Wait()
	for i := range out {
		if errs[i] != nil || out[i].Revision != 1 || !sameJSON(out[0], out[i]) {
			t.Fatalf("retry %d: %+v %v", i, out[i], errs[i])
		}
	}
	for _, table := range []string{"public.workouts", "public.sync_mutations", "log.workout_events", "log.sync_events"} {
		var count int64
		if err := db.Table(table).Count(&count).Error; err != nil || count != 1 {
			t.Fatalf("%s count=%d err=%v", table, count, err)
		}
	}
	m.OccurredAt = m.OccurredAt.Add(time.Millisecond)
	if _, err := s.Apply(context.Background(), owner, m); !errors.Is(err, usecase.ErrMutationReused) {
		t.Fatalf("reused: %v", err)
	}
}
func TestRevisionRaceAndLogFailureAreAtomic(t *testing.T) {
	db, s, owner, m := fixture(t)
	if _, err := s.Apply(context.Background(), owner, m); err != nil {
		t.Fatal(err)
	}
	a, b := m, m
	a.MutationID = uuid.NewString()
	b.MutationID = uuid.NewString()
	a.BaseRevision = 1
	b.BaseRevision = 1
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i, n := range []usecase.Mutation{a, b} {
		wg.Add(1)
		go func(i int, n usecase.Mutation) { defer wg.Done(); _, errs[i] = s.Apply(context.Background(), owner, n) }(i, n)
	}
	wg.Wait()
	successes, conflicts := 0, 0
	for _, err := range errs {
		if err == nil {
			successes++
		} else if errors.Is(err, entity.ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("race: %v", errs)
	}
	if err := db.Exec("ALTER TABLE log.sync_events ADD CONSTRAINT reject_applied CHECK(event_type <> 'sync.applied') NOT VALID").Error; err != nil {
		t.Fatal(err)
	}
	a.MutationID = uuid.NewString()
	a.BaseRevision = 2
	if _, err := s.Apply(context.Background(), owner, a); err == nil {
		t.Fatal("log failure accepted")
	}
	var rev int64
	db.Table("public.workouts").Select("revision").Where("id=?", m.WorkoutID).Scan(&rev)
	if rev != 2 {
		t.Fatal("partial commit", rev)
	}
}
func TestDeleteTombstoneAndStaleAccount(t *testing.T) {
	db, s, owner, m := fixture(t)
	if _, err := s.Apply(context.Background(), owner, m); err != nil {
		t.Fatal(err)
	}
	d := usecase.Mutation{AccountID: owner, MutationID: uuid.NewString(), WorkoutID: m.WorkoutID, BaseRevision: 1, Operation: "delete", OccurredAt: m.OccurredAt}
	out, err := s.Apply(context.Background(), owner, d)
	if err != nil || !out.Deleted || out.Revision != 2 {
		t.Fatalf("delete: %+v %v", out, err)
	}
	m.MutationID = uuid.NewString()
	m.BaseRevision = 2
	if _, err = s.Apply(context.Background(), owner, m); !errors.Is(err, entity.ErrDeleted) {
		t.Fatal("resurrection", err)
	}
	if err = db.Exec("DELETE FROM ref.users WHERE id=?", owner).Error; err != nil {
		t.Fatal(err)
	}
	if _, err = s.Apply(context.Background(), owner, m); !errors.Is(err, usecase.ErrUnauthorized) {
		t.Fatal("stale account", err)
	}
}

func sameJSON(a, b any) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return string(x) == string(y)
}
