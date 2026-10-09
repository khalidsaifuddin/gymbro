package api

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/handler/middleware"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type Options struct {
	Auth      *usecase.Auth
	Sessions  repository.Sessions
	Catalog   repository.Catalog
	History   usecase.History
	Sync      usecase.Sync
	PublicURL string
	APIURL    string
	WebDir    string
}

func New(o Options) *gin.Engine {
	r := middleware.NewRouter()
	apiURL := o.APIURL
	if apiURL == "" {
		apiURL = o.PublicURL
	}
	secure := strings.HasPrefix(apiURL, "https://")
	cookie := func(c *gin.Context, name, value, path string, maxAge int) {
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(name, value, maxAge, path, "", secure, true)
	}
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && origin == o.PublicURL {
			c.Header("Access-Control-Allow-Origin", o.PublicURL)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
			c.Header("Access-Control-Max-Age", "600")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions && c.GetHeader("Access-Control-Request-Method") != "" {
			if origin != o.PublicURL {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			method := c.GetHeader("Access-Control-Request-Method")
			if method != http.MethodGet && method != http.MethodPost && method != http.MethodDelete {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			for _, header := range strings.Split(c.GetHeader("Access-Control-Request-Headers"), ",") {
				header = strings.ToLower(strings.TrimSpace(header))
				if header != "" && header != "content-type" && header != "x-csrf-token" {
					c.AbortWithStatus(http.StatusForbidden)
					return
				}
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})
	clear := func(c *gin.Context) { cookie(c, "gymbro_session", "", "/", -1); cookie(c, "gymbro_csrf", "", "/", -1) }
	r.Use(func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 5 && c.Request.URL.Path[:5] == "/api/" {
			c.Header("Cache-Control", "no-store")
		}
		c.Next()
	})
	r.GET("/api/v1/exercises", func(c *gin.Context) {
		exercises, err := o.Catalog.List(c.Request.Context())
		if err != nil {
			failure(c, err)
			return
		}
		c.JSON(200, exercises)
	})
	r.GET("/api/v1/auth/capabilities", func(c *gin.Context) { c.JSON(200, gin.H{"google_configured": o.Auth.Provider != nil}) })
	r.GET("/api/v1/auth/google/start", func(c *gin.Context) {
		login, err := o.Auth.Start()
		if err != nil {
			c.JSON(503, gin.H{"error": "google_not_available"})
			return
		}
		cookie(c, "gymbro_oauth", login.Binding, "/api/v1/auth", 300)
		c.Redirect(302, login.URL)
	})
	r.GET("/api/v1/auth/google/callback", func(c *gin.Context) {
		binding, _ := c.Cookie("gymbro_oauth")
		cookie(c, "gymbro_oauth", "", "/api/v1/auth", -1)
		credentials, err := o.Auth.Callback(c.Request.Context(), c.Query("state"), binding, c.Query("code"))
		if err != nil {
		c.Redirect(303, o.PublicURL+"/?login=failed")
			return
		}
		cookie(c, "gymbro_session", credentials.Token, "/", 30*86400)
		cookie(c, "gymbro_csrf", credentials.CSRF, "/", 30*86400)
		c.Redirect(303, o.PublicURL+"/")
	})
	auth := func(c *gin.Context) {
		token, _ := c.Cookie("gymbro_session")
		s, err := o.Auth.Current(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
			return
		}
		c.Set("session", s)
		c.Set("token", token)
		c.Next()
	}
	owner := func(c *gin.Context) string { return c.MustGet("session").(repository.Session).User.ID }
	csrf := func(c *gin.Context) {
		value := c.GetHeader("X-CSRF-Token")
		s := c.MustGet("session").(repository.Session)
		if c.GetHeader("Origin") != o.PublicURL || len(value) != 43 || subtle.ConstantTimeCompare(usecase.HashToken(value), s.CSRFHash) != 1 {
			c.AbortWithStatusJSON(403, gin.H{"error": "csrf"})
			return
		}
		c.Next()
	}
	r.GET("/api/v1/auth/me", auth, func(c *gin.Context) {
		s := c.MustGet("session").(repository.Session)
		value, _ := c.Cookie("gymbro_csrf")
		if subtle.ConstantTimeCompare(usecase.HashToken(value), s.CSRFHash) != 1 {
			c.JSON(401, gin.H{"error": "login_required"})
			return
		}
		c.JSON(200, gin.H{"user": s.User, "csrf": value})
	})
	r.POST("/api/v1/auth/logout", auth, csrf, func(c *gin.Context) {
		if err := o.Sessions.Revoke(c.Request.Context(), usecase.HashToken(c.GetString("token"))); err != nil {
			failure(c, err)
			return
		}
		clear(c)
		c.Status(204)
	})
	r.DELETE("/api/v1/account", auth, csrf, func(c *gin.Context) {
		if err := o.Sessions.DeleteAccount(c.Request.Context(), owner(c)); err != nil {
			failure(c, err)
			return
		}
		clear(c)
		c.Status(204)
	})
	r.GET("/api/v1/workouts", auth, func(c *gin.Context) {
		rows, err := o.History.List(c.Request.Context(), owner(c))
		if err != nil {
			failure(c, err)
			return
		}
		c.JSON(200, rows)
	})
	r.GET("/api/v1/workouts/:id", auth, func(c *gin.Context) {
		w, err := o.History.Find(c.Request.Context(), owner(c), c.Param("id"))
		if err != nil {
			failure(c, err)
			return
		}
		c.JSON(200, gin.H{"workout": w, "summary": w.Summary()})
	})
	r.POST("/api/v1/workout-mutations", auth, csrf, func(c *gin.Context) {
		var m usecase.Mutation
		if err := decode(c, &m); err != nil {
			failure(c, entity.ErrInvalid)
			return
		}
		if m.Workout != nil && m.Workout.CapturedAt == nil {
			failure(c, entity.ErrInvalid)
			return
		}
		out, err := o.Sync.Apply(c.Request.Context(), owner(c), m)
		if errors.Is(err, entity.ErrConflict) {
			w, readErr := o.History.Find(c.Request.Context(), owner(c), m.WorkoutID)
			if readErr != nil {
				failure(c, readErr)
				return
			}
			c.JSON(409, gin.H{"error": "revision_conflict", "server": w})
			return
		}
		if err != nil {
			failure(c, err)
			return
		}
		c.JSON(200, out)
	})
	if o.WebDir != "" {
		fs := http.FileServer(http.Dir(o.WebDir))
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			if c.Request.Method != "GET" && c.Request.Method != "HEAD" {
				c.Status(404)
				return
			}
			if path == "/api" || (len(path) >= 5 && path[:5] == "/api/") {
				c.Status(404)
				return
			}
			file := filepath.Join(o.WebDir, filepath.Clean("/"+path))
			if info, err := os.Stat(file); err == nil && !info.IsDir() {
				fs.ServeHTTP(c.Writer, c.Request)
				return
			}
			if path == "/" {
				c.File(filepath.Join(o.WebDir, "index.html"))
				return
			}
			c.Status(404)
		})
	}
	return r
}
func decode(c *gin.Context, value any) error {
	kind, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || kind != "application/json" {
		return entity.ErrInvalid
	}
	body := http.MaxBytesReader(c.Writer, c.Request.Body, 1024*1024)
	d := json.NewDecoder(body)
	d.DisallowUnknownFields()
	if err = d.Decode(value); err != nil {
		return err
	}
	var extra any
	if err = d.Decode(&extra); err != io.EOF {
		return entity.ErrInvalid
	}
	return nil
}
func failure(c *gin.Context, err error) {
	status, code := 500, "internal_error"
	switch {
	case errors.Is(err, usecase.ErrUnauthorized):
		status, code = 401, "unauthorized"
	case errors.Is(err, entity.ErrInvalid):
		status, code = 400, "invalid_request"
	case errors.Is(err, entity.ErrNotFound):
		status, code = 404, "not_found"
	case errors.Is(err, entity.ErrDeleted):
		status, code = 410, "deleted"
	case errors.Is(err, usecase.ErrMutationReused):
		status, code = 409, "mutation_reused"
	}
	c.JSON(status, gin.H{"error": code})
}
