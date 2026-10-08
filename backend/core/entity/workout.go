package entity

import (
	"errors"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrInvalid = errors.New("invalid workout")
var ErrNotFound = errors.New("workout not found")
var ErrConflict = errors.New("workout revision conflict")
var ErrDeleted = errors.New("workout deleted")

type Workout struct {
	ID               string            `json:"id"`
	OwnerID          string            `json:"-"`
	Revision         int64             `json:"revision"`
	StartedAt        time.Time         `json:"started_at"`
	FinishedAt       *time.Time        `json:"finished_at"`
	DurationMS       int64             `json:"duration_ms"`
	PausedDurationMS int64             `json:"paused_duration_ms"`
	RestDurationMS   int64             `json:"rest_duration_ms"`
	Status           string            `json:"status"`
	Exercises        []WorkoutExercise `json:"exercises"`
}
type WorkoutExercise struct {
	ID                string       `json:"id"`
	ExerciseID        string       `json:"exercise_id"`
	Equipment         string       `json:"-"`
	Position          int          `json:"position"`
	Notes             string       `json:"notes"`
	RestTargetSeconds int          `json:"rest_target_seconds"`
	Sets              []WorkoutSet `json:"sets"`
}
type SetSource struct {
	ID             string      `json:"id"`
	Reps           int64       `json:"reps"`
	DetectedReps   int64       `json:"detected_reps"`
	LoadKG         *string     `json:"load_kg"`
	ImplementCount int         `json:"implement_count"`
	SourceIDs      []string    `json:"source_ids"`
	MergedFrom     []SetSource `json:"merged_from"`
	LoadEdited     bool        `json:"load_edited"`
}
type WorkoutSet struct {
	SetSource
	Position           int        `json:"position"`
	RepSource          string     `json:"rep_source"`
	DetectedExerciseID *string    `json:"detected_exercise_id"`
	RecognitionStatus  string     `json:"recognition_status"`
	StartedAt          time.Time  `json:"started_at"`
	EndedAt            *time.Time `json:"ended_at"`
	LastRepAt          time.Time  `json:"last_rep_at"`
	RestDurationMS     int64      `json:"rest_duration_ms"`
}

func ValidID(id string) bool {
	v, err := uuid.Parse(id)
	return err == nil && v != uuid.Nil && v.String() == id
}

var decimal = regexp.MustCompile(`^[0-9]{1,5}(\.[0-9]{1,3})?$`)

func LoadMilliKG(kg string) (int64, error) {
	if !decimal.MatchString(kg) {
		return 0, ErrInvalid
	}
	parts := strings.SplitN(kg, ".", 2)
	whole, _ := strconv.ParseInt(parts[0], 10, 64)
	fraction := int64(0)
	if len(parts) == 2 {
		fraction, _ = strconv.ParseInt(parts[1]+strings.Repeat("0", 3-len(parts[1])), 10, 64)
	}
	return whole*1000 + fraction, nil
}
func (w Workout) Validate() error {
	if !ValidID(w.ID) || !ValidID(w.OwnerID) || w.StartedAt.IsZero() || w.DurationMS < 0 || w.PausedDurationMS < 0 || w.RestDurationMS < 0 || (w.Status != "active" && w.Status != "paused" && w.Status != "completed") || (w.FinishedAt != nil && w.FinishedAt.Before(w.StartedAt)) || (w.Status == "completed" && w.FinishedAt == nil) {
		return ErrInvalid
	}
	ids := map[string]bool{w.ID: true}
	positions := map[int]bool{}
	for _, e := range w.Exercises {
		if !ValidID(e.ID) || !ValidID(e.ExerciseID) || ids[e.ID] || e.Position < 0 || positions[e.Position] || len([]rune(e.Notes)) > 2048 || e.RestTargetSeconds < 0 || e.RestTargetSeconds > 3600 {
			return ErrInvalid
		}
		ids[e.ID] = true
		positions[e.Position] = true
		setPositions := map[int]bool{}
		for _, s := range e.Sets {
			if err := validateSource(s.SetSource, 0); err != nil {
				return err
			}
			if ids[s.ID] || s.Position < 0 || setPositions[s.Position] || s.StartedAt.IsZero() || s.StartedAt.Before(w.StartedAt) || s.LastRepAt.Before(s.StartedAt) || (s.EndedAt != nil && s.EndedAt.Before(s.LastRepAt)) || (w.FinishedAt != nil && (s.EndedAt == nil || s.EndedAt.After(*w.FinishedAt))) || s.RestDurationMS < 0 {
				return ErrInvalid
			}
			if s.RepSource != "automatic" && s.RepSource != "manual" && s.RepSource != "mixed" {
				return ErrInvalid
			}
			if s.RecognitionStatus != "known" && s.RecognitionStatus != "unknown" && s.RecognitionStatus != "manual" {
				return ErrInvalid
			}
			if s.DetectedExerciseID != nil && !ValidID(*s.DetectedExerciseID) {
				return ErrInvalid
			}
			ids[s.ID] = true
			setPositions[s.Position] = true
		}
	}
	return nil
}
func validateSource(s SetSource, depth int) error {
	if depth > 20 || !ValidID(s.ID) || s.Reps < 0 || s.Reps > 2147483647 || s.DetectedReps < 0 || s.DetectedReps > 2147483647 || s.ImplementCount < 1 || s.ImplementCount > 32767 || len(s.SourceIDs) == 0 {
		return ErrInvalid
	}
	if s.LoadKG != nil {
		if _, err := LoadMilliKG(*s.LoadKG); err != nil {
			return err
		}
	}
	seen := map[string]bool{}
	for _, id := range s.SourceIDs {
		if !ValidID(id) || seen[id] {
			return ErrInvalid
		}
		seen[id] = true
	}
	for _, source := range s.MergedFrom {
		if err := validateSource(source, depth+1); err != nil {
			return err
		}
	}
	return nil
}

type WorkoutSummary struct {
	TotalSets      int    `json:"total_sets"`
	TotalReps      int64  `json:"total_reps"`
	KnownVolumeKG  string `json:"known_volume_kg"`
	VolumeComplete bool   `json:"volume_complete"`
}

func (w Workout) Summary() WorkoutSummary {
	summary := WorkoutSummary{VolumeComplete: true}
	volume := new(big.Int)
	for _, e := range w.Exercises {
		for _, s := range e.Sets {
			if s.Reps > 0 {
				summary.TotalSets++
			}
			summary.TotalReps += s.Reps
			kg, complete := sourceVolume(s.SetSource)
			volume.Add(volume, kg)
			summary.VolumeComplete = summary.VolumeComplete && (complete || s.Reps == 0 || e.Equipment == "bodyweight")
		}
	}
	whole, fraction := new(big.Int), new(big.Int)
	whole.QuoRem(volume, big.NewInt(1000), fraction)
	summary.KnownVolumeKG = whole.String() + "." + strings.Repeat("0", 3-len(fraction.String())) + fraction.String()
	return summary
}
func sourceVolume(s SetSource) (*big.Int, bool) {
	if s.LoadKG != nil {
		load, err := LoadMilliKG(*s.LoadKG)
		if err != nil {
			return new(big.Int), false
		}
		v := big.NewInt(load)
		v.Mul(v, big.NewInt(int64(s.ImplementCount)))
		v.Mul(v, big.NewInt(s.Reps))
		return v, true
	}
	reps := int64(0)
	for _, x := range s.MergedFrom {
		reps += x.Reps
	}
	if !s.LoadEdited && len(s.MergedFrom) > 0 && s.Reps == reps {
		v := new(big.Int)
		complete := true
		for _, x := range s.MergedFrom {
			part, c := sourceVolume(x)
			v.Add(v, part)
			complete = complete && c
		}
		return v, complete
	}
	return new(big.Int), s.Reps == 0
}
