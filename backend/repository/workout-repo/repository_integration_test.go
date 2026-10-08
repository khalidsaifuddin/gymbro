//go:build integration

package workoutrepo

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	"gorm.io/gorm"
	"sync/atomic"
	"testing"
	"time"
)

func setup(t *testing.T) (*gorm.DB, *Repository, string, string) {
	t.Helper()
	db := testdb.New(t)
	if err := migration.Up(db); err != nil {
		t.Fatal(err)
	}
	a, b := uuid.NewString(), uuid.NewString()
	for _, id := range []string{a, b} {
		if err := db.Exec(`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,?,?)`, id, id, "Test").Error; err != nil {
			t.Fatal(err)
		}
	}
	return db, New(db), a, b
}
func sample(owner string) entity.Workout {
	now := time.Date(2026, 10, 1, 1, 0, 0, 0, time.UTC)
	end := now.Add(time.Minute)
	sid := uuid.NewString()
	load := "10.125"
	return entity.Workout{ID: uuid.NewString(), OwnerID: owner, StartedAt: now, FinishedAt: &end, Status: "completed", DurationMS: 60000, Exercises: []entity.WorkoutExercise{{ID: uuid.NewString(), ExerciseID: "00000000-0000-4000-8000-000000000003", Position: 0, RestTargetSeconds: 120, Sets: []entity.WorkoutSet{{SetSource: entity.SetSource{ID: sid, Reps: 10, DetectedReps: 8, LoadKG: &load, ImplementCount: 2, SourceIDs: []string{sid}}, Position: 0, RepSource: "automatic", RecognitionStatus: "known", StartedAt: now, LastRepAt: end, EndedAt: &end}}}}}
}
func TestAggregateRoundtripAndOwnerScoping(t *testing.T) {
	_, repo, a, b := setup(t)
	ctx := context.Background()
	w := sample(a)
	saved, err := repo.Save(ctx, a, w, 0)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Revision != 1 {
		t.Fatal(saved.Revision)
	}
	read, err := repo.Find(ctx, a, w.ID)
	if err != nil {
		t.Fatal(err)
	}
	s := read.Exercises[0].Sets[0]
	if *s.LoadKG != "10.125" || s.DetectedReps != 8 || s.Reps != 10 || s.SourceIDs[0] != s.ID {
		t.Fatalf("roundtrip: %+v", s)
	}
	if v := read.Summary(); v.KnownVolumeKG != "202.500" || v.TotalReps != 10 {
		t.Fatal(v)
	}
	if _, err := repo.Find(ctx, b, w.ID); !errors.Is(err, entity.ErrNotFound) {
		t.Fatalf("owner read: %v", err)
	}
	list, err := repo.List(ctx, b)
	if err != nil || len(list) != 0 {
		t.Fatalf("other owner's history: %v, %v", list, err)
	}
	if _, err := repo.Save(ctx, b, w, 1); !errors.Is(err, entity.ErrNotFound) {
		t.Fatalf("owner write: %v", err)
	}
	s.Reps = 12
	read.Exercises[0].Sets[0] = s
	updated, err := repo.Save(ctx, a, read, 1)
	if err != nil || updated.Revision != 2 {
		t.Fatalf("update: %+v %v", updated, err)
	}
	if _, err := repo.Save(ctx, a, read, 1); !errors.Is(err, entity.ErrConflict) {
		t.Fatalf("stale write: %v", err)
	}
}
func TestNestedIDCollisionRollsBackTheWholeAggregate(t *testing.T) {
	_, repo, a, b := setup(t)
	ctx := context.Background()
	own, other := sample(a), sample(b)
	if _, err := repo.Save(ctx, a, own, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Save(ctx, b, other, 0); err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{"exercise", "set"} {
		changed, _ := repo.Find(ctx, a, own.ID)
		if target == "exercise" {
			changed.Exercises[0].ID = other.Exercises[0].ID
		} else {
			changed.Exercises[0].Sets[0].ID = other.Exercises[0].Sets[0].ID
		}
		changed.Exercises[0].Sets[0].Reps = 99
		if _, err := repo.Save(ctx, a, changed, 1); err == nil {
			t.Fatal("nested ID takeover accepted")
		}
		before, err := repo.Find(ctx, a, own.ID)
		if err != nil || before.Revision != 1 || before.Exercises[0].Sets[0].Reps != 10 {
			t.Fatalf("partial write: %+v %v", before, err)
		}
	}
}
func TestInvalidNestedLoadDoesNotMutateAndMergedProvenanceSurvives(t *testing.T) {
	_, repo, a, _ := setup(t)
	ctx := context.Background()
	w := sample(a)
	first := w.Exercises[0].Sets[0].SetSource
	second := first
	second.ID = uuid.NewString()
	second.SourceIDs = []string{second.ID}
	weight := "20.000"
	second.LoadKG = &weight
	s := &w.Exercises[0].Sets[0]
	s.Reps = 20
	s.DetectedReps = 16
	s.LoadKG = nil
	s.SourceIDs = append(first.SourceIDs, second.SourceIDs...)
	s.MergedFrom = []entity.SetSource{first, second}
	if _, err := repo.Save(ctx, a, w, 0); err != nil {
		t.Fatal(err)
	}
	read, err := repo.Find(ctx, a, w.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.Summary().KnownVolumeKG != "602.500" || len(read.Exercises[0].Sets[0].MergedFrom) != 2 {
		t.Fatal(read.Summary())
	}
	bad := "-1"
	read.Exercises[0].Sets[0].LoadKG = &bad
	if _, err := repo.Save(ctx, a, read, 1); !errors.Is(err, entity.ErrInvalid) {
		t.Fatal(err)
	}
	unchanged, _ := repo.Find(ctx, a, w.ID)
	if unchanged.Revision != 1 || unchanged.Summary().KnownVolumeKG != "602.500" {
		t.Fatal("invalid partial write")
	}
}
func TestDeleteTombstoneRejectsRecreationAndOtherOwner(t *testing.T) {
	db, repo, a, b := setup(t)
	ctx := context.Background()
	w := sample(a)
	if _, err := repo.Save(ctx, a, w, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Delete(ctx, b, w.ID, 1); !errors.Is(err, entity.ErrNotFound) {
		t.Fatal(err)
	}
	revision, err := repo.Delete(ctx, a, w.ID, 1)
	if err != nil || revision != 2 {
		t.Fatal(revision, err)
	}
	if _, err := repo.Save(ctx, a, w, 0); !errors.Is(err, entity.ErrDeleted) {
		t.Fatal(err)
	}
	if _, err := repo.Find(ctx, a, w.ID); !errors.Is(err, entity.ErrDeleted) {
		t.Fatal(err)
	}
	var count int64
	db.Raw(`SELECT count(*) FROM public.workout_exercises WHERE workout_id=?`, w.ID).Scan(&count)
	if count != 0 {
		t.Fatal("deleted contents remain")
	}
}

func TestReadUsesOneConsistentAggregateSnapshot(t *testing.T) {
	db, repo, a, _ := setup(t)
	ctx := context.Background()
	w := sample(a)
	if _, err := repo.Save(ctx, a, w, 0); err != nil {
		t.Fatal(err)
	}
	var fired atomic.Bool
	err := db.Callback().Query().After("gorm:query").Register("test_concurrent_edit", func(query *gorm.DB) {
		if query.Statement.Schema == nil || query.Statement.Schema.Table != "public.workouts" || !fired.CompareAndSwap(false, true) {
			return
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(`UPDATE public.workouts SET revision=2 WHERE id=?`, w.ID).Error; err != nil {
				return err
			}
			return tx.Exec(`UPDATE public.workout_sets SET reps=20 WHERE id=?`, w.Exercises[0].Sets[0].ID).Error
		}); err != nil {
			t.Error(err)
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Callback().Query().Remove("test_concurrent_edit") })
	read, err := repo.Find(ctx, a, w.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !fired.Load() {
		t.Fatal("concurrent edit was not exercised")
	}
	if read.Revision != 1 || read.Exercises[0].Sets[0].Reps != 10 {
		t.Fatalf("mixed revisions in read: revision=%d reps=%d", read.Revision, read.Exercises[0].Sets[0].Reps)
	}
}

func TestWorkoutAndActivityAreAtomic(t *testing.T) {
	db, repo, a, _ := setup(t)
	ctx := context.Background()
	w := sample(a)
	if _, err := repo.Save(ctx, a, w, 0); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Raw(`SELECT count(*) FROM log.workout_events WHERE actor_id=? AND workout_id=? AND event_type='workout.created'`, a, w.ID).Scan(&count).Error; err != nil || count != 1 {
		t.Fatalf("missing activity: %d %v", count, err)
	}
	if err := db.Exec(`ALTER TABLE log.workout_events ADD CONSTRAINT test_reject_activity CHECK(event_type='workout.created')`).Error; err != nil {
		t.Fatal(err)
	}
	changed, _ := repo.Find(ctx, a, w.ID)
	changed.Exercises[0].Sets[0].Reps = 25
	if _, err := repo.Save(ctx, a, changed, 1); err == nil {
		t.Fatal("write succeeded despite failed activity")
	}
	original, err := repo.Find(ctx, a, w.ID)
	if err != nil || original.Revision != 1 || original.Exercises[0].Sets[0].Reps != 10 {
		t.Fatalf("business state changed after activity failure: %+v %v", original, err)
	}
}
