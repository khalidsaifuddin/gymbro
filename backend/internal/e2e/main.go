//go:build integration

// Isolated cryptographically signed OIDC + PostgreSQL fixture. Never built into Gymbro's production server.
package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	jose "github.com/go-jose/go-jose/v4"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/handler/api"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/googleauth"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	authrepo "github.com/khalidsaifuddin/gymbro/backend/repository/auth-repo"
	catalogrepo "github.com/khalidsaifuddin/gymbro/backend/repository/catalog-repo"
	syncrepo "github.com/khalidsaifuddin/gymbro/backend/repository/sync-repo"
	workoutrepo "github.com/khalidsaifuddin/gymbro/backend/repository/workout-repo"
	"golang.org/x/oauth2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

func main() {
	raw := os.Getenv("GYMBRO_TEST_DATABASE_URL")
	u, err := url.Parse(raw)
	if err != nil || u == nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Hostname() != "127.0.0.1" || u.Path != "/gymbro_test" {
		log.Fatal("E2E requires disposable gymbro_test on 127.0.0.1")
	}
	open := func(raw string) *gorm.DB {
		db, err := gorm.Open(postgres.Open(raw), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
		if err != nil {
			log.Fatal("fixture database unavailable")
		}
		return db
	}
	admin := open(raw)
	name := "gymbro_test_e2e_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err = admin.Exec(`CREATE DATABASE "` + name + `"`).Error; err != nil {
		log.Fatal("fixture database creation failed")
	}
	u.Path = "/" + name
	db := open(u.String())
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
		admin.Exec(`DROP DATABASE "` + name + `" WITH (FORCE)`)
		sqlAdmin, _ := admin.DB()
		sqlAdmin.Close()
	}()
	if err = migration.Up(db); err != nil {
		log.Fatal("fixture migration failed")
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal("fixture signing key unavailable")
	}
	issuer, origin := "http://127.0.0.1:8094", "http://127.0.0.1:8093"
	type flow struct{ nonce, challenge, subject string }
	flows := map[string]flow{}
	var mu sync.Mutex
	oidcServer := &http.Server{Addr: "127.0.0.1:8094", ReadHeaderTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/keys", "id_token_signing_alg_values_supported": []string{"RS256"}})
		case "/keys":
			json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "integration-fixture", Algorithm: "RS256", Use: "sig"}}})
		case "/authorize":
			if r.URL.Query().Get("redirect_uri") != origin+"/api/v1/auth/google/callback" || r.URL.Query().Get("client_id") != "fixture-client" || r.URL.Query().Get("code_challenge_method") != "S256" {
				w.WriteHeader(400)
				return
			}
			subject := "fixture-account-A"
			if cookie, err := r.Cookie("fixture_subject"); err == nil {
				subject = cookie.Value
			}
			code := uuid.NewString()
			mu.Lock()
			flows[code] = flow{nonce: r.URL.Query().Get("nonce"), challenge: r.URL.Query().Get("code_challenge"), subject: subject}
			mu.Unlock()
			http.Redirect(w, r, origin+"/api/v1/auth/google/callback?"+url.Values{"code": {code}, "state": {r.URL.Query().Get("state")}}.Encode(), 302)
		case "/token":
			r.ParseForm()
			mu.Lock()
			f, ok := flows[r.Form.Get("code")]
			delete(flows, r.Form.Get("code"))
			mu.Unlock()
			if !ok || oauth2.S256ChallengeFromVerifier(r.Form.Get("code_verifier")) != f.challenge || r.Form.Get("client_secret") != "fixture-secret" {
				w.WriteHeader(400)
				fmt.Fprint(w, `{"error":"invalid_grant"}`)
				return
			}
			signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithHeader("kid", "integration-fixture"))
			claims, _ := json.Marshal(map[string]any{"iss": issuer, "aud": "fixture-client", "sub": f.subject, "name": "Fixture athlete", "nonce": f.nonce, "iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix()})
			signed, _ := signer.Sign(claims)
			token, _ := signed.CompactSerialize()
			json.NewEncoder(w).Encode(map[string]any{"access_token": "fixture-unused", "token_type": "Bearer", "id_token": token})
		default:
			w.WriteHeader(404)
		}
	})}
	go func() {
		if err := oidcServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("fixture issuer server failed")
		}
	}()
	var provider *googleauth.Provider
	for i := 0; i < 50; i++ {
		provider, err = googleauth.New(context.Background(), issuer, "fixture-client", "fixture-secret", origin+"/api/v1/auth/google/callback")
		if err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err != nil {
		log.Fatal("fixture discovery failed")
	}
	sessions := authrepo.New(db)
	router := api.New(api.Options{Auth: usecase.NewAuth(provider, sessions), Sessions: sessions, Catalog: catalogrepo.New(db), History: usecase.History{Workouts: workoutrepo.New(db)}, Sync: usecase.Sync{Port: syncrepo.New(db)}, PublicURL: origin, WebDir: "../frontend/dist"})
	server := &http.Server{Addr: "127.0.0.1:8093", Handler: router, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("fixture application server failed")
		}
	}()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(shutdown)
	oidcServer.Shutdown(shutdown)
}
