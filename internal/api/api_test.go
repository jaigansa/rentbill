package api_test

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"rentbill/internal/api"
	"rentbill/internal/database"
)

func setupTestServer(t *testing.T) (*api.Server, *database.DB, *http.ServeMux, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "rentbill_api_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "test_api.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("failed to init db: %v", err)
	}

	server := api.NewServer(db)
	mux := http.NewServeMux()
	emptyFS := fstest.MapFS{}
	api.RegisterRoutes(mux, server, fs.FS(emptyFS))

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}
	return server, db, mux, cleanup
}

func TestServerSideAuthMiddleware(t *testing.T) {
	_, db, mux, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. PIN disabled initially -> /api/dashboard should succeed
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK when PIN disabled, got %d", rec.Code)
	}

	// 2. Enable PIN '1234'
	if err := db.SetPIN("1234"); err != nil {
		t.Fatalf("failed setting PIN: %v", err)
	}

	// 3. Request without auth -> must be rejected with 401 Unauthorized
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized when PIN enabled, got %d", rec.Code)
	}

	var errResp map[string]interface{}
	_ = json.NewDecoder(rec.Body).Decode(&errResp)
	if errResp["pin_required"] != true {
		t.Errorf("expected pin_required: true in response, got %v", errResp)
	}

	// 4. Verify with wrong PIN
	wrongBody, _ := json.Marshal(map[string]string{"pin": "0000"})
	req = httptest.NewRequest(http.MethodPost, "/api/auth/verify", bytes.NewReader(wrongBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong PIN, got %d", rec.Code)
	}

	// 5. Verify with correct PIN
	correctBody, _ := json.Marshal(map[string]string{"pin": "1234"})
	req = httptest.NewRequest(http.MethodPost, "/api/auth/verify", bytes.NewReader(correctBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for correct PIN, got %d", rec.Code)
	}

	var verifyResp struct {
		Success bool   `json:"success"`
		Token   string `json:"token"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&verifyResp)
	if !verifyResp.Success || verifyResp.Token == "" {
		t.Fatalf("expected success and valid token, got %v", verifyResp)
	}

	// Check cookie
	cookies := rec.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "rentbill_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value != verifyResp.Token {
		t.Fatalf("expected rentbill_session cookie with token value, got %v", sessionCookie)
	}

	// 6. Request with Cookie -> should succeed with 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with session cookie, got %d", rec.Code)
	}

	// 7. Request with Bearer header -> should succeed with 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Header.Set("Authorization", "Bearer "+verifyResp.Token)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with Bearer token, got %d", rec.Code)
	}

	// 8. Logout
	req = httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for logout, got %d", rec.Code)
	}

	// 9. Subsequent request with old session should fail with 401
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 after logout, got %d", rec.Code)
	}
}
