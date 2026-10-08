package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"time"
)

var ErrUnauthorized = errors.New("unauthorized")
var ErrMutationReused = errors.New("mutation reused")

type Mutation struct {
	AccountID    string          `json:"account_id"`
	MutationID   string          `json:"mutation_id"`
	WorkoutID    string          `json:"workout_id"`
	BaseRevision int64           `json:"base_revision"`
	Operation    string          `json:"operation"`
	OccurredAt   time.Time       `json:"occurred_at"`
	Workout      *entity.Workout `json:"workout,omitempty"`
}
type Outcome struct {
	MutationID string                 `json:"mutation_id"`
	WorkoutID  string                 `json:"workout_id"`
	Revision   int64                  `json:"revision"`
	Deleted    bool                   `json:"deleted"`
	Workout    *entity.Workout        `json:"workout,omitempty"`
	Summary    *entity.WorkoutSummary `json:"summary,omitempty"`
}
type SyncPort interface {
	Apply(context.Context, string, Mutation, [32]byte) (Outcome, error)
}
type Sync struct{ Port SyncPort }

func (s Sync) Apply(ctx context.Context, owner string, m Mutation) (Outcome, error) {
	if !entity.ValidID(owner) || m.AccountID != owner {
		return Outcome{}, ErrUnauthorized
	}
	if !entity.ValidID(m.MutationID) || !entity.ValidID(m.WorkoutID) || m.BaseRevision < 0 || m.OccurredAt.IsZero() || m.OccurredAt.After(time.Now().Add(5*time.Minute)) {
		return Outcome{}, entity.ErrInvalid
	}
	switch m.Operation {
	case "upsert":
		if m.Workout == nil || m.Workout.ID != m.WorkoutID {
			return Outcome{}, entity.ErrInvalid
		}
		workout := *m.Workout
		workout.OwnerID = owner
		m.Workout = &workout
		if err := m.Workout.Validate(); err != nil {
			return Outcome{}, err
		}
	case "delete":
		if m.Workout != nil || m.BaseRevision < 1 {
			return Outcome{}, entity.ErrInvalid
		}
	default:
		return Outcome{}, entity.ErrInvalid
	}
	data, err := json.Marshal(m)
	if err != nil {
		return Outcome{}, entity.ErrInvalid
	}
	return s.Port.Apply(ctx, owner, m, sha256.Sum256(data))
}
