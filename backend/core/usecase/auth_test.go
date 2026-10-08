package usecase

import (
	"context"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"net/url"
	"testing"
	"time"
)

type fixtureProvider struct {
	state, nonce, verifier string
	calls                  int
}

func (p *fixtureProvider) Authorize(s, n, v string) string {
	p.state = s
	p.nonce = n
	p.verifier = v
	return "https://fixture.example/authorize?state=" + url.QueryEscape(s)
}
func (p *fixtureProvider) Exchange(_ context.Context, code, nonce, verifier string) (repository.Identity, error) {
	p.calls++
	if code != "valid" || nonce != p.nonce || verifier != p.verifier {
		return repository.Identity{}, ErrUnauthorized
	}
	return repository.Identity{Subject: "fixture-subject", Name: "Fixture"}, nil
}

type memorySessions struct {
	token, csrf []byte
	issued      int
}

func (s *memorySessions) Issue(_ context.Context, _ repository.Identity, t, c []byte, _ time.Time) (repository.User, error) {
	s.token = t
	s.csrf = c
	s.issued++
	return repository.User{ID: "00000000-0000-4000-8000-000000000011", Name: "Fixture"}, nil
}
func (s *memorySessions) Lookup(context.Context, []byte) (repository.Session, error) {
	return repository.Session{}, ErrUnauthorized
}
func (s *memorySessions) Revoke(context.Context, []byte) error        { return nil }
func (s *memorySessions) DeleteAccount(context.Context, string) error { return nil }
func TestOAuthBrowserBindingOneTimeAndHashOnlyCredentials(t *testing.T) {
	p := &fixtureProvider{}
	s := &memorySessions{}
	a := NewAuth(p, s)
	login, err := a.Start()
	if err != nil || login.URL == "" || login.Binding == "" {
		t.Fatalf("start: %+v %v", login, err)
	}
	if _, err = a.Callback(context.Background(), p.state, "other-browser", "valid"); err == nil || p.calls != 0 {
		t.Fatal("binding bypass")
	}
	// A mismatch consumes the flow; a replay must not exchange a code.
	if _, err = a.Callback(context.Background(), p.state, login.Binding, "valid"); err == nil {
		t.Fatal("replay accepted")
	}
	login, err = a.Start()
	if err != nil {
		t.Fatal(err)
	}
	c, err := a.Callback(context.Background(), p.state, login.Binding, "valid")
	if err != nil || c.Token == "" || c.CSRF == "" || s.issued != 1 {
		t.Fatalf("callback: %v", err)
	}
	if string(s.token) == c.Token || string(s.csrf) == c.CSRF || len(s.token) != 32 || len(s.csrf) != 32 {
		t.Fatal("plaintext stored")
	}
	if _, err = a.Callback(context.Background(), p.state, login.Binding, "valid"); err == nil || s.issued != 1 {
		t.Fatal("flow replay")
	}
	if len(p.verifier) < 43 || len(p.nonce) < 32 || len(p.state) < 32 {
		t.Fatal("weak flow")
	}
}
func TestProviderFailureIssuesNoSession(t *testing.T) {
	p := &fixtureProvider{}
	s := &memorySessions{}
	a := NewAuth(p, s)
	l, err := a.Start()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = a.Callback(context.Background(), p.state, l.Binding, "invalid"); err == nil || s.issued != 0 {
		t.Fatal("invalid provider identity issued session")
	}
}
func TestFlowExpiry(t *testing.T) {
	p := &fixtureProvider{}
	s := &memorySessions{}
	a := NewAuth(p, s)
	now := time.Now()
	a.now = func() time.Time { return now }
	l, err := a.Start()
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(6 * time.Minute)
	if _, err = a.Callback(context.Background(), p.state, l.Binding, "valid"); err == nil || p.calls != 0 {
		t.Fatal("expired flow exchanged")
	}
}
