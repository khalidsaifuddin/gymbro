package main

import (
	"context"
	"github.com/khalidsaifuddin/gymbro/backend/config"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/handler/api"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/googleauth"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	authrepo "github.com/khalidsaifuddin/gymbro/backend/repository/auth-repo"
	catalogrepo "github.com/khalidsaifuddin/gymbro/backend/repository/catalog-repo"
	syncrepo "github.com/khalidsaifuddin/gymbro/backend/repository/sync-repo"
	workoutrepo "github.com/khalidsaifuddin/gymbro/backend/repository/workout-repo"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

func main() {
	addr := os.Getenv("GYMBRO_HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	origin := os.Getenv("GYMBRO_PUBLIC_URL")
	if origin == "" {
		origin = "http://localhost:8080"
	}
	u, err := url.Parse(origin)
	if err != nil || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || u.Host == "" || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"))) {
		log.Fatal("GYMBRO_PUBLIC_URL must be an HTTPS origin, or HTTP loopback for development")
	}
	db, err := config.OpenDatabase()
	if err != nil {
		log.Fatal("database unavailable; check GYMBRO_DATABASE_URL")
	}
	if err = migration.Up(db); err != nil {
		log.Fatal("versioned database migration failed")
	}
	sessions := authrepo.New(db)
	var provider repository.IdentityProvider
	id, secret := os.Getenv("GYMBRO_GOOGLE_CLIENT_ID"), os.Getenv("GYMBRO_GOOGLE_CLIENT_SECRET")
	if (id == "") != (secret == "") {
		log.Fatal("Google OAuth requires both client ID and secret")
	}
	if id != "" {
		p, e := googleauth.New(context.Background(), "https://accounts.google.com", id, secret, origin+"/api/v1/auth/google/callback")
		if e != nil {
			log.Fatal("Google OIDC discovery unavailable")
		}
		provider = p
	}
	web := os.Getenv("GYMBRO_WEB_DIR")
	if web == "" {
		web = "../frontend/dist"
	}
	router := api.New(api.Options{Auth: usecase.NewAuth(provider, sessions), Sessions: sessions, Catalog: catalogrepo.New(db), History: usecase.History{Workouts: workoutrepo.New(db)}, Sync: usecase.Sync{Port: syncrepo.New(db)}, PublicURL: origin, WebDir: web})
	server := http.Server{Addr: addr, Handler: router, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 16384}
	log.Printf("Gymbro listening on %s; Google configured: %t", addr, provider != nil)
	if err = server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("HTTP server stopped")
	}
}
