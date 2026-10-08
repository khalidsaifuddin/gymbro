package activity

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"gorm.io/gorm"
)

type Event struct {
	ID            string
	RecordedAt    time.Time
	OccurredAt    *time.Time
	Type          string
	ActorID       *string
	WorkoutID     *string
	CorrelationID *string
	Metadata      map[string]any
}

func Record(db *gorm.DB, kind string, event Event) error {
	table, ok := tables[kind]
	if !ok {
		return fmt.Errorf("invalid activity kind")
	}
	allowed := map[string][]string{"workout": {"workout.created", "workout.updated", "workout.deleted", "workout.finished", "set.corrected"}, "auth": {"auth.login", "auth.logout", "auth.failure", "auth.account-deleted"}, "sync": {"sync.applied", "sync.conflict", "sync.rejected"}}
	if !contains(allowed[kind], event.Type) {
		return fmt.Errorf("invalid activity type")
	}
	if event.ID == "" {
		event.ID = uuid.NewString()
	}
	if !entity.ValidID(event.ID) {
		return entity.ErrInvalid
	}
	for _, id := range []*string{event.ActorID, event.WorkoutID, event.CorrelationID} {
		if id != nil && !entity.ValidID(*id) {
			return entity.ErrInvalid
		}
	}
	for key, value := range event.Metadata {
		switch key {
		case "revision":
			switch n := value.(type) {
			case int:
				if n < 1 {
					return entity.ErrInvalid
				}
			case int64:
				if n < 1 {
					return entity.ErrInvalid
				}
			default:
				return entity.ErrInvalid
			}
		case "set_id":
			id, ok := value.(string)
			if !ok || !entity.ValidID(id) {
				return entity.ErrInvalid
			}
		case "origin", "operation", "outcome", "reason":
			values := map[string][]string{"origin": {"automatic", "manual", "mixed"}, "operation": {"create", "update", "delete", "import"}, "outcome": {"applied", "conflict", "rejected", "success", "failure"}, "reason": {"invalid", "expired", "revision-conflict", "mutation-reused", "deleted", "unauthorized"}}
			text, ok := value.(string)
			if !ok || !contains(values[key], text) {
				return entity.ErrInvalid
			}
		default:
			return fmt.Errorf("unsafe activity metadata key")
		}
	}
	metadata := event.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	body, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	var recorded *time.Time
	if !event.RecordedAt.IsZero() {
		value := event.RecordedAt.UTC()
		recorded = &value
	}
	return db.Exec(`INSERT INTO log.`+table+`(id,recorded_at,occurred_at,event_type,actor_id,workout_id,correlation_id,metadata) VALUES(?,COALESCE(?::timestamptz,clock_timestamp()),?,?,?,?,?,?::jsonb)`, event.ID, recorded, event.OccurredAt, event.Type, event.ActorID, event.WorkoutID, event.CorrelationID, string(body)).Error
}
func contains(values []string, text string) bool {
	for _, value := range values {
		if value == text {
			return true
		}
	}
	return false
}
