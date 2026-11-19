package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"rentbill/internal/database"
)

// Tenants Handlers
func (s *Server) HandleTenants(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tenants, err := s.db.GetAllTenants()
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if tenants == nil {
			tenants = []database.Tenant{}
		}
		sendJSON(w, http.StatusOK, tenants)

	case http.MethodPost:
		var t database.Tenant
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if t.Name == "" || t.Phone == "" {
			sendError(w, http.StatusBadRequest, "Tenant name and phone are required")
			return
		}
		id, err := s.db.CreateTenant(&t)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		t.ID = id
		sendJSON(w, http.StatusCreated, t)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandleTenantDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/tenants/") {
		idStr = r.URL.Path[len("/api/tenants/"):]
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		tenant, err := s.db.GetTenantByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Tenant not found")
			return
		}
		sendJSON(w, http.StatusOK, tenant)

	case http.MethodPut:
		var t database.Tenant
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		t.ID = id
		if err := s.db.UpdateTenant(&t); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, t)

	case http.MethodDelete:
		if err := s.db.DeleteTenant(id); err != nil {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Latest tenant bill helper (for auto-carrying over meter readings & suggesting next month)
func (s *Server) HandleTenantLastBill(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/tenants/") {
		path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
		idStr = strings.TrimSuffix(path, "/last-bill")
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}
	bill, err := s.db.GetLatestBillForTenant(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	tenant, _ := s.db.GetTenantByID(id)

	if bill == nil {
		initElec := 0.0
		initWater := 0.0
		openingArrear := 0.0
		if tenant != nil {
			initElec = tenant.InitialElecMeter
			initWater = tenant.InitialWaterMeter
			openingArrear = tenant.OpeningArrear
		}
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"curr_electricity_meter": initElec,
			"curr_water_meter":       initWater,
			"has_prior_bill":         false,
			"pending_balance":        openingArrear,
			"source":                 "tenant_initial",
		})
		return
	}

	// Calculate suggested next month if last billing_month is in 'YYYY-MM' format
	nextMonth := ""
	if len(bill.BillingMonth) == 7 && bill.BillingMonth[4] == '-' {
		t, err := time.Parse("2006-01", bill.BillingMonth)
		if err == nil {
			nextMonth = t.AddDate(0, 1, 0).Format("2006-01")
		}
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"curr_electricity_meter": bill.CurrElectricityMeter,
		"curr_water_meter":       bill.CurrWaterMeter,
		"billing_month":          bill.BillingMonth,
		"suggested_next_month":   nextMonth,
		"pending_balance":        bill.BalanceAmount,
		"has_prior_bill":         true,
		"source":                 "previous_bill",
	})
}

// Tenant Ledger & Passbook Statement Handler
func (s *Server) HandleTenantLedger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/tenants/") {
		path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
		idStr = strings.TrimSuffix(path, "/ledger")
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}
	ledger, err := s.db.GetTenantLedger(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, ledger)
}
