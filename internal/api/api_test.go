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

func TestLocalGUISecurityMiddleware(t *testing.T) {
	server, _, mux, cleanup := setupTestServer(t)
	defer cleanup()

	const secretToken = "super_secret_local_gui_token_12345"
	server.SetLocalAppToken(secretToken)
	handler := server.SecurityMiddleware(mux)

	// 1. Missing token on /api/ endpoint -> should return 403 Forbidden
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "127.0.0.1:8080"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden without token, got %d", rec.Code)
	}

	// 2. Invalid token on /api/ endpoint -> should return 403 Forbidden
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "127.0.0.1:8080"
	req.Header.Set("X-RentBill-Token", "wrong_token")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden with wrong token, got %d", rec.Code)
	}

	// 3. Valid token on header -> should succeed with 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "127.0.0.1:8080"
	req.Header.Set("X-RentBill-Token", secretToken)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with valid token, got %d", rec.Code)
	}

	// Verify Security Headers
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("missing or incorrect X-Frame-Options header")
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("missing or incorrect X-Content-Type-Options header")
	}

	// 4. DNS Rebinding / Invalid Host -> should return 400 Bad Request
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "malicious-site.com:8080"
	req.Header.Set("X-RentBill-Token", secretToken)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request on rebinding host, got %d", rec.Code)
	}

	// 5. Cross-Origin CSRF attack from external webpage -> should return 403 Forbidden
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "127.0.0.1:8080"
	req.Header.Set("Origin", "http://evil-website.com")
	req.Header.Set("X-RentBill-Token", secretToken)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden on external origin, got %d", rec.Code)
	}

	// 6. External Referer -> should return 403 Forbidden
	req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Host = "127.0.0.1:8080"
	req.Header.Set("Referer", "http://evil-website.com/phishing.html")
	req.Header.Set("X-RentBill-Token", secretToken)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden on external referer, got %d", rec.Code)
	}
}

func TestLANSharingAndPrivateIPValidation(t *testing.T) {
	server, _, mux, cleanup := setupTestServer(t)
	defer cleanup()

	const secretToken = "lan_sharing_secret_token_99999"
	server.SetLocalAppToken(secretToken)
	server.SetAllowRemote(true) // LAN sharing enabled
	server.SetNetworkInfo(8080, []string{"http://192.168.1.100:8080/?token=" + secretToken}, true)
	handler := server.SecurityMiddleware(mux)

	// 1. GET /api/network/info -> should return LAN endpoints and port 8080
	req := httptest.NewRequest(http.MethodGet, "/api/network/info", nil)
	req.Host = "127.0.0.1:8080"
	req.Header.Set("X-RentBill-Token", secretToken)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/network/info, got %d", rec.Code)
	}

	var netInfo struct {
		LanShared bool     `json:"lan_shared"`
		Port      int      `json:"port"`
		LanURLs   []string `json:"lan_urls"`
		Token     string   `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &netInfo); err != nil {
		t.Fatalf("failed decoding network info: %v", err)
	}
	if !netInfo.LanShared || netInfo.Port != 8080 || len(netInfo.LanURLs) == 0 {
		t.Errorf("unexpected network info response: %+v", netInfo)
	}

	// 2. Private LAN IPs should be accepted when LAN sharing is enabled
	validPrivateHosts := []string{
		"192.168.1.50:8080",
		"10.0.0.12:8080",
		"172.16.5.2:8080",
		"192.168.0.1",
	}
	for _, host := range validPrivateHosts {
		req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
		req.Host = host
		req.Header.Set("X-RentBill-Token", secretToken)
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 OK for private LAN host %s, got %d", host, rec.Code)
		}
	}

	// 3. Public domains and non-private IPs MUST still be rejected with 400 Bad Request to prevent DNS rebinding
	publicHosts := []string{
		"evil.com:8080",
		"attacker-rebinding.org:8080",
		"8.8.8.8:8080", // Public IP
		"1.1.1.1:8080", // Public IP
	}
	for _, host := range publicHosts {
		req = httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
		req.Host = host
		req.Header.Set("X-RentBill-Token", secretToken)
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for non-private host %s, got %d", host, rec.Code)
		}
	}
}
