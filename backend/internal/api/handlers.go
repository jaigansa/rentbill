package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"rentbills/backend/internal/accounting"
	"rentbills/backend/internal/db"
	"rentbills/backend/internal/sync"
)

type Router struct {
	database   *db.DB
	syncEngine *sync.SyncEngine
	mux        *http.ServeMux
}

func NewRouter(database *db.DB, syncEngine *sync.SyncEngine) *Router {
	r := &Router{
		database:   database,
		syncEngine: syncEngine,
		mux:        http.NewServeMux(),
	}
	r.registerRoutes()
	return r
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// Enable CORS for local cross-origin development / testing
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")

	if req.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	r.mux.ServeHTTP(w, req)
}

func (r *Router) registerRoutes() {
	r.mux.HandleFunc("/api/sync/status", r.handleSyncStatus)
	r.mux.HandleFunc("/api/sync/trigger", r.handleSyncTrigger)
	r.mux.HandleFunc("/api/accounting/calculate-bill", r.handleCalculateBill)
	r.mux.HandleFunc("/api/accounting/ledger", r.handleLedger)
	r.mux.HandleFunc("/api/accounting/record-payment", r.handleRecordPayment)
	r.mux.HandleFunc("/api/accounting/void-bill", r.handleVoidBill)
	r.mux.HandleFunc("/api/data/", r.handleTableCRUD)
}

func (r *Router) handleSyncStatus(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := r.syncEngine.GetStatus()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}

func (r *Router) handleSyncTrigger(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.syncEngine.TriggerSync()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Sync triggered successfully"})
}

