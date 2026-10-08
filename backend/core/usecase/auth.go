package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"sync"
	"time"
)

type flow struct {
	binding         [32]byte
	nonce, verifier string
	expiry          time.Time
}
type Auth struct {
	Provider repository.IdentityProvider
	Sessions repository.Sessions
	mu       sync.Mutex
	flows    map[[32]byte]flow
	now      func() time.Time
}
type Login struct {
	URL     string
	Binding string
}
type Credentials struct {
	Token string
	CSRF  string
	User  repository.User
}

func NewAuth(p repository.IdentityProvider, s repository.Sessions) *Auth {
	return &Auth{Provider: p, Sessions: s, flows: map[[32]byte]flow{}, now: time.Now}
}
func RandomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("random source unavailable")
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func (a *Auth) Start() (Login, error) {
	if a.Provider == nil {
		return Login{}, ErrUnauthorized
	}
	state, binding, nonce, verifier := RandomToken(), RandomToken(), RandomToken(), RandomToken()
	now := a.now()
	a.mu.Lock()
	defer a.mu.Unlock()
	for key, f := range a.flows {
		if !f.expiry.After(now) {
			delete(a.flows, key)
		}
	}
	if len(a.flows) >= 2048 {
		return Login{}, ErrUnauthorized
	}
	a.flows[sha256.Sum256([]byte(state))] = flow{binding: sha256.Sum256([]byte(binding)), nonce: nonce, verifier: verifier, expiry: now.Add(5 * time.Minute)}
	return Login{URL: a.Provider.Authorize(state, nonce, verifier), Binding: binding}, nil
}
func (a *Auth) Callback(ctx context.Context, state, binding, code string) (Credentials, error) {
	key := sha256.Sum256([]byte(state))
	a.mu.Lock()
	f, ok := a.flows[key]
	delete(a.flows, key)
	a.mu.Unlock()
	h := sha256.Sum256([]byte(binding))
	if !ok || !f.expiry.After(a.now()) || subtle.ConstantTimeCompare(h[:], f.binding[:]) != 1 || code == "" || a.Provider == nil {
		return Credentials{}, ErrUnauthorized
	}
	identity, err := a.Provider.Exchange(ctx, code, f.nonce, f.verifier)
	if err != nil || identity.Subject == "" || len(identity.Subject) > 255 || len([]rune(identity.Name)) > 200 {
		return Credentials{}, ErrUnauthorized
	}
	token, csrf := RandomToken(), RandomToken()
	user, err := a.Sessions.Issue(ctx, identity, HashToken(token), HashToken(csrf), a.now().Add(30*24*time.Hour))
	if err != nil {
		return Credentials{}, err
	}
	return Credentials{Token: token, CSRF: csrf, User: user}, nil
}
func HashToken(value string) []byte { h := sha256.Sum256([]byte(value)); return h[:] }
func (a *Auth) Current(ctx context.Context, token string) (repository.Session, error) {
	if len(token) != 43 {
		return repository.Session{}, ErrUnauthorized
	}
	s, err := a.Sessions.Lookup(ctx, HashToken(token))
	if err != nil || !s.ExpiresAt.After(a.now()) {
		return repository.Session{}, ErrUnauthorized
	}
	return s, nil
}
