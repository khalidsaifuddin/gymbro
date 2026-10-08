package entity

import (
	"context"
	"time"
)

type mutationKey struct{}
type MutationContext struct {
	ID         string
	OccurredAt time.Time
}

func WithMutation(ctx context.Context, id string, at time.Time) context.Context {
	return context.WithValue(ctx, mutationKey{}, MutationContext{ID: id, OccurredAt: at})
}
func MutationFrom(ctx context.Context) (MutationContext, bool) {
	m, ok := ctx.Value(mutationKey{}).(MutationContext)
	return m, ok
}
