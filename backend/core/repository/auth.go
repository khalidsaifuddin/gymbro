package repository

import (
	"context"
	"time"
)

type Identity struct {
	Subject string
	Name    string
}
type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type Session struct {
	User      User
	CSRFHash  []byte
	ExpiresAt time.Time
}
type Sessions interface {
	Issue(context.Context, Identity, []byte, []byte, time.Time) (User, error)
	Lookup(context.Context, []byte) (Session, error)
	Revoke(context.Context, []byte) error
	DeleteAccount(context.Context, string) error
}
type IdentityProvider interface {
	Authorize(state, nonce, verifier string) string
	Exchange(context.Context, string, string, string) (Identity, error)
}