// handleTableCRUD handles generic CRUD for tables: properties, units, renters, bills, payments, expenses, owners, maintenance_tasks, documents
func (r *Router) handleTableCRUD(w http.ResponseWriter, req *http.Request) {
	table := strings.TrimPrefix(req.URL.Path, "/api/data/")
	table = strings.Trim(table, "/")

	if !isValidTable(table) {
		http.Error(w, "Invalid table name: "+table, http.StatusBadRequest)
		return
	}

	switch req.Method {
	case http.MethodGet:
		r.handleSelect(w, req, table)
	case http.MethodPost:
		r.handleInsert(w, req, table)
	case http.MethodPatch, http.MethodPut:
		r.handleUpdate(w, req, table)
	case http.MethodDelete:
		r.handleDelete(w, req, table)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func isValidTable(table string) bool {
	allowed := map[string]bool{
		"properties":        true,
		"units":             true,
		"owners":            true,
		"renters":           true,
		"bills":             true,
		"payments":          true,
		"expenses":          true,
		"maintenance_tasks": true,
		"documents":         true,
	}
	return allowed[table]
}

func (r *Router) handleSelect(w http.ResponseWriter, req *http.Request, table string) {
	q := req.URL.Query()
	whereClauses := []string{}
	args := []interface{}{}

	// Check if deleted_at is requested or filtered
	if q.Get("deleted_at") == "null" || q.Get("deleted_at") == "is.null" || !q.Has("include_deleted") {
		whereClauses = append(whereClauses, table+".deleted_at IS NULL")
	}

	// Filter by exact fields passed as query params
	for key, values := range q {
		if key == "deleted_at" || key == "include_deleted" || key == "order" || key == "limit" || key == "select" {
			continue
		}
		if len(values) > 0 {
			val := values[0]
			if strings.HasPrefix(val, "eq.") {
				val = strings.TrimPrefix(val, "eq.")
			}
			whereClauses = append(whereClauses, fmt.Sprintf("%s.%s = ?", table, key))
			args = append(args, val)
		}
	}

	query := fmt.Sprintf("SELECT * FROM %s", table)
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	order := q.Get("order")
	if order != "" {
		parts := strings.Split(order, ".")
		col := parts[0]
		dir := "ASC"
		if len(parts) > 1 && strings.EqualFold(parts[1], "desc") {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", col, dir)
	} else {
		query += " ORDER BY id DESC"
	}

	limit := q.Get("limit")
	if limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			query += fmt.Sprintf(" LIMIT %d", l)
		}
	}

	rows, err := r.database.SQLDB().Query(query, args...)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	results, err := db.QueryToMaps(rows)
	if err != nil {
		http.Error(w, "Serialization error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if results == nil {
		results = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(results)
}

func (r *Router) handleInsert(w http.ResponseWriter, req *http.Request, table string) {
	var raw json.RawMessage
	if err := json.NewDecoder(req.Body).Decode(&raw); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(raw, &items); err != nil {
		var single map[string]interface{}
		if err := json.Unmarshal(raw, &single); err != nil {
			http.Error(w, "Invalid JSON body format", http.StatusBadRequest)
			return
		}
		items = append(items, single)
	}

	insertedRows := []map[string]interface{}{}

	for _, item := range items {
		// Generate UUID if empty
		uuidVal, _ := item["uuid"].(string)
		uuidVal = db.EnsureUUID(uuidVal)
		item["uuid"] = uuidVal

		now := db.NowISO()
		if item["created_at"] == nil {
			item["created_at"] = now
		}
		item["updated_at"] = now

		cols := []string{}
		placeholders := []string{}
		values := []interface{}{}

		for k, v := range item {
			if k == "id" {
				continue
			}
			cols = append(cols, k)
			placeholders = append(placeholders, "?")
			values = append(values, v)
		}

		insertQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
			table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))

		res, err := r.database.SQLDB().Exec(insertQuery, values...)
		if err != nil {
			http.Error(w, fmt.Sprintf("Insert into %s failed: %v", table, err), http.StatusInternalServerError)
			return
		}

		id, _ := res.LastInsertId()
		item["id"] = id
		insertedRows = append(insertedRows, item)

		// Queue in outbox
		_ = r.database.QueueOutbox(nil, table, uuidVal, "INSERT", item)
	}

	// Trigger background sync
	r.syncEngine.TriggerSync()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if len(insertedRows) == 1 {
		_ = json.NewEncoder(w).Encode(insertedRows[0])
	} else {
		_ = json.NewEncoder(w).Encode(insertedRows)
	}
}

func (r *Router) handleUpdate(w http.ResponseWriter, req *http.Request, table string) {
	q := req.URL.Query()
	matchCol := ""
	matchVal := ""

	if q.Has("id") {
		matchCol = "id"
		matchVal = q.Get("id")
	} else if q.Has("uuid") {
		matchCol = "uuid"
		matchVal = q.Get("uuid")
	} else {
		http.Error(w, "Missing 'id' or 'uuid' query parameter for update", http.StatusBadRequest)
		return
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	now := db.NowISO()
	payload["updated_at"] = now

	setClauses := []string{}
	values := []interface{}{}

	for k, v := range payload {
		if k == "id" {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = ?", k))
		values = append(values, v)
	}

	values = append(values, matchVal)
	updateQuery := fmt.Sprintf("UPDATE %s SET %s WHERE %s = ?", table, strings.Join(setClauses, ", "), matchCol)

	res, err := r.database.SQLDB().Exec(updateQuery, values...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Update %s failed: %v", table, err), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "No record found to update", http.StatusNotFound)
		return
	}

	// Fetch the updated record
	row := r.database.SQLDB().QueryRow(fmt.Sprintf("SELECT uuid FROM %s WHERE %s = ?", table, matchCol), matchVal)
	var recordUUID string
	_ = row.Scan(&recordUUID)

	payload["uuid"] = recordUUID
	_ = r.database.QueueOutbox(nil, table, recordUUID, "UPDATE", payload)
	r.syncEngine.TriggerSync()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"rows_affected": rowsAffected,
		"uuid":          recordUUID,
	})
}

func (r *Router) handleDelete(w http.ResponseWriter, req *http.Request, table string) {
	q := req.URL.Query()
	matchCol := ""
	matchVal := ""

	if q.Has("id") {
		matchCol = "id"
		matchVal = q.Get("id")
	} else if q.Has("uuid") {
		matchCol = "uuid"
		matchVal = q.Get("uuid")
	} else {
		http.Error(w, "Missing 'id' or 'uuid' parameter for delete", http.StatusBadRequest)
		return
	}

	// Fetch UUID first for outbox
	row := r.database.SQLDB().QueryRow(fmt.Sprintf("SELECT uuid FROM %s WHERE %s = ?", table, matchCol), matchVal)
	var recordUUID string
	if err := row.Scan(&recordUUID); err != nil {
		http.Error(w, "Record not found", http.StatusNotFound)
		return
	}

	now := db.NowISO()
	// Soft delete in SQLite
	_, err := r.database.SQLDB().Exec(fmt.Sprintf("UPDATE %s SET deleted_at = ?, updated_at = ? WHERE %s = ?", table, matchCol), now, now, matchVal)
	if err != nil {
		http.Error(w, "Soft delete failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = r.database.QueueOutbox(nil, table, recordUUID, "DELETE", map[string]interface{}{
		"uuid":       recordUUID,
		"deleted_at": now,
		"updated_at": now,
	})
	r.syncEngine.TriggerSync()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"deleted": true,
		"uuid":    recordUUID,
	})
}

