package workoutrepo

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
)

type workoutModel struct {
	ID               string `gorm:"primaryKey"`
	UserID           string
	Revision         int64
	StartedAt        time.Time
	FinishedAt       *time.Time
	DurationMS       int64 `gorm:"column:duration_ms"`
	PausedDurationMS int64 `gorm:"column:paused_duration_ms"`
	RestDurationMS   int64 `gorm:"column:rest_duration_ms"`
	Status           string
	DeletedAt        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (workoutModel) TableName() string { return "public.workouts" }

type exerciseModel struct {
	ID                string `gorm:"primaryKey"`
	WorkoutID         string
	ExerciseID        string
	Equipment         string `gorm:"->"`
	Position          int
	Notes             string
	RestTargetSeconds int
}

func (exerciseModel) TableName() string { return "public.workout_exercises" }

type setModel struct {
	ID                 string `gorm:"primaryKey"`
	WorkoutExerciseID  string
	Position           int
	DetectedReps       int64
	Reps               int64
	RepSource          string
	DetectedExerciseID *string
	RecognitionStatus  string
	LoadKG             *string `gorm:"column:load_kg;type:numeric(8,3)"`
	ImplementCount     int
	StartedAt          time.Time
	EndedAt            *time.Time
	LastRepAt          time.Time
	RestDurationMS     int64     `gorm:"column:rest_duration_ms"`
	SourceIDs          uuidArray `gorm:"column:source_ids;type:uuid[]"`
	MergedFrom         []byte    `gorm:"type:jsonb"`
	LoadEdited         bool
}

func (setModel) TableName() string { return "public.workout_sets" }

type uuidArray []string

func (a uuidArray) Value() (driver.Value, error) {
	for _, id := range a {
		if !entity.ValidID(id) {
			return nil, entity.ErrInvalid
		}
	}
	return "{" + strings.Join(a, ",") + "}", nil
}
func (a *uuidArray) Scan(value any) error {
	var text string
	switch v := value.(type) {
	case string:
		text = v
	case []byte:
		text = string(v)
	default:
		return fmt.Errorf("invalid UUID array")
	}
	if text == "{}" {
		*a = []string{}
		return nil
	}
	if !strings.HasPrefix(text, "{") || !strings.HasSuffix(text, "}") {
		return fmt.Errorf("invalid UUID array")
	}
	ids := strings.Split(text[1:len(text)-1], ",")
	for _, id := range ids {
		if !entity.ValidID(id) {
			return entity.ErrInvalid
		}
	}
	*a = ids
	return nil
}
func header(w entity.Workout) workoutModel {
	return workoutModel{ID: w.ID, UserID: w.OwnerID, Revision: w.Revision, StartedAt: w.StartedAt, FinishedAt: w.FinishedAt, DurationMS: w.DurationMS, PausedDurationMS: w.PausedDurationMS, RestDurationMS: w.RestDurationMS, Status: w.Status}
}
func (m workoutModel) domain() entity.Workout {
	return entity.Workout{ID: m.ID, OwnerID: m.UserID, Revision: m.Revision, StartedAt: m.StartedAt, FinishedAt: m.FinishedAt, DurationMS: m.DurationMS, PausedDurationMS: m.PausedDurationMS, RestDurationMS: m.RestDurationMS, Status: m.Status, Exercises: []entity.WorkoutExercise{}}
}
func setRecord(parent string, s entity.WorkoutSet) (setModel, error) {
	sources := s.MergedFrom
	if sources == nil {
		sources = []entity.SetSource{}
	}
	data, err := json.Marshal(sources)
	return setModel{ID: s.ID, WorkoutExerciseID: parent, Position: s.Position, DetectedReps: s.DetectedReps, Reps: s.Reps, RepSource: s.RepSource, DetectedExerciseID: s.DetectedExerciseID, RecognitionStatus: s.RecognitionStatus, LoadKG: s.LoadKG, ImplementCount: s.ImplementCount, StartedAt: s.StartedAt, EndedAt: s.EndedAt, LastRepAt: s.LastRepAt, RestDurationMS: s.RestDurationMS, SourceIDs: uuidArray(s.SourceIDs), MergedFrom: data, LoadEdited: s.LoadEdited}, err
}
func (m setModel) domain() (entity.WorkoutSet, error) {
	s := entity.WorkoutSet{SetSource: entity.SetSource{ID: m.ID, Reps: m.Reps, DetectedReps: m.DetectedReps, LoadKG: m.LoadKG, ImplementCount: m.ImplementCount, SourceIDs: []string(m.SourceIDs), LoadEdited: m.LoadEdited}, Position: m.Position, RepSource: m.RepSource, DetectedExerciseID: m.DetectedExerciseID, RecognitionStatus: m.RecognitionStatus, StartedAt: m.StartedAt, EndedAt: m.EndedAt, LastRepAt: m.LastRepAt, RestDurationMS: m.RestDurationMS}
	err := json.Unmarshal(m.MergedFrom, &s.MergedFrom)
	return s, err
}
