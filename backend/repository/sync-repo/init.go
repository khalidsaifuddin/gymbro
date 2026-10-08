package syncrepo

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/activity"
	workoutrepo "github.com/khalidsaifuddin/gymbro/backend/repository/workout-repo"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Repository { return &Repository{db: db} }
func (r *Repository) Apply(ctx context.Context, owner string, m usecase.Mutation, hash [32]byte) (usecase.Outcome, error) {
	var out usecase.Outcome
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var id string
		if err := tx.Raw("SELECT id FROM ref.users WHERE id=? FOR KEY SHARE", owner).Scan(&id).Error; err != nil {
			return err
		}
		if id == "" {
			return usecase.ErrUnauthorized
		}
		lock := sha256.Sum256([]byte(owner + ":" + m.MutationID))
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", int64(binary.BigEndian.Uint64(lock[:8]))).Error; err != nil {
			return err
		}
		var old struct {
			RequestHash []byte
			Outcome     []byte
		}
		q := tx.Table("public.sync_mutations").Where("user_id=? AND mutation_id=?", owner, m.MutationID).Take(&old)
		if q.Error == nil {
			if !bytes.Equal(old.RequestHash, hash[:]) {
				return usecase.ErrMutationReused
			}
			return json.Unmarshal(old.Outcome, &out)
		}
		if !errors.Is(q.Error, gorm.ErrRecordNotFound) {
			return q.Error
		}
		context := entity.WithMutation(ctx, m.MutationID, m.OccurredAt)
		repo := workoutrepo.New(tx)
		out = usecase.Outcome{MutationID: m.MutationID, WorkoutID: m.WorkoutID}
		if m.Operation == "upsert" {
			w, err := repo.Save(context, owner, *m.Workout, m.BaseRevision)
			if err != nil {
				return err
			}
			out.Revision = w.Revision
			out.Workout = &w
			summary := w.Summary()
			out.Summary = &summary
		} else {
			revision, err := repo.Delete(context, owner, m.WorkoutID, m.BaseRevision)
			if err != nil {
				return err
			}
			out.Revision = revision
			out.Deleted = true
		}
		data, err := json.Marshal(out)
		if err != nil {
			return err
		}
		if err := tx.Exec("INSERT INTO public.sync_mutations(user_id,mutation_id,request_hash,workout_id,resulting_revision,outcome) VALUES(?,?,?,?,?,?::jsonb)", owner, m.MutationID, hash[:], m.WorkoutID, out.Revision, string(data)).Error; err != nil {
			return err
		}
		op := "update"
		if m.Operation == "delete" {
			op = "delete"
		} else if m.BaseRevision == 0 {
			op = "create"
		}
		return activity.Record(tx, "sync", activity.Event{Type: "sync.applied", ActorID: &owner, WorkoutID: &m.WorkoutID, CorrelationID: &m.MutationID, OccurredAt: &m.OccurredAt, Metadata: map[string]any{"revision": out.Revision, "operation": op, "outcome": "applied"}})
	})
	var pg *pgconn.PgError
	if errors.As(err, &pg) && (pg.Code == "23505" || pg.Code == "23503" || pg.Code == "23514") {
		err = entity.ErrInvalid
	}
	return out, err
}
