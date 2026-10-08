package authrepo

import (
	"context"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/activity"
	"gorm.io/gorm"
	"time"
)

type Repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Repository { return &Repository{db} }
func (r *Repository) Issue(ctx context.Context, identity repository.Identity, token, csrf []byte, expiry time.Time) (repository.User, error) {
	var u repository.User
	if identity.Subject == "" || len(identity.Subject) > 255 || len([]rune(identity.Name)) > 200 || len(token) != 32 || len(csrf) != 32 {
		return u, usecase.ErrUnauthorized
	}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row struct{ ID, DisplayName string }
		q := tx.Raw(`INSERT INTO ref.users(id,google_sub,display_name) VALUES(?,?,?) ON CONFLICT(google_sub) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now() RETURNING id,display_name`, uuid.NewString(), identity.Subject, identity.Name).Scan(&row)
		if q.Error != nil {
			return q.Error
		}
		u = repository.User{ID: row.ID, Name: row.DisplayName}
		if err := tx.Exec(`INSERT INTO public.auth_sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES(?,?,?,?,?)`, uuid.NewString(), u.ID, token, csrf, expiry).Error; err != nil {
			return err
		}
		return activity.Record(tx, "auth", activity.Event{Type: "auth.login", ActorID: &u.ID, Metadata: map[string]any{"outcome": "success"}})
	})
	return u, err
}
func (r *Repository) Lookup(ctx context.Context, token []byte) (repository.Session, error) {
	var row struct {
		ID, DisplayName string
		CSRFHash        []byte
		ExpiresAt       time.Time
	}
	q := r.db.WithContext(ctx).Raw(`SELECT u.id,u.display_name,s.csrf_hash,s.expires_at FROM public.auth_sessions s JOIN ref.users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>clock_timestamp()`, token).Scan(&row)
	if q.Error != nil {
		return repository.Session{}, q.Error
	}
	if row.ID == "" {
		return repository.Session{}, usecase.ErrUnauthorized
	}
	return repository.Session{User: repository.User{ID: row.ID, Name: row.DisplayName}, CSRFHash: row.CSRFHash, ExpiresAt: row.ExpiresAt}, nil
}
func (r *Repository) Revoke(ctx context.Context, token []byte) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var owner string
		if err := tx.Raw(`DELETE FROM public.auth_sessions WHERE token_hash=? RETURNING user_id`, token).Scan(&owner).Error; err != nil {
			return err
		}
		if owner == "" {
			return nil
		}
		return activity.Record(tx, "auth", activity.Event{Type: "auth.logout", ActorID: &owner, Metadata: map[string]any{"outcome": "success"}})
	})
}
func (r *Repository) DeleteAccount(ctx context.Context, owner string) error {
	if !entity.ValidID(owner) {
		return usecase.ErrUnauthorized
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var id string
		if err := tx.Raw(`SELECT id FROM ref.users WHERE id=? FOR UPDATE`, owner).Scan(&id).Error; err != nil {
			return err
		}
		if id == "" {
			return usecase.ErrUnauthorized
		}
		// Fixed table order matches partition maintenance; remove all rows that identify this account.
		for _, table := range []string{"workout_events", "auth_events", "sync_events"} {
			if err := tx.Exec(`DELETE FROM log.`+table+` WHERE actor_id=? OR workout_id IN(SELECT id FROM public.workouts WHERE user_id=?)`, owner, owner).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec(`DELETE FROM ref.users WHERE id=?`, owner).Error; err != nil {
			return err
		}
		return activity.Record(tx, "auth", activity.Event{Type: "auth.account-deleted", Metadata: map[string]any{"outcome": "success"}})
	})
}
