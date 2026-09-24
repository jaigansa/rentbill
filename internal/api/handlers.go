package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"rentbill/internal/database"
)

type Server struct {
	db *database.DB
}

func NewServer(db *database.DB) *Server {
	return &Server{db: db}
}

// JSON Helper functions
func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func sendError(w http.ResponseWriter, status int, msg string) {
	sendJSON(w, status, map[string]string{"error": msg})
}

// Dashboard Handler
func (s *Server) HandleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	month := r.URL.Query().Get("month")
	summary, err := s.db.GetDashboardSummary(month)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, summary)
}

// Properties Handlers
func (s *Server) HandleProperties(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		properties, err := s.db.GetAllProperties()
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if properties == nil {
			properties = []database.Property{}
		}
		sendJSON(w, http.StatusOK, properties)

	case http.MethodPost:
		var p database.Property
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if p.Name == "" {
			sendError(w, http.StatusBadRequest, "Property name is required")
			return
		}
		id, err := s.db.CreateProperty(&p)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.ID = id
		sendJSON(w, http.StatusCreated, p)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandlePropertyDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/properties/"):]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid property ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		prop, err := s.db.GetPropertyByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Property not found")
			return
		}
		sendJSON(w, http.StatusOK, prop)

	case http.MethodPut:
		var p database.Property
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		p.ID = id
		if err := s.db.UpdateProperty(&p); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, p)

	case http.MethodDelete:
		if err := s.db.DeleteProperty(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

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
	idStr := r.URL.Path[len("/api/tenants/"):]
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
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Latest tenant bill helper (for auto-carrying over meter readings & suggesting next month)
func (s *Server) HandleTenantLastBill(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/tenants/") : len(r.URL.Path)-len("/last-bill")]
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
		if tenant != nil {
			initElec = tenant.InitialElecMeter
			initWater = tenant.InitialWaterMeter
		}
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"curr_electricity_meter": initElec,
			"curr_water_meter":       initWater,
			"has_prior_bill":         false,
			"pending_balance":        0.0,
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
	idStr := r.URL.Path[len("/api/tenants/") : len(r.URL.Path)-len("/ledger")]
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

// Bills Handlers
func (s *Server) HandleBills(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tenantIDStr := r.URL.Query().Get("tenant_id")
		var bills []database.Bill
		var err error
		if tenantIDStr != "" {
			tenantID, parseErr := strconv.ParseInt(tenantIDStr, 10, 64)
			if parseErr != nil {
				sendError(w, http.StatusBadRequest, "Invalid tenant_id")
				return
			}
			bills, err = s.db.GetBillsByTenant(tenantID)
		} else {
			bills, err = s.db.GetAllBills()
		}
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if bills == nil {
			bills = []database.Bill{}
		}
		sendJSON(w, http.StatusOK, bills)

	case http.MethodPost:
		var b database.Bill
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if b.TenantID == 0 || b.PropertyID == 0 || b.BillingMonth == "" || b.DueDate == "" {
			sendError(w, http.StatusBadRequest, "Tenant, Property, Billing Month, and Due Date are required")
			return
		}
		id, err := s.db.CreateBill(&b)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		createdBill, err := s.db.GetBillByID(id)
		if err != nil {
			sendJSON(w, http.StatusCreated, map[string]int64{"id": id})
			return
		}
		sendJSON(w, http.StatusCreated, createdBill)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandleBillDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/bills/"):]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid bill ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		bill, err := s.db.GetBillByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Bill not found")
			return
		}
		sendJSON(w, http.StatusOK, bill)

	case http.MethodPut:
		var b database.Bill
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		b.ID = id
		if err := s.db.UpdateBill(&b); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		updated, err := s.db.GetBillByID(id)
		if err != nil {
			sendJSON(w, http.StatusOK, b)
			return
		}
		sendJSON(w, http.StatusOK, updated)

	case http.MethodDelete:
		if err := s.db.DeleteBill(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Payments Handlers
func (s *Server) HandlePayments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		payments, err := s.db.GetAllPayments()
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if payments == nil {
			payments = []database.Payment{}
		}
		sendJSON(w, http.StatusOK, payments)

	case http.MethodPost:
		var p database.Payment
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if p.BillID == 0 || p.Amount <= 0 || p.PaymentDate == "" {
			sendError(w, http.StatusBadRequest, "Bill ID, valid positive Amount, and Payment Date are required")
			return
		}
		id, err := s.db.RecordPayment(&p)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.ID = id
		sendJSON(w, http.StatusCreated, p)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Settings Handlers (Supabase / App Settings)
func (s *Server) HandleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		supabaseURL := s.db.GetSetting("supabase_url")
		supabaseKey := s.db.GetSetting("supabase_key")
		currencySymbol := s.db.GetSetting("currency_symbol")
		if currencySymbol == "" {
			currencySymbol = "₹"
		}
		sendJSON(w, http.StatusOK, map[string]string{
			"supabase_url":    supabaseURL,
			"supabase_key":    supabaseKey,
			"currency_symbol": currencySymbol,
		})

	case http.MethodPost:
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		for k, v := range payload {
			_ = s.db.SetSetting(k, v)
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Settings updated"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Expenses Handlers
func (s *Server) HandleExpenses(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var ex database.Expense
		if err := json.NewDecoder(r.Body).Decode(&ex); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if ex.PropertyID == 0 || ex.Title == "" || ex.Amount <= 0 || ex.ExpenseDate == "" {
			sendError(w, http.StatusBadRequest, "Property ID, Title, positive Amount, and Expense Date are required")
			return
		}
		id, err := s.db.CreateExpense(&ex)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		ex.ID = id
		sendJSON(w, http.StatusCreated, ex)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandleExpenseDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/expenses/"):]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid expense ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		ex, err := s.db.GetExpenseByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Expense not found")
			return
		}
		sendJSON(w, http.StatusOK, ex)

	case http.MethodPut:
		var ex database.Expense
		if err := json.NewDecoder(r.Body).Decode(&ex); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		ex.ID = id
		if err := s.db.UpdateExpense(&ex); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, ex)

	case http.MethodDelete:
		if err := s.db.DeleteExpense(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Expense deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandlePropertyExpenses(w http.ResponseWriter, r *http.Request) {
	// Path is /api/properties/{id}/expenses
	path := r.URL.Path[len("/api/properties/"):]
	idStr := strings.TrimSuffix(path, "/expenses")
	propID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid property ID")
		return
	}

	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	expenses, err := s.db.GetExpensesByProperty(propID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if expenses == nil {
		expenses = []database.Expense{}
	}
	sendJSON(w, http.StatusOK, expenses)
}

// Backup & Restore Handlers

func (s *Server) HandleBackupExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	backup, err := s.db.ExportBackup()
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	filename := fmt.Sprintf("rentbill-backup-%s.json", time.Now().Format("2006-01-02-150405"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	_ = json.NewEncoder(w).Encode(backup)
}

func (s *Server) HandleBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var data database.BackupData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON backup file: "+err.Error())
		return
	}

	if err := s.db.RestoreBackup(&data); err != nil {
		sendError(w, http.StatusInternalServerError, "Restore failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Database restored successfully",
		"properties_count": len(data.Properties),
		"tenants_count": len(data.Tenants),
		"bills_count": len(data.Bills),
		"payments_count": len(data.Payments),
		"expenses_count": len(data.Expenses),
	})
}

// CSV Report Handler
func (s *Server) HandleReportsCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	reportType := r.URL.Query().Get("type")
	var csvData []byte
	var err error
	var filename string
	today := time.Now().Format("2006-01-02")

	switch reportType {
	case "bills":
		csvData, err = s.db.ExportBillsCSV()
		filename = fmt.Sprintf("rentbill-bills-%s.csv", today)
	case "payments":
		csvData, err = s.db.ExportPaymentsCSV()
		filename = fmt.Sprintf("rentbill-payments-%s.csv", today)
	case "expenses":
		csvData, err = s.db.ExportExpensesCSV()
		filename = fmt.Sprintf("rentbill-expenses-%s.csv", today)
	case "meters":
		csvData, err = s.db.ExportMetersCSV()
		filename = fmt.Sprintf("rentbill-meters-%s.csv", today)
	default:
		sendError(w, http.StatusBadRequest, "Invalid report type. Options: bills, payments, expenses, meters")
		return
	}

	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	_, _ = w.Write(csvData)
}
