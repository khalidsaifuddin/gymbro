package usecase

import (
	"context"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
)

type History struct{ Workouts repository.Workouts }

func (h History) List(ctx context.Context, owner string) ([]entity.Workout, error) {
	if !entity.ValidID(owner) {
		return nil, ErrUnauthorized
	}
	return h.Workouts.List(ctx, owner)
}
func (h History) Find(ctx context.Context, owner, id string) (entity.Workout, error) {
	if !entity.ValidID(owner) {
		return entity.Workout{}, ErrUnauthorized
	}
	if !entity.ValidID(id) {
		return entity.Workout{}, entity.ErrInvalid
	}
	return h.Workouts.Find(ctx, owner, id)
}
