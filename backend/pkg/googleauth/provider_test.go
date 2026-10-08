package googleauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	jose "github.com/go-jose/go-jose/v4"
	"golang.org/x/oauth2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestSignedIdentityVerificationAndPKCE(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var issuer, token, receivedVerifier string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/keys", "id_token_signing_alg_values_supported": []string{"RS256"}})
		case "/keys":
			json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "fixture-key", Algorithm: "RS256", Use: "sig"}}})
		case "/token":
			r.ParseForm()
			receivedVerifier = r.Form.Get("code_verifier")
			json.NewEncoder(w).Encode(map[string]any{"access_token": "fixture-access-unused", "token_type": "Bearer", "id_token": token})
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	issuer = server.URL
	p, err := New(context.Background(), issuer, "fixture-client", "fixture-secret", issuer+"/callback")
	if err != nil {
		t.Fatal(err)
	}
	verifier := oauth2.GenerateVerifier()
	u, err := url.Parse(p.Authorize("state", "nonce", verifier))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if q.Get("code_challenge") != oauth2.S256ChallengeFromVerifier(verifier) || q.Get("code_challenge_method") != "S256" || q.Get("nonce") != "nonce" || q.Get("state") != "state" {
		t.Fatal("missing OAuth binding/PKCE")
	}
	for _, test := range []string{"valid", "wrong-key", "audience", "issuer", "expired", "nonce", "missing-sub"} {
		t.Run(test, func(t *testing.T) {
			claims := map[string]any{"iss": issuer, "aud": "fixture-client", "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "sub": "fixture-sub", "nonce": "nonce", "name": "Fixture"}
			signingKey := key
			switch test {
			case "wrong-key":
				signingKey, _ = rsa.GenerateKey(rand.Reader, 2048)
			case "audience":
				claims["aud"] = "other-client"
			case "issuer":
				claims["iss"] = "https://other.example"
			case "expired":
				claims["exp"] = time.Now().Add(-time.Hour).Unix()
			case "nonce":
				claims["nonce"] = "other"
			case "missing-sub":
				delete(claims, "sub")
			}
			signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: signingKey}, (&jose.SignerOptions{}).WithHeader("kid", "fixture-key"))
			if err != nil {
				t.Fatal(err)
			}
			data, _ := json.Marshal(claims)
			signed, _ := signer.Sign(data)
			token, _ = signed.CompactSerialize()
			identity, err := p.Exchange(context.Background(), "fixture-code", "nonce", verifier)
			if test == "valid" {
				if err != nil || identity.Subject != "fixture-sub" || identity.Name != "Fixture" || receivedVerifier != verifier {
					t.Fatalf("valid: %+v %v", identity, err)
				}
			} else if err == nil {
				t.Fatal("unverified identity accepted")
			}
		})
	}
}