// Accounting Endpoints

type CalcBillRequest struct {
	RenterID         interface{} `json:"renter_id"` // can be int or string
	BaseRentOverride *int64      `json:"base_rent_override,omitempty"`
	PrevEBReading    *int64      `json:"prev_eb_reading,omitempty"`
	CurrEBReading    int64       `json:"curr_eb_reading"`
	PrevWaterReading *int64      `json:"prev_water_reading,omitempty"`
	CurrWaterReading int64       `json:"curr_water_reading"`
	LateFee          int64       `json:"late_fee"`
	DiscountAmount   int64       `json:"discount_amount"`
	Others           int64       `json:"others"`
	ArrearsOverride  *int64      `json:"arrears_override,omitempty"`
}

func (r *Router) handleCalculateBill(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body CalcBillRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	renterIDStr := fmt.Sprintf("%v", body.RenterID)
	if renterIDStr == "" || renterIDStr == "<nil>" || renterIDStr == "0" {
		http.Error(w, "Missing renter_id", http.StatusBadRequest)
		return
	}

	// 1. Fetch Tenant Profile from SQLite
	var profile accounting.TenantBillingProfile
	var tID int64
	err := r.database.SQLDB().QueryRow(`
		SELECT id, base_rent, maint_charge, eb_per_unit_price, initial_eb_reading,
		       water_calc_mode, water_fixed_charge, water_per_unit_price, initial_water_reading,
		       pending_arrears
		FROM renters
		WHERE (id = ? OR uuid = ?) AND deleted_at IS NULL
	`, renterIDStr, renterIDStr).Scan(
		&tID, &profile.BaseRent, &profile.MaintCharge, &profile.EBUnitPrice, &profile.InitialEBReading,
		&profile.WaterCalcMode, &profile.WaterFixedCharge, &profile.WaterUnitPrice, &profile.InitialWater,
		&profile.PendingArrears,
	)
	if err != nil {
		http.Error(w, "Tenant not found: "+err.Error(), http.StatusNotFound)
		return
	}

	// 2. Determine previous meter reading baselines
	prevEB := profile.InitialEBReading
	prevWater := profile.InitialWater

	if body.PrevEBReading != nil {
		prevEB = *body.PrevEBReading
	} else {
		// Look up last bill readings
		var lastEB, lastWater int64
		err := r.database.SQLDB().QueryRow(`
			SELECT curr_eb_reading, curr_water_reading
			FROM bills
			WHERE renter_id = ? AND deleted_at IS NULL
			ORDER BY id DESC LIMIT 1
		`, tID).Scan(&lastEB, &lastWater)
		if err == nil {
			prevEB = lastEB
			prevWater = lastWater
		}
	}

	if body.PrevWaterReading != nil {
		prevWater = *body.PrevWaterReading
	}

	// 3. Delegate to pure Go accounting engine
	calcIn := accounting.BillCalculationInput{
		BaseRentOverride: body.BaseRentOverride,
		PrevEBReading:    prevEB,
		CurrEBReading:    body.CurrEBReading,
		PrevWaterReading: prevWater,
		CurrWaterReading: body.CurrWaterReading,
		LateFee:          body.LateFee,
		DiscountAmount:   body.DiscountAmount,
		Others:           body.Others,
		ArrearsOverride:  body.ArrearsOverride,
	}

	result, err := accounting.CalculateBill(profile, calcIn)
	if err != nil {
		http.Error(w, "Accounting calculation error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Response includes both paise (integers) and friendly rupee floats
	resp := map[string]interface{}{
		"rent_amount":          result.RentAmount,
		"maint_amount":         result.MaintAmount,
		"prev_eb_reading":      result.PrevEBReading,
		"curr_eb_reading":      result.CurrEBReading,
		"eb_units":             result.EBUnits,
		"eb_amount":            result.EBAmount,
		"prev_water_reading":   result.PrevWater,
		"curr_water_reading":   result.CurrWater,
		"water_units":          result.WaterUnits,
		"water_amount":         result.WaterAmount,
		"arrears_included":     result.ArrearsIncluded,
		"late_fee":             result.LateFee,
		"discount_amount":      result.DiscountAmount,
		"others":               result.Others,
		"gross_amount":         result.GrossAmount,
		"net_amount":           result.NetAmount,
		"status":               result.Status,
		"rent_amount_rupees":   float64(result.RentAmount) / 100.0,
		"maint_amount_rupees":  float64(result.MaintAmount) / 100.0,
		"eb_amount_rupees":     float64(result.EBAmount) / 100.0,
		"water_amount_rupees":  float64(result.WaterAmount) / 100.0,
		"arrears_rupees":       float64(result.ArrearsIncluded) / 100.0,
		"late_fee_rupees":      float64(result.LateFee) / 100.0,
		"discount_rupees":      float64(result.DiscountAmount) / 100.0,
		"others_rupees":        float64(result.Others) / 100.0,
		"gross_amount_rupees":  float64(result.GrossAmount) / 100.0,
		"net_amount_rupees":    float64(result.NetAmount) / 100.0,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (r *Router) handleLedger(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Fetch all bills
	billRows, err := r.database.SQLDB().Query(`
		SELECT id, net_amount, paid_amount, status, is_void, COALESCE(deleted_at, '')
		FROM bills
	`)
	if err != nil {
		http.Error(w, "Failed querying bills: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer billRows.Close()

	var bills []accounting.BillRecord
	for billRows.Next() {
		var b accounting.BillRecord
		var isVoidInt int
		if err := billRows.Scan(&b.ID, &b.NetAmount, &b.PaidAmount, &b.Status, &isVoidInt, &b.DeletedAt); err != nil {
			http.Error(w, "Error reading bills: "+err.Error(), http.StatusInternalServerError)
			return
		}
		b.IsVoid = isVoidInt == 1
		bills = append(bills, b)
	}

	// 2. Fetch all payments
	payRows, err := r.database.SQLDB().Query(`
		SELECT id, bill_id, amount, COALESCE(reference_no, ''), COALESCE(deleted_at, '')
		FROM payments
	`)
	if err != nil {
		http.Error(w, "Failed querying payments: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer payRows.Close()

	var payments []accounting.PaymentRecord
	for payRows.Next() {
		var p accounting.PaymentRecord
		if err := payRows.Scan(&p.ID, &p.BillID, &p.Amount, &p.ProofStatus, &p.DeletedAt); err != nil {
			http.Error(w, "Error reading payments: "+err.Error(), http.StatusInternalServerError)
			return
		}
		payments = append(payments, p)
	}

	// 3. Fetch all expenses
	expRows, err := r.database.SQLDB().Query(`
		SELECT id, amount, COALESCE(deleted_at, '') FROM expenses
	`)
	if err != nil {
		http.Error(w, "Failed querying expenses: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer expRows.Close()

	var expenses []accounting.ExpenseRecord
	for expRows.Next() {
		var e accounting.ExpenseRecord
		if err := expRows.Scan(&e.ID, &e.Amount, &e.DeletedAt); err != nil {
			http.Error(w, "Error reading expenses: "+err.Error(), http.StatusInternalServerError)
			return
		}
		expenses = append(expenses, e)
	}

	// 4. Delegate to Go Accounting Engine
	summary := accounting.ReconcileLedger(bills, payments, expenses, nil)

	resp := map[string]interface{}{
		"total_billed":           summary.TotalBilled,
		"total_written_off":      summary.TotalWrittenOff,
		"total_collected":        summary.TotalCollected,
		"total_expenses":         summary.TotalExpenses,
		"total_withdrawn":        summary.TotalWithdrawn,
		"outstanding":            summary.Outstanding,
		"net_cash_flow":          summary.NetCashFlow,
		"total_billed_rupees":    float64(summary.TotalBilled) / 100.0,
		"total_collected_rupees": float64(summary.TotalCollected) / 100.0,
		"total_expenses_rupees":  float64(summary.TotalExpenses) / 100.0,
		"outstanding_rupees":     float64(summary.Outstanding) / 100.0,
		"net_cash_flow_rupees":   float64(summary.NetCashFlow) / 100.0,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

type RecordPaymentRequest struct {
	BillID        *int64      `json:"bill_id"`
	RenterID      interface{} `json:"renter_id"`
	Amount        int64       `json:"amount"` // in paise
	PaymentMethod string      `json:"payment_method"`
	ReferenceNo   string      `json:"reference_no"`
	ReceiptNo     string      `json:"receipt_no"`
	Notes         string      `json:"notes"`
	PaymentDate   string      `json:"payment_date"`
}

func (r *Router) handleRecordPayment(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body RecordPaymentRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if body.Amount <= 0 {
		http.Error(w, "Payment amount must be greater than zero", http.StatusBadRequest)
		return
	}

	renterIDStr := fmt.Sprintf("%v", body.RenterID)
	payUUID := db.EnsureUUID("")
	now := db.NowISO()
	payDate := body.PaymentDate
	if payDate == "" {
		payDate = now
	}

	// Begin atomic SQLite transaction
	tx, err := r.database.SQLDB().Begin()
	if err != nil {
		http.Error(w, "Transaction start error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// 1. Insert Payment
	payRes, err := tx.Exec(`
		INSERT INTO payments (uuid, bill_id, renter_id, payment_date, amount, payment_method, reference_no, receipt_no, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, payUUID, body.BillID, renterIDStr, payDate, body.Amount, body.PaymentMethod, body.ReferenceNo, body.ReceiptNo, body.Notes, now, now)
	if err != nil {
		http.Error(w, "Failed inserting payment: "+err.Error(), http.StatusInternalServerError)
		return
	}
	paymentID, _ := payRes.LastInsertId()

	var newBillStatus string
	var newPaidAmount int64
	var newBalanceAmount int64

	// 2. If payment is tied to a Bill, recalculate bill status atomically
	if body.BillID != nil && *body.BillID > 0 {
		var netAmount int64
		err := tx.QueryRow(`SELECT net_amount FROM bills WHERE id = ?`, *body.BillID).Scan(&netAmount)
		if err == nil {
			var currentPaid int64
			_ = tx.QueryRow(`
				SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = ? AND deleted_at IS NULL
			`, *body.BillID).Scan(&currentPaid)

			newPaid, newBal, status, _ := accounting.ApplyPaymentToBill(netAmount, 0, currentPaid)
			newPaidAmount = newPaid
			newBalanceAmount = newBal
			newBillStatus = status

			_, _ = tx.Exec(`
				UPDATE bills
				SET paid_amount = ?, balance_amount = ?, status = ?, payment_status = ?, updated_at = ?
				WHERE id = ?
			`, newPaidAmount, newBalanceAmount, newBillStatus, newBillStatus, now, *body.BillID)

			// Outbox for bill
			var billUUID string
			_ = tx.QueryRow(`SELECT uuid FROM bills WHERE id = ?`, *body.BillID).Scan(&billUUID)
			if billUUID != "" {
				_ = r.database.QueueOutbox(tx, "bills", billUUID, "UPDATE", map[string]interface{}{
					"uuid":           billUUID,
					"paid_amount":    newPaidAmount,
					"balance_amount": newBalanceAmount,
					"status":         newBillStatus,
					"updated_at":     now,
				})
			}
		}
	}

	// 3. Adjust tenant pending arrears
	_, _ = tx.Exec(`
		UPDATE renters
		SET pending_arrears = MAX(0, pending_arrears - ?), updated_at = ?
		WHERE (id = ? OR uuid = ?)
	`, body.Amount, now, renterIDStr, renterIDStr)

	// Queue payment outbox
	_ = r.database.QueueOutbox(tx, "payments", payUUID, "INSERT", map[string]interface{}{
		"uuid":           payUUID,
		"bill_id":        body.BillID,
		"renter_id":      renterIDStr,
		"payment_date":   payDate,
		"amount":         body.Amount,
		"payment_method": body.PaymentMethod,
		"reference_no":   body.ReferenceNo,
		"receipt_no":     body.ReceiptNo,
		"notes":          body.Notes,
		"created_at":     now,
		"updated_at":     now,
	})

	if err := tx.Commit(); err != nil {
		http.Error(w, "Commit failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	r.syncEngine.TriggerSync()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"payment_id":     paymentID,
		"uuid":           payUUID,
		"bill_status":    newBillStatus,
		"paid_amount":    newPaidAmount,
		"balance_amount": newBalanceAmount,
	})
}

func (r *Router) handleVoidBill(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		BillID interface{} `json:"bill_id"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	billIDStr := fmt.Sprintf("%v", body.BillID)
	now := db.NowISO()

	row := r.database.SQLDB().QueryRow(`SELECT uuid FROM bills WHERE id = ? OR uuid = ?`, billIDStr, billIDStr)
	var billUUID string
	if err := row.Scan(&billUUID); err != nil {
		http.Error(w, "Bill not found", http.StatusNotFound)
		return
	}

	_, err := r.database.SQLDB().Exec(`
		UPDATE bills
		SET is_void = 1, status = 'VOID', updated_at = ?
		WHERE uuid = ?
	`, now, billUUID)
	if err != nil {
		http.Error(w, "Void failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = r.database.QueueOutbox(nil, "bills", billUUID, "UPDATE", map[string]interface{}{
		"uuid":       billUUID,
		"is_void":    1,
		"status":     "VOID",
		"updated_at": now,
	})
	r.syncEngine.TriggerSync()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"is_void": true,
		"uuid":    billUUID,
		"status":  "VOID",
	})
}

