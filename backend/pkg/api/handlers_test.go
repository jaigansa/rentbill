package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"rentbills/backend/pkg/db"
	"rentbills/backend/pkg/sync"
)

func setupTestRouter(t *testing.T) (*Router, func()) {
	tempDir, err := os.MkdirTemp("", "rentbill_api_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("Failed to open db: %v", err)
	}

	client := sync.NewSupabaseClient(sync.SupabaseConfig{})
	engine := sync.NewSyncEngine(database, client)
	router := NewRouter(database, engine)

	cleanup := func() {
		database.Close()
		os.RemoveAll(tempDir)
	}

	return router, cleanup
}

func TestSyncStatusEndpoint(t *testing.T) {
	router, cleanup := setupTestRouter(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/sync/status", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var status sync.SyncStatus
	if err := json.Unmarshal(w.Body.Bytes(), &status); err != nil {
		t.Fatalf("Failed to unmarshal status response: %v", err)
	}

	if status.IsOnline {
		t.Errorf("Expected offline state with empty config")
	}
}

func TestPropertiesCRUDEndpoints(t *testing.T) {
	router, cleanup := setupTestRouter(t)
	defer cleanup()

	// 1. Create Property
	body := `{"name":"Palm Grove Villa","address":"45 Palm Street"}`
	req := httptest.NewRequest("POST", "/api/data/properties", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	if created["name"] != "Palm Grove Villa" || created["uuid"] == nil {
		t.Errorf("Unexpected created property: %+v", created)
	}

	// 2. Select Properties
	req = httptest.NewRequest("GET", "/api/data/properties", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var list []map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("Expected 1 property, got %d", len(list))
	}

	// 3. Update Property
	propUUID := created["uuid"].(string)
	updateBody := `{"name":"Palm Grove Villa Updated"}`
	req = httptest.NewRequest("PATCH", "/api/data/properties?uuid="+propUUID, bytes.NewBufferString(updateBody))
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on update, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Delete Property
	req = httptest.NewRequest("DELETE", "/api/data/properties?uuid="+propUUID, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on delete, got %d: %s", w.Code, w.Body.String())
	}

	// Verify excluded from normal select
	req = httptest.NewRequest("GET", "/api/data/properties", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var listAfter []map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &listAfter)
	if len(listAfter) != 0 {
		t.Errorf("Expected 0 properties after soft delete, got %d", len(listAfter))
	}
}

func TestAccountingEndpoints(t *testing.T) {
	router, cleanup := setupTestRouter(t)
	defer cleanup()

	// 1. Seed Property, Unit, Tenant
	_, err := router.database.SQLDB().Exec(`
		INSERT INTO properties (uuid, name) VALUES ('prop-1', 'Green Villa');
		INSERT INTO units (uuid, property_id, unit_number) VALUES ('unit-1', 1, '101');
		INSERT INTO renters (id, uuid, unit_id, name, base_rent, maint_charge, eb_per_unit_price, initial_eb_reading, water_calc_mode, water_fixed_charge, pending_arrears)
		VALUES (1, 'tenant-1', 1, 'John Doe', 1000000, 50000, 8.0, 100, 'FIXED', 15000, 200000);
	`)
	if err != nil {
		t.Fatalf("Failed to seed test tenant: %v", err)
	}

	// 2. Test calculate-bill
	calcBody := `{"renter_id": 1, "curr_eb_reading": 150, "curr_water_reading": 100, "late_fee": 1000, "discount_amount": 2000}`
	req := httptest.NewRequest("POST", "/api/accounting/calculate-bill", bytes.NewBufferString(calcBody))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on calculate-bill, got %d: %s", w.Code, w.Body.String())
	}

	var calcRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &calcRes)
	// EB = 50 * 8.0 = 400.00 = 40,000 paise
	if int64(calcRes["eb_units"].(float64)) != 50 {
		t.Errorf("Expected 50 EB units, got %v", calcRes["eb_units"])
	}
	if int64(calcRes["eb_amount"].(float64)) != 40000 {
		t.Errorf("Expected 40,000 paise EB amount, got %v", calcRes["eb_amount"])
	}

	// 3. Insert Bill and test record-payment
	_, err = router.database.SQLDB().Exec(`
		INSERT INTO bills (id, uuid, renter_id, billing_period, gross_amount, net_amount, status)
		VALUES (1, 'bill-1', 1, '2026-09', 1000000, 1000000, 'UNPAID');
	`)
	if err != nil {
		t.Fatalf("Failed to seed bill: %v", err)
	}

	payBody := `{"bill_id": 1, "renter_id": 1, "amount": 600000, "payment_method": "CASH"}`
	req = httptest.NewRequest("POST", "/api/accounting/record-payment", bytes.NewBufferString(payBody))
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on record-payment, got %d: %s", w.Code, w.Body.String())
	}

	var payRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &payRes)
	if payRes["bill_status"] != "PARTIAL" {
		t.Errorf("Expected bill status PARTIAL after paying 600000 of 1000000, got %v", payRes["bill_status"])
	}

	// 4. Test ledger endpoint
	req = httptest.NewRequest("GET", "/api/accounting/ledger", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on ledger, got %d: %s", w.Code, w.Body.String())
	}

	var ledgerRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &ledgerRes)
	if int64(ledgerRes["total_billed"].(float64)) != 1000000 {
		t.Errorf("Expected total_billed 1000000, got %v", ledgerRes["total_billed"])
	}
	if int64(ledgerRes["total_collected"].(float64)) != 600000 {
		t.Errorf("Expected total_collected 600000, got %v", ledgerRes["total_collected"])
	}
}

