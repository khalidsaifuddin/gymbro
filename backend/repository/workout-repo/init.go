package workoutrepo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/activity"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

type Repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Repository { return &Repository{db: db} }
func (r *Repository) Save(ctx context.Context, owner string, w entity.Workout, base int64) (entity.Workout, error) {
	w.OwnerID = owner
	if base < 0 {
		return entity.Workout{}, entity.ErrInvalid
	}
	if err := w.Validate(); err != nil {
		return entity.Workout{}, err
	}
	var result entity.Workout
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing workoutModel
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ?", w.ID, owner).First(&existing)
		if errors.Is(query.Error, gorm.ErrRecordNotFound) {
			if base != 0 {
				return entity.ErrNotFound
			}
			w.Revision = 1
			m := header(w)
			created := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&m)
			if created.Error != nil {
				return created.Error
			}
			if created.RowsAffected == 0 {
				var collision workoutModel
				if err := tx.Where("id = ? AND user_id = ?", w.ID, owner).First(&collision).Error; err != nil {
					return entity.ErrNotFound
				}
				if collision.DeletedAt != nil {
					return entity.ErrDeleted
				}
				return entity.ErrConflict
			}
		} else {
			if query.Error != nil {
				return query.Error
			}
			if existing.DeletedAt != nil {
				return entity.ErrDeleted
			}
			if existing.Revision != base {
				return entity.ErrConflict
			}
			w.Revision = base + 1
			err := tx.Model(&workoutModel{}).Where("id = ? AND user_id = ?", w.ID, owner).Updates(map[string]any{"captured_at": header(w).CapturedAt, "pause_intervals": header(w).PauseIntervals, "started_at": w.StartedAt, "finished_at": w.FinishedAt, "duration_ms": w.DurationMS, "paused_duration_ms": w.PausedDurationMS, "rest_duration_ms": w.RestDurationMS, "status": w.Status, "revision": w.Revision, "updated_at": time.Now().UTC()}).Error
			if err != nil {
				return err
			}
			if err := tx.Where("workout_id = ?", w.ID).Delete(&exerciseModel{}).Error; err != nil {
				return err
			}
		}
		for _, e := range w.Exercises {
			model := exerciseModel{ID: e.ID, WorkoutID: w.ID, ExerciseID: e.ExerciseID, Position: e.Position, Notes: e.Notes, RestTargetSeconds: e.RestTargetSeconds}
			if err := tx.Create(&model).Error; err != nil {
				return err
			}
			for _, s := range e.Sets {
				model, err := setRecord(e.ID, s)
				if err != nil {
					return err
				}
				if err := tx.Create(&model).Error; err != nil {
					return err
				}
			}
		}
		typeName := "workout.updated"
		var occurred *time.Time
		if base == 0 {
			typeName = "workout.created"
			occurred = &w.StartedAt
		}
		var correlation *string
		if mutation, ok := entity.MutationFrom(ctx); ok {
			occurred = &mutation.OccurredAt
			correlation = &mutation.ID
		}
		if err := activity.Record(tx, "workout", activity.Event{CorrelationID: correlation, Type: typeName, ActorID: &owner, WorkoutID: &w.ID, OccurredAt: occurred, Metadata: map[string]any{"revision": w.Revision}}); err != nil {
			return err
		}
		var err error
		result, err = New(tx).find(ctx, owner, w.ID)
		return err
	})
	return result, err
}
func (r *Repository) Find(ctx context.Context, owner, id string) (entity.Workout, error) {
	var result entity.Workout
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = New(tx).find(ctx, owner, id)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}
func (r *Repository) find(ctx context.Context, owner, id string) (entity.Workout, error) {
	var m workoutModel
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, owner).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return entity.Workout{}, entity.ErrNotFound
		}
		return entity.Workout{}, err
	}
	if m.DeletedAt != nil {
		return entity.Workout{}, entity.ErrDeleted
	}
	return r.hydrate(ctx, m)
}
func (r *Repository) hydrate(ctx context.Context, m workoutModel) (entity.Workout, error) {
	w := m.domain()
	if err := json.Unmarshal(m.PauseIntervals, &w.PauseIntervals); err != nil {
		return w, err
	}
	var exercises []exerciseModel
	if err := r.db.WithContext(ctx).Select("public.workout_exercises.*, ref.exercises.equipment").Joins("JOIN ref.exercises ON ref.exercises.id=public.workout_exercises.exercise_id").Where("workout_id = ?", m.ID).Order("position").Find(&exercises).Error; err != nil {
		return w, err
	}
	for _, e := range exercises {
		x := entity.WorkoutExercise{ID: e.ID, ExerciseID: e.ExerciseID, Equipment: e.Equipment, Position: e.Position, Notes: e.Notes, RestTargetSeconds: e.RestTargetSeconds, Sets: []entity.WorkoutSet{}}
		var sets []setModel
		if err := r.db.WithContext(ctx).Where("workout_exercise_id = ?", e.ID).Order("position").Find(&sets).Error; err != nil {
			return w, err
		}
		for _, m := range sets {
			s, err := m.domain()
			if err != nil {
				return w, err
			}
			x.Sets = append(x.Sets, s)
		}
		w.Exercises = append(w.Exercises, x)
	}
	return w, nil
}
func (r *Repository) List(ctx context.Context, owner string) ([]entity.Workout, error) {
	var result []entity.Workout
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = New(tx).list(ctx, owner)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}
func (r *Repository) list(ctx context.Context, owner string) ([]entity.Workout, error) {
	var rows []workoutModel
	if err := r.db.WithContext(ctx).Where("user_id = ? AND deleted_at IS NULL", owner).Order("started_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := []entity.Workout{}
	for _, m := range rows {
		w, err := r.hydrate(ctx, m)
		if err != nil {
			return nil, err
		}
		result = append(result, w)
	}
	return result, nil
}
func (r *Repository) Delete(ctx context.Context, owner, id string, base int64) (int64, error) {
	revision := int64(0)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var m workoutModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ?", id, owner).First(&m).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return entity.ErrNotFound
			}
			return err
		}
		if m.DeletedAt != nil {
			return entity.ErrDeleted
		}
		if m.Revision != base {
			return entity.ErrConflict
		}
		if err := tx.Where("workout_id = ?", id).Delete(&exerciseModel{}).Error; err != nil {
			return err
		}
		revision = base + 1
		now := time.Now().UTC()
		if err := tx.Model(&workoutModel{}).Where("id = ? AND user_id = ?", id, owner).Updates(map[string]any{"pause_intervals": []byte("[]"), "captured_at": now, "status": "deleted", "deleted_at": now, "revision": revision, "started_at": time.Unix(0, 0).UTC(), "finished_at": nil, "duration_ms": 0, "paused_duration_ms": 0, "rest_duration_ms": 0, "created_at": now, "updated_at": now}).Error; err != nil {
			return err
		}
		var occurred *time.Time
		var correlation *string
		if mutation, ok := entity.MutationFrom(ctx); ok {
			occurred = &mutation.OccurredAt
			correlation = &mutation.ID
		}
		return activity.Record(tx, "workout", activity.Event{OccurredAt: occurred, CorrelationID: correlation, Type: "workout.deleted", ActorID: &owner, WorkoutID: &id, Metadata: map[string]any{"revision": revision}})
	})
	return revision, err
}
