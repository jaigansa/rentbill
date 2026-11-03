package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"rentbill/internal/database"
)

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
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/bills/") {
		idStr = r.URL.Path[len("/api/bills/"):]
	}
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
			sendError(w, http.StatusBadRequest, err.Error())
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

// Payment Detail Handler (GET, PUT, DELETE)
func (s *Server) HandlePaymentDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/payments/") {
		idStr = r.URL.Path[len("/api/payments/"):]
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		p, err := s.db.GetPaymentByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Payment record not found")
			return
		}
		sendJSON(w, http.StatusOK, p)

	case http.MethodPut:
		var p database.Payment
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		p.ID = id
		if p.Amount <= 0 || p.PaymentDate == "" {
			sendError(w, http.StatusBadRequest, "Valid positive Amount and Payment Date are required")
			return
		}
		if err := s.db.UpdatePayment(&p); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, p)

	case http.MethodDelete:
		if err := s.db.DeletePayment(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Payment record deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// Bill Payments List Handler
func (s *Server) HandleBillPayments(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	billID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid bill ID")
		return
	}

	payments, err := s.db.GetPaymentsByBillID(billID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, payments)
}

// Batch Monthly Bill Preview Handler (lists unbilled tenants with previous readings)
func (s *Server) HandleBatchPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		sendError(w, http.StatusBadRequest, "Billing month query parameter is required (e.g. ?month=2026-11)")
		return
	}

	items, err := s.db.GetBatchBillPreview(month)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, items)
}

// 1-Click Batch Monthly Bill Generator Handler
func (s *Server) HandleBatchCreateBills(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		BillingMonth string                   `json:"billing_month"`
		DueDate      string                   `json:"due_date"`
		Entries      []database.BatchBillEntry `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.BillingMonth == "" {
		sendError(w, http.StatusBadRequest, "Billing month is required")
		return
	}

	bills, err := s.db.BatchCreateMonthlyBills(req.BillingMonth, req.DueDate, req.Entries)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"billing_month": req.BillingMonth,
		"created_count": len(bills),
		"bills":         bills,
	})
}
