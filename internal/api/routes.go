package api

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"net/url"
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

// SecurityMiddleware defends against CSRF, DNS rebinding, and unauthorized localhost probing
func (s *Server) SecurityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Mandatory Security Headers on all responses
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none';")

		// 2. Anti-DNS-Rebinding: Validate Host header (allows localhost, and private IPs if LAN sharing)
		if !isAllowedHost(r.Host, s.AllowRemote) {
			http.Error(w, "Bad Request: Invalid host header", http.StatusBadRequest)
			return
		}

		// 3. Anti-CSRF: Validate Origin header if present
		if origin := r.Header.Get("Origin"); origin != "" {
			if !s.isAllowedOrigin(origin) {
				http.Error(w, "Forbidden: Cross-origin request rejected", http.StatusForbidden)
				return
			}
		}

		// 4. Anti-CSRF: Validate Referer header if present
		if referer := r.Header.Get("Referer"); referer != "" {
			if !s.isAllowedReferer(referer) {
				http.Error(w, "Forbidden: External referer rejected", http.StatusForbidden)
				return
			}
		}

		// 5. Strict protections when LocalAppToken is active
		if s.LocalAppToken != "" {
			// Local Token Authentication for all /api/ endpoints EXCEPT /api/health
			if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/health" {
				reqToken := r.Header.Get("X-RentBill-Token")
				if reqToken == "" {
					if cookie, err := r.Cookie("rb_app_token"); err == nil {
						reqToken = cookie.Value
					}
				}
				if reqToken == "" {
					reqToken = r.URL.Query().Get("token")
				}

				if reqToken != s.LocalAppToken {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_ = json.NewEncoder(w).Encode(map[string]interface{}{
						"error": "Forbidden: Invalid or missing local application security token",
					})
					return
				}
			}
		}

		// Disable cache on API responses
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			w.Header().Set("Pragma", "no-cache")
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) isAllowedOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return isAllowedHost(u.Host, s.AllowRemote)
}

func (s *Server) isAllowedReferer(referer string) bool {
	u, err := url.Parse(referer)
	if err != nil {
		return false
	}
	return isAllowedHost(u.Host, s.AllowRemote)
}

func isAllowedHost(host string, allowRemote bool) bool {
	h := host
	if strings.Contains(h, ":") {
		var err error
		h, _, err = net.SplitHostPort(host)
		if err != nil {
			h = host
		}
	}
	h = strings.ToLower(strings.TrimSpace(h))
	if h == "localhost" || h == "127.0.0.1" || h == "::1" || h == "" {
		return true
	}
	if allowRemote {
		ip := net.ParseIP(h)
		if ip != nil {
			return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
		}
	}
	return false
}

// HandleNetworkInfo provides local and LAN connection endpoints and sharing status
func (s *Server) HandleNetworkInfo(w http.ResponseWriter, r *http.Request) {
	localURL := ""
	if s.StaticPort > 0 {
		if s.LocalAppToken != "" {
			localURL = fmt.Sprintf("http://127.0.0.1:%d/?token=%s", s.StaticPort, s.LocalAppToken)
		} else {
			localURL = fmt.Sprintf("http://127.0.0.1:%d/", s.StaticPort)
		}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"lan_shared": s.IsLANShared,
		"port":       s.StaticPort,
		"local_url":  localURL,
		"lan_urls":   s.LANURLs,
		"token":      s.LocalAppToken,
	})
}

func RegisterRoutes(mux *http.ServeMux, server *Server, publicFS fs.FS) {
	// Liveness / Health Check Endpoint
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"status": "ok",
			"app":    "rentbill",
		})
	})

	// Network & Wi-Fi Sharing Endpoint
	mux.HandleFunc("GET /api/network/info", server.HandleNetworkInfo)

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
	mux.HandleFunc("GET /api/bills/batch/preview", server.AuthMiddleware(server.HandleBatchPreview))
	mux.HandleFunc("POST /api/bills/batch", server.AuthMiddleware(server.HandleBatchCreateBills))
	mux.HandleFunc("/api/bills/{id}", server.AuthMiddleware(server.HandleBillDetail))

	mux.HandleFunc("/api/payments", server.AuthMiddleware(server.HandlePayments))
	mux.HandleFunc("/api/payments/{id}", server.AuthMiddleware(server.HandlePaymentDetail))
	mux.HandleFunc("GET /api/bills/{id}/payments", server.AuthMiddleware(server.HandleBillPayments))
	mux.HandleFunc("/api/settings", server.AuthMiddleware(server.HandleSettings))

	// Database Import & Export (Protected)
	mux.HandleFunc("GET /api/backup/export", server.AuthMiddleware(server.HandleBackupExport))
	mux.HandleFunc("POST /api/backup/restore", server.AuthMiddleware(server.HandleBackupRestore))

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

		// When loading HTML root, set SameSite=Strict cookie if token query parameter is present
		if (r.URL.Path == "/" || r.URL.Path == "/index.html") && server.LocalAppToken != "" {
			if r.URL.Query().Get("token") == server.LocalAppToken {
				http.SetCookie(w, &http.Cookie{
					Name:     "rb_app_token",
					Value:    server.LocalAppToken,
					Path:     "/",
					HttpOnly: true,
					SameSite: http.SameSiteStrictMode,
				})
			}
		}

		fileServer.ServeHTTP(w, r)
	})
}
