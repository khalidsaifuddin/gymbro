package entity

import (
	"testing"
	"time"
)

func TestSnapshotRejectsInvalidPauseAndUnprovenRawLabel(t *testing.T) {
	start := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Minute)
	pEnd := start.Add(20 * time.Second)
	base := Workout{ID: "00000000-0000-4000-8000-000000000011", OwnerID: "00000000-0000-4000-8000-000000000012", StartedAt: start, CapturedAt: &end, FinishedAt: &end, Status: "completed", DurationMS: 50000, PausedDurationMS: 10000, PauseIntervals: []PauseInterval{{Start: start.Add(10 * time.Second), End: &pEnd}}}
	if err := base.Validate(); err != nil {
		t.Fatal(err)
	}
	bad := base
	bad.PauseIntervals = []PauseInterval{{Start: end.Add(time.Second), End: &pEnd}}
	if err := bad.Validate(); err == nil {
		t.Fatal("invalid pause accepted")
	}
	bad = base
	bad.DurationMS = 60000
	if err := bad.Validate(); err == nil {
		t.Fatal("fabricated duration accepted")
	}
	raw := "00000000-0000-4000-8000-000000000003"
	sid := "00000000-0000-4000-8000-000000000014"
	bad = base
	bad.Exercises = []WorkoutExercise{{ID: "00000000-0000-4000-8000-000000000013", ExerciseID: raw, RestTargetSeconds: 120, Sets: []WorkoutSet{{SetSource: SetSource{ID: sid, Reps: 10, DetectedReps: 10, ImplementCount: 2, SourceIDs: []string{sid}, LabelSource: "profile", RawExerciseID: &raw}, RepSource: "automatic", RecognitionStatus: "known", DetectedExerciseID: &raw, StartedAt: start, LastRepAt: end, EndedAt: &end}}}}
	if err := bad.Validate(); err == nil {
		t.Fatal("selected profile recorded as automatic label")
	}
}
func TestMergeProvenanceRejectsNonWorkoutData(t *testing.T) {
	id := "00000000-0000-4000-8000-000000000014"
	s := SetSource{ID: id, Reps: 8, ImplementCount: 1, SourceIDs: []string{id}, SourceOrigin: "data:video/private"}
	if err := validateSource(s, 0); err == nil {
		t.Fatal("unbounded non-workout provenance accepted")
	}
}
