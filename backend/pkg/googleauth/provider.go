package googleauth

import (
	"context"
	"crypto/subtle"
	"errors"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"golang.org/x/oauth2"
	"net/http"
	"time"
)

type Provider struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
	client   *http.Client
}

// The application passes only https://accounts.google.com. Tests pass an isolated signed fixture issuer.
func New(ctx context.Context, issuer, clientID, secret, redirect string) (*Provider, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	ctx = oidc.ClientContext(ctx, client)
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, errors.New("OIDC discovery failed")
	}
	endpoint := provider.Endpoint()
	endpoint.AuthStyle = oauth2.AuthStyleInParams
	return &Provider{client: client, config: oauth2.Config{ClientID: clientID, ClientSecret: secret, RedirectURL: redirect, Endpoint: endpoint, Scopes: []string{oidc.ScopeOpenID, "profile"}}, verifier: provider.Verifier(&oidc.Config{ClientID: clientID})}, nil
}
func (p *Provider) Authorize(state, nonce, verifier string) string {
	return p.config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
}
func (p *Provider) Exchange(ctx context.Context, code, nonce, verifier string) (repository.Identity, error) {
	fail := errors.New("Google identity verification failed")
	ctx = oidc.ClientContext(ctx, p.client)
	token, err := p.config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return repository.Identity{}, fail
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return repository.Identity{}, fail
	}
	identity, err := p.verifier.Verify(ctx, raw)
	if err != nil || identity.Subject == "" || subtle.ConstantTimeCompare([]byte(identity.Nonce), []byte(nonce)) != 1 {
		return repository.Identity{}, fail
	}
	var claims struct {
		Name string `json:"name"`
	}
	if err = identity.Claims(&claims); err != nil {
		return repository.Identity{}, fail
	}
	if len(identity.Subject) > 255 || len([]rune(claims.Name)) > 200 {
		return repository.Identity{}, fail
	}
	return repository.Identity{Subject: identity.Subject, Name: claims.Name}, nil
}
