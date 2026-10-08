//go:build integration

package authrepo

import (
	"context"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	"testing"
	"time"
)

func TestHashOnlySessionExpiryLogoutAndAccountDeletion(t *testing.T) {
	db := testdb.New(t)
	if err := migration.Up(db); err != nil {
		t.Fatal(err)
	}
	r := New(db)
	ctx := context.Background()
	token, csrf := usecase.RandomToken(), usecase.RandomToken()
	identity := repository.Identity{Subject: "signed-fixture", Name: "Fixture"}
	u, err := r.Issue(ctx, identity, usecase.HashToken(token), usecase.HashToken(csrf), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	s, err := r.Lookup(ctx, usecase.HashToken(token))
	if err != nil || s.User.ID != u.ID || len(s.CSRFHash) != 32 {
		t.Fatal("lookup", err)
	}
	var n int64
	db.Raw("SELECT count(*) FROM public.auth_sessions WHERE token_hash=? AND csrf_hash=?", usecase.HashToken(token), usecase.HashToken(csrf)).Scan(&n)
	if n != 1 {
		t.Fatal("hash persistence")
	}
	expired := usecase.RandomToken()
	if _, err = r.Issue(ctx, identity, usecase.HashToken(expired), usecase.HashToken(csrf), time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err = r.Lookup(ctx, usecase.HashToken(expired)); err == nil {
		t.Fatal("expired session accepted")
	}
	if err = r.Revoke(ctx, usecase.HashToken(token)); err != nil {
		t.Fatal(err)
	}
	if _, err = r.Lookup(ctx, usecase.HashToken(token)); err == nil {
		t.Fatal("logout token valid")
	}
	token = usecase.RandomToken()
	u2, err := r.Issue(ctx, identity, usecase.HashToken(token), usecase.HashToken(csrf), time.Now().Add(time.Hour))
	if err != nil || u2.ID != u.ID {
		t.Fatal("identity duplicate", err)
	}
	wid := uuid.NewString()
	if err = db.Exec("INSERT INTO public.workouts(id,user_id,started_at,status) VALUES(?,?,now(),'active')", wid, u.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err = db.Exec("INSERT INTO log.sync_events(id,event_type,actor_id,workout_id,metadata) VALUES(?,'sync.applied',?,?,'{}')", uuid.NewString(), u.ID, wid).Error; err != nil {
		t.Fatal(err)
	}
	if err = r.DeleteAccount(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"ref.users", "public.workouts", "public.auth_sessions"} {
		db.Table(table).Count(&n)
		if n != 0 {
			t.Fatal("retained data", table)
		}
	}
	for _, table := range []string{"log.workout_events", "log.auth_events", "log.sync_events"} {
		db.Table(table).Where("actor_id=? OR workout_id=?", u.ID, wid).Count(&n)
		if n != 0 {
			t.Fatal("retained identifiers", table)
		}
	}
	if _, err = r.Lookup(ctx, usecase.HashToken(token)); err == nil {
		t.Fatal("deleted account session valid")
	}
	recreated, err := r.Issue(ctx, identity, usecase.HashToken(usecase.RandomToken()), usecase.HashToken(csrf), time.Now().Add(time.Hour))
	if err != nil || recreated.ID == u.ID {
		t.Fatal("old account identity reused", err)
	}
}
