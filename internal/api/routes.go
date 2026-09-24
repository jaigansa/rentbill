package api

import (
	"io/fs"
	"net/http"
	"strings"
)

func RegisterRoutes(mux *http.ServeMux, server *Server, publicFS fs.FS) {
	// API Endpoints
	mux.HandleFunc("/api/dashboard", server.HandleDashboard)

	mux.HandleFunc("/api/properties", server.HandleProperties)
	mux.HandleFunc("/api/properties/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/expenses") {
			server.HandlePropertyExpenses(w, r)
			return
		}
		server.HandlePropertyDetail(w, r)
	})

	mux.HandleFunc("/api/expenses", server.HandleExpenses)
	mux.HandleFunc("/api/expenses/", server.HandleExpenseDetail)

	mux.HandleFunc("/api/tenants", server.HandleTenants)
	mux.HandleFunc("/api/tenants/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/last-bill") {
			server.HandleTenantLastBill(w, r)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/ledger") {
			server.HandleTenantLedger(w, r)
			return
		}
		server.HandleTenantDetail(w, r)
	})

	mux.HandleFunc("/api/bills", server.HandleBills)
	mux.HandleFunc("/api/bills/", server.HandleBillDetail)

	mux.HandleFunc("/api/payments", server.HandlePayments)
	mux.HandleFunc("/api/settings", server.HandleSettings)

	// Backup, Restore & Reports
	mux.HandleFunc("/api/backup/export", server.HandleBackupExport)
	mux.HandleFunc("/api/backup/restore", server.HandleBackupRestore)
	mux.HandleFunc("/api/reports/csv", server.HandleReportsCSV)

	// Embedded Static Frontend Handler
	fileServer := http.FileServer(http.FS(publicFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Prevent directory traversal or fallback to index.html for SPA-style routing if needed
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
