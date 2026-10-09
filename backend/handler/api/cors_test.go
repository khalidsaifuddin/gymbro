package api

import (
	"github.com/khalidsaifuddin/gymbro/backend/core/usecase"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCredentialedFrontendCORSIsExactAndPreflighted(t *testing.T) {
	r := New(Options{Auth: usecase.NewAuth(nil, nil), PublicURL: "https://gymbro.spmbbanjarkab.web.id", APIURL: "https://gymbro-backend.spmbbanjarkab.web.id"})
	request := func(origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/workout-mutations", nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		req.Header.Set("Access-Control-Request-Headers", "content-type,x-csrf-token")
		response := httptest.NewRecorder()
		r.ServeHTTP(response, req)
		return response
	}
	allowed := request("https://gymbro.spmbbanjarkab.web.id")
	if allowed.Code != http.StatusNoContent || allowed.Header().Get("Access-Control-Allow-Origin") != "https://gymbro.spmbbanjarkab.web.id" || allowed.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("frontend preflight not accepted: status=%d headers=%v", allowed.Code, allowed.Header())
	}
	if got := allowed.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatal("CSRF and JSON headers are not allowed")
	}
	get := httptest.NewRequest(http.MethodGet, "/api/v1/auth/capabilities", nil)
	get.Header.Set("Origin", "https://gymbro.spmbbanjarkab.web.id")
	getResponse := httptest.NewRecorder()
	r.ServeHTTP(getResponse, get)
	if getResponse.Code != http.StatusOK || getResponse.Header().Get("Access-Control-Allow-Origin") != "https://gymbro.spmbbanjarkab.web.id" || getResponse.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("frontend fetch not allowed: status=%d headers=%v", getResponse.Code, getResponse.Header())
	}
	denied := request("https://attacker.example")
	if denied.Code != http.StatusForbidden || denied.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("untrusted preflight accepted: status=%d headers=%v", denied.Code, denied.Header())
	}
}
