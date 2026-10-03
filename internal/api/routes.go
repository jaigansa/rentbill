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
	// Protected API Endpoints
	mux.HandleFunc("/api/dashboard", server.AuthMiddleware(server.HandleDashboard))

	mux.HandleFunc("/api/properties", server.AuthMiddleware(server.HandleProperties))
	mux.HandleFunc("/api/properties/", server.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/expenses") {
			server.HandlePropertyExpenses(w, r)
			return
		}
		server.HandlePropertyDetail(w, r)
	}))

	mux.HandleFunc("/api/expenses", server.AuthMiddleware(server.HandleExpenses))
	mux.HandleFunc("/api/expenses/", server.AuthMiddleware(server.HandleExpenseDetail))

	mux.HandleFunc("/api/tenants", server.AuthMiddleware(server.HandleTenants))
	mux.HandleFunc("/api/tenants/", server.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/last-bill") {
			server.HandleTenantLastBill(w, r)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/ledger") {
			server.HandleTenantLedger(w, r)
			return
		}
		server.HandleTenantDetail(w, r)
	}))

	mux.HandleFunc("/api/bills", server.AuthMiddleware(server.HandleBills))
	mux.HandleFunc("/api/bills/", server.AuthMiddleware(server.HandleBillDetail))

	mux.HandleFunc("/api/payments", server.AuthMiddleware(server.HandlePayments))
	mux.HandleFunc("/api/settings", server.AuthMiddleware(server.HandleSettings))

	// Backup, Restore & Reports (Protected)
	mux.HandleFunc("/api/backup/export", server.AuthMiddleware(server.HandleBackupExport))
	mux.HandleFunc("/api/backup/restore", server.AuthMiddleware(server.HandleBackupRestore))
	mux.HandleFunc("/api/backup/email-send", server.AuthMiddleware(server.HandleBackupEmailSend))
	mux.HandleFunc("/api/backup/email-test", server.AuthMiddleware(server.HandleBackupEmailTest))
	mux.HandleFunc("/api/reports/csv", server.AuthMiddleware(server.HandleReportsCSV))

	// 4-Digit Security PIN & Auth Endpoints
	mux.HandleFunc("/api/auth/status", server.HandleAuthStatus)
	mux.HandleFunc("/api/auth/verify", server.HandleAuthVerify)
	mux.HandleFunc("/api/auth/logout", server.HandleAuthLogout)
	mux.HandleFunc("/api/auth/set-pin", server.HandleAuthSetPIN)
	mux.HandleFunc("/api/auth/disable-pin", server.HandleAuthDisablePIN)

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
