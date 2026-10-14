package api

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
)

// AuthMiddleware enforces 4-digit PIN authentication on protected API endpoints when PIN is enabled
func (s *Server) AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.db.IsPINEnabled() {
			next(w, r)
			return
		}
		token := s.ExtractToken(r)
		if token != "" && s.db.ValidateSession(token) {
			next(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":        "Unauthorized: 4-digit PIN authentication required",
			"pin_required": true,
		})
	}
}

func RegisterRoutes(mux *http.ServeMux, server *Server, publicFS fs.FS) {
	// Protected API Endpoints (Go 1.22+ Method & Path Routing)
	mux.HandleFunc("GET /api/dashboard", server.AuthMiddleware(server.HandleDashboard))

	mux.HandleFunc("/api/properties", server.AuthMiddleware(server.HandleProperties))
	mux.HandleFunc("GET /api/properties/{id}/expenses", server.AuthMiddleware(server.HandlePropertyExpenses))
	mux.HandleFunc("/api/properties/{id}", server.AuthMiddleware(server.HandlePropertyDetail))

	mux.HandleFunc("/api/expenses", server.AuthMiddleware(server.HandleExpenses))
	mux.HandleFunc("/api/expenses/{id}", server.AuthMiddleware(server.HandleExpenseDetail))

	mux.HandleFunc("/api/tenants", server.AuthMiddleware(server.HandleTenants))
	mux.HandleFunc("GET /api/tenants/{id}/last-bill", server.AuthMiddleware(server.HandleTenantLastBill))
	mux.HandleFunc("GET /api/tenants/{id}/ledger", server.AuthMiddleware(server.HandleTenantLedger))
	mux.HandleFunc("/api/tenants/{id}", server.AuthMiddleware(server.HandleTenantDetail))

	mux.HandleFunc("/api/bills", server.AuthMiddleware(server.HandleBills))
	mux.HandleFunc("/api/bills/{id}", server.AuthMiddleware(server.HandleBillDetail))

	mux.HandleFunc("/api/payments", server.AuthMiddleware(server.HandlePayments))
	mux.HandleFunc("/api/settings", server.AuthMiddleware(server.HandleSettings))

	// Backup, Restore & Reports (Protected)
	mux.HandleFunc("GET /api/backup/export", server.AuthMiddleware(server.HandleBackupExport))
	mux.HandleFunc("POST /api/backup/restore", server.AuthMiddleware(server.HandleBackupRestore))
	mux.HandleFunc("POST /api/backup/email-send", server.AuthMiddleware(server.HandleBackupEmailSend))
	mux.HandleFunc("POST /api/backup/email-test", server.AuthMiddleware(server.HandleBackupEmailTest))
	mux.HandleFunc("GET /api/reports/csv", server.AuthMiddleware(server.HandleReportsCSV))

	// 4-Digit Security PIN & Auth Endpoints
	mux.HandleFunc("GET /api/auth/status", server.HandleAuthStatus)
	mux.HandleFunc("POST /api/auth/verify", server.HandleAuthVerify)
	mux.HandleFunc("POST /api/auth/logout", server.HandleAuthLogout)
	mux.HandleFunc("POST /api/auth/set-pin", server.HandleAuthSetPIN)
	mux.HandleFunc("POST /api/auth/disable-pin", server.HandleAuthDisablePIN)

	// Embedded Static Frontend Handler
	fileServer := http.FileServer(http.FS(publicFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
