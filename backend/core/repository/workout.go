package repository

import (
	"context"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
)

type Workouts interface {
	Save(ctx context.Context, owner string, value entity.Workout, baseRevision int64) (entity.Workout, error)
	Find(ctx context.Context, owner, id string) (entity.Workout, error)
	List(ctx context.Context, owner string) ([]entity.Workout, error)
	Delete(ctx context.Context, owner, id string, baseRevision int64) (int64, error)
}
