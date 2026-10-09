//go:build integration

package api

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/khalidsaifuddin/gymbro/backend/core/entity"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"github.com/khalidsaifuddin/gymbro/backend/internal/testdb"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	authrepo "github.com/khalidsaifuddin/gymbro/backend/repository/auth-repo"
	catalogrepo "github.com/khalidsaifuddin/gymbro/backend/repository/catalog-repo"
	syncrepo "github.com/khalidsaifuddin/gymbro/backend/repository/sync-repo"
	workoutrepo "github.com/khalidsaifuddin/gymbro/backend/repository/workout-repo"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPAuthIsolationStrictJSONAndCorrectedHistory(t *testing.T) {
	db := testdb.New(t)
	if err := migration.Up(db); err != nil {
		t.Fatal(err)
	}
	sessions := authrepo.New(db)
	token, csrf := usecase.RandomToken(), usecase.RandomToken()
	u, err := sessions.Issue(context.Background(), repository.Identity{Subject: "signed-fixture", Name: "Fixture"}, usecase.HashToken(token), usecase.HashToken(csrf), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	other := usecase.RandomToken()
	if _, err = sessions.Issue(context.Background(), repository.Identity{Subject: "signed-fixture-other", Name: "Other"}, usecase.HashToken(other), usecase.HashToken(csrf), time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	r := New(Options{Auth: usecase.NewAuth(nil, sessions), Sessions: sessions, Catalog: catalogrepo.New(db), History: usecase.History{Workouts: workoutrepo.New(db)}, Sync: usecase.Sync{Port: syncrepo.New(db)}, PublicURL: "http://localhost:8080"})
	request := func(method, path, body, tok, origin, csrfToken string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		if tok != "" {
			req.AddCookie(&http.Cookie{Name: "gymbro_session", Value: tok})
		}
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if csrfToken != "" {
			req.Header.Set("X-CSRF-Token", csrfToken)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	catalogue := request("GET", "/api/v1/exercises", "", "", "", "")
	if catalogue.Code != 200 {
		t.Fatal("catalogue", catalogue.Code)
	}
	var list []repository.Exercise
 if err = json.Unmarshal(catalogue.Body.Bytes(), &list); err != nil || len(list) != 1333 || len(list[0].Assets) != 1 {
		t.Fatal("catalogue payload", err)
	}
	if w := request("GET", "/api/v1/workouts", "", "", "", ""); w.Code != 401 {
		t.Fatal("guest account history", w.Code)
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	start := now.Add(-time.Minute)
	end := now.Add(-time.Second)
	sid := uuid.NewString()
	kg := "10.000"
	work := entity.Workout{ID: uuid.NewString(), StartedAt: start, CapturedAt: &now, FinishedAt: &end, Status: "completed", DurationMS: 59000, PauseIntervals: []entity.PauseInterval{}, Exercises: []entity.WorkoutExercise{{ID: uuid.NewString(), ExerciseID: "00000000-0000-4000-8000-000000000003", Position: 0, RestTargetSeconds: 120, Sets: []entity.WorkoutSet{{SetSource: entity.SetSource{ID: sid, Reps: 12, DetectedReps: 10, LoadKG: &kg, ImplementCount: 2, SourceIDs: []string{sid}, LabelSource: "profile"}, Position: 0, RepSource: "automatic", RecognitionStatus: "unknown", StartedAt: start, EndedAt: &end, LastRepAt: end}}}}}
	m := usecase.Mutation{AccountID: u.ID, MutationID: uuid.NewString(), WorkoutID: work.ID, Operation: "upsert", OccurredAt: now, Workout: &work}
	data, _ := json.Marshal(m)
	body := string(data)
	for _, test := range []struct{ origin, csrf string }{{"http://evil.example", csrf}, {"http://localhost:8080", "wrong"}, {"", csrf}} {
		if w := request("POST", "/api/v1/workout-mutations", body, token, test.origin, test.csrf); w.Code != 403 {
			t.Fatal("CSRF/Origin bypass", w.Code)
		}
	}
	if w := request("POST", "/api/v1/workout-mutations", body[:len(body)-1]+`,"video":"forbidden"}`, token, "http://localhost:8080", csrf); w.Code != 400 {
		t.Fatal("media accepted", w.Code)
	}
	wrong := m
	wrong.AccountID = "00000000-0000-4000-8000-000000000099"
	wrongData, _ := json.Marshal(wrong)
	if w := request("POST", "/api/v1/workout-mutations", string(wrongData), token, "http://localhost:8080", csrf); w.Code != 401 {
		t.Fatal("stale account binding accepted", w.Code)
	}
	w := request("POST", "/api/v1/workout-mutations", body, token, "http://localhost:8080", csrf)
	if w.Code != 200 {
		t.Fatal("save", w.Code, w.Body.String())
	}
	var result usecase.Outcome
	if err = json.Unmarshal(w.Body.Bytes(), &result); err != nil || result.Revision != 1 || result.Summary.KnownVolumeKG != "240.000" || result.Workout.Exercises[0].Sets[0].DetectedReps != 10 {
		t.Fatal("corrected summary", err)
	}
	if w = request("GET", "/api/v1/workouts/"+work.ID, "", other, "", ""); w.Code != 404 {
		t.Fatal("cross-account read", w.Code)
	}
	if w = request("GET", "/api/v1/workouts", "", token, "", ""); w.Code != 200 {
		t.Fatal("history", w.Code)
	}
	var stored struct{ UserID string }
	db.Table("public.workouts").Select("user_id").Where("id=?", work.ID).Scan(&stored)
	if stored.UserID != u.ID {
		t.Fatal("owner not from session")
	}
	if w = request("DELETE", "/api/v1/account", "", token, "http://localhost:8080", csrf); w.Code != 204 {
		t.Fatal("delete account", w.Code)
	}
	if w = request("GET", "/api/v1/workouts", "", token, "", ""); w.Code != 401 {
		t.Fatal("deleted session accepted", w.Code)
	}
}
