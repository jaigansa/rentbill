package database_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"rentbill/internal/database"
)

func setupTestDB(t *testing.T) (*database.DB, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "rentbill_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "test_rentbill.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("failed to init db: %v", err)
	}

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return db, cleanup
}

func TestTenantPreferredChannelAndQueries(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Create a Property
	propID, err := db.CreateProperty(&database.Property{
		Name:            "Flat 101",
		Address:         "123 Green Avenue",
		UnitType:        "Apartment",
		DefaultRent:     12000,
		ElectricityRate: 9.5,
	})
	if err != nil {
		t.Fatalf("failed creating property: %v", err)
	}

	// 2. Create Tenant with SMS_RCS preferred channel and opening arrear
	tenantID, err := db.CreateTenant(&database.Tenant{
		Name:             "Vikram Kumar",
		Phone:            "9876543210",
		Email:            "vikram@example.com",
		PropertyID:       &propID,
		SecurityDeposit:  30000,
		OpeningArrear:    2500.50,
		MoveInDate:       "2026-01-01",
		PreferredChannel: "SMS_RCS",
		IsActive:         true,
	})
	if err != nil {
		t.Fatalf("failed creating tenant: %v", err)
	}

	// 3. Retrieve Tenant and verify PreferredChannel and OpeningArrear
	retrieved, err := db.GetTenantByID(tenantID)
	if err != nil {
		t.Fatalf("failed retrieving tenant: %v", err)
	}
	if retrieved.PreferredChannel != "SMS_RCS" {
		t.Errorf("expected preferred_channel to be 'SMS_RCS', got '%s'", retrieved.PreferredChannel)
	}
	if retrieved.OpeningArrear != 2500.50 {
		t.Errorf("expected opening_arrear to be 2500.50, got '%f'", retrieved.OpeningArrear)
	}
	if retrieved.TotalDue != 2500.50 {
		t.Errorf("expected total_due to be 2500.50 before bills, got '%f'", retrieved.TotalDue)
	}
	if retrieved.Name != "Vikram Kumar" {
		t.Errorf("expected name 'Vikram Kumar', got '%s'", retrieved.Name)
	}

	// 3b. Verify Tenant Ledger reflects opening arrear before any bills exist
	preBillLedger, err := db.GetTenantLedger(tenantID)
	if err != nil {
		t.Fatalf("failed getting tenant ledger: %v", err)
	}
	if preBillLedger.CurrentBalance != 2500.50 {
		t.Errorf("expected ledger current balance to be 2500.50, got %f", preBillLedger.CurrentBalance)
	}
	if len(preBillLedger.Entries) != 1 || preBillLedger.Entries[0].Debit != 2500.50 {
		t.Errorf("expected 1 opening arrear entry in ledger, got %v", preBillLedger.Entries)
	}

	// 4. Update Tenant to WHATSAPP preferred channel and update opening arrear
	retrieved.PreferredChannel = "WHATSAPP"
	retrieved.OpeningArrear = 3000.00
	if err := db.UpdateTenant(retrieved); err != nil {
		t.Fatalf("failed updating tenant: %v", err)
	}

	updated, err := db.GetTenantByID(tenantID)
	if err != nil {
		t.Fatalf("failed getting updated tenant: %v", err)
	}
	if updated.PreferredChannel != "WHATSAPP" {
		t.Errorf("expected preferred_channel to be 'WHATSAPP', got '%s'", updated.PreferredChannel)
	}
	if updated.OpeningArrear != 3000.00 {
		t.Errorf("expected opening_arrear to be 3000.00, got '%f'", updated.OpeningArrear)
	}

	// 5. Create a Bill
	billID, err := db.CreateBill(&database.Bill{
		BillNumber:           "RB-202609-0001",
		TenantID:             tenantID,
		PropertyID:           propID,
		BillingMonth:         "Sep 2026",
		DueDate:              time.Now().AddDate(0, 1, 0).Format("2006-01-02"),
		BaseRent:             12000,
		PrevElectricityMeter: 100,
		CurrElectricityMeter: 150,
		ElectricityRate:      9.5,
		ElectricityUnits:     50,
		ElectricityAmount:    475,
		TotalAmount:          12475,
		Status:               "PENDING",
	})
	if err != nil {
		t.Fatalf("failed creating bill: %v", err)
	}

	// 6. Record Partial Payment
	_, err = db.RecordPayment(&database.Payment{
		BillID:        billID,
		Amount:        5000,
		PaymentDate:   "2026-09-25",
		PaymentMethod: "UPI",
		ReferenceNo:   "UPI123456789",
	})
	if err != nil {
		t.Fatalf("failed creating payment: %v", err)
	}

	// 7. Verify Bill status updated to PARTIAL and balance is accurate
	bill, err := db.GetBillByID(billID)
	if err != nil {
		t.Fatalf("failed getting bill: %v", err)
	}
	if bill.Status != "PARTIAL" {
		t.Errorf("expected status 'PARTIAL', got '%s'", bill.Status)
	}
	if bill.PaidAmount != 5000 {
		t.Errorf("expected paid amount 5000, got %f", bill.PaidAmount)
	}
	if bill.BalanceAmount != 7475 {
		t.Errorf("expected balance amount 7475, got %f", bill.BalanceAmount)
	}

	// 8. Test Backup & Restore preserves preferred_channel
	backup, err := db.ExportBackup()
	if err != nil {
		t.Fatalf("failed exporting backup: %v", err)
	}
	if len(backup.Tenants) == 0 {
		t.Fatalf("backup should contain at least 1 tenant")
	}
	if backup.Tenants[0].PreferredChannel != "WHATSAPP" {
		t.Errorf("expected backup tenant preferred_channel 'WHATSAPP', got '%s'", backup.Tenants[0].PreferredChannel)
	}
}

func TestPINAuthentication(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Initial state: PIN should not be enabled
	if db.IsPINEnabled() {
		t.Errorf("expected PIN to be disabled initially")
	}

	// Verify should return true if no PIN set
	if !db.VerifyPIN("1234") {
		t.Errorf("expected VerifyPIN to return true when PIN disabled")
	}

	// Invalid PIN tests
	if err := db.SetPIN("123"); err == nil {
		t.Errorf("expected error for 3-digit PIN")
	}
	if err := db.SetPIN("12345"); err == nil {
		t.Errorf("expected error for 5-digit PIN")
	}
	if err := db.SetPIN("12a4"); err == nil {
		t.Errorf("expected error for non-digit PIN")
	}

	// Set valid PIN
	if err := db.SetPIN("5678"); err != nil {
		t.Fatalf("failed setting PIN: %v", err)
	}
	if !db.IsPINEnabled() {
		t.Errorf("expected PIN to be enabled after SetPIN")
	}

	// Verify PIN
	if !db.VerifyPIN("5678") {
		t.Errorf("expected VerifyPIN to succeed for correct PIN")
	}
	if db.VerifyPIN("0000") {
		t.Errorf("expected VerifyPIN to fail for incorrect PIN")
	}

	// Disable PIN
	if err := db.DisablePIN(); err != nil {
		t.Fatalf("failed disabling PIN: %v", err)
	}
	if db.IsPINEnabled() {
		t.Errorf("expected PIN to be disabled after DisablePIN")
	}
}

func TestEmailBackupConfig(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Initial default config
	cfg := db.GetEmailBackupConfig()
	if cfg.Port != "587" {
		t.Errorf("expected default port 587, got %s", cfg.Port)
	}
	if cfg.Interval != "daily" {
		t.Errorf("expected default interval daily, got %s", cfg.Interval)
	}
	if cfg.Enabled {
		t.Errorf("expected auto backup disabled initially")
	}

	// Save custom config
	newCfg := database.EmailBackupConfig{
		Host:     "smtp.gmail.com",
		Port:     "587",
		User:     "landlord@gmail.com",
		Pass:     "abcd1234efgh5678",
		To:       "backup@gmail.com",
		Enabled:  true,
		Interval: "weekly",
	}
	if err := db.SaveEmailBackupConfig(newCfg); err != nil {
		t.Fatalf("failed saving email backup config: %v", err)
	}

	saved := db.GetEmailBackupConfig()
	if saved.Host != "smtp.gmail.com" || saved.User != "landlord@gmail.com" || !saved.Enabled || saved.Interval != "weekly" {
		t.Errorf("saved config mismatch: %+v", saved)
	}

}

func TestMultipleCoOccupants(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	tenant := &database.Tenant{
		Name:  "Arun Kumar",
		Phone: "9876543210",
		Email: "arun@example.com",
		CoOccupants: []database.CoOccupant{
			{Name: "Priya Sharma", Phone: "9876543211"},
			{Name: "Rahul Sharma", Phone: "9876543212"},
		},
		IsActive: true,
	}

	id, err := db.CreateTenant(tenant)
	if err != nil {
		t.Fatalf("failed creating tenant with multiple co-occupants: %v", err)
	}

	retrieved, err := db.GetTenantByID(id)
	if err != nil {
		t.Fatalf("failed getting tenant: %v", err)
	}

	if len(retrieved.CoOccupants) != 2 {
		t.Fatalf("expected 2 co-occupants, got %d", len(retrieved.CoOccupants))
	}
	if retrieved.CoOccupants[0].Name != "Priya Sharma" || retrieved.CoOccupants[0].Phone != "9876543211" {
		t.Errorf("co-occupant 0 mismatch: %+v", retrieved.CoOccupants[0])
	}
	if retrieved.CoOccupants[1].Name != "Rahul Sharma" || retrieved.CoOccupants[1].Phone != "9876543212" {
		t.Errorf("co-occupant 1 mismatch: %+v", retrieved.CoOccupants[1])
	}
	if retrieved.CoOccupantName != "Priya Sharma" || retrieved.CoOccupantPhone != "9876543211" {
		t.Errorf("expected legacy co-occupant fields to be populated from first occupant, got %s / %s", retrieved.CoOccupantName, retrieved.CoOccupantPhone)
	}

	// Update co-occupants
	retrieved.CoOccupants = append(retrieved.CoOccupants, database.CoOccupant{
		Name:  "Sneha Patel",
		Phone: "9876543213",
	})
	if err := db.UpdateTenant(retrieved); err != nil {
		t.Fatalf("failed updating tenant: %v", err)
	}

	updated, err := db.GetTenantByID(id)
	if err != nil {
		t.Fatalf("failed retrieving updated tenant: %v", err)
	}
	if len(updated.CoOccupants) != 3 {
		t.Fatalf("expected 3 co-occupants after update, got %d", len(updated.CoOccupants))
	}
	if updated.CoOccupants[2].Name != "Sneha Patel" || updated.CoOccupants[2].Phone != "9876543213" {
		t.Errorf("co-occupant 2 mismatch: %+v", updated.CoOccupants[2])
	}
}

func TestBillDiscount(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	propID, err := db.CreateProperty(&database.Property{
		Name:        "Flat 202",
		DefaultRent: 15000,
	})
	if err != nil {
		t.Fatalf("failed creating property: %v", err)
	}

	tenantID, err := db.CreateTenant(&database.Tenant{
		Name:       "Suresh Nair",
		Phone:      "9876500000",
		PropertyID: &propID,
	})
	if err != nil {
		t.Fatalf("failed creating tenant: %v", err)
	}

	// Create bill with discount: rent 15000, discount 1500 => total 13500
	billID, err := db.CreateBill(&database.Bill{
		TenantID:       tenantID,
		PropertyID:     propID,
		BillingMonth:   "2026-10",
		DueDate:        time.Now().AddDate(0, 1, 0).Format("2006-01-02"),
		BaseRent:       15000,
		DiscountAmount: 1500,
		DiscountReason: "Early bird concession",
	})
	if err != nil {
		t.Fatalf("failed creating bill with discount: %v", err)
	}

	b, err := db.GetBillByID(billID)
	if err != nil {
		t.Fatalf("failed getting bill: %v", err)
	}
	if b.DiscountAmount != 1500 {
		t.Errorf("expected discount 1500, got %f", b.DiscountAmount)
	}
	if b.DiscountReason != "Early bird concession" {
		t.Errorf("expected discount reason 'Early bird concession', got '%s'", b.DiscountReason)
	}
	if b.TotalAmount != 13500 {
		t.Errorf("expected total amount 13500, got %f", b.TotalAmount)
	}

	// Test UpdateBill with adjusted discount
	b.DiscountAmount = 2000
	b.DiscountReason = "Special festival waiver"
	if err := db.UpdateBill(b); err != nil {
		t.Fatalf("failed updating bill: %v", err)
	}

	updated, err := db.GetBillByID(billID)
	if err != nil {
		t.Fatalf("failed getting updated bill: %v", err)
	}
	if updated.DiscountAmount != 2000 {
		t.Errorf("expected discount 2000, got %f", updated.DiscountAmount)
	}
	if updated.TotalAmount != 13000 {
		t.Errorf("expected total amount 13000, got %f", updated.TotalAmount)
	}
}

func TestSessionLifecycleAndPIN(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Initial state: PIN disabled
	if db.IsPINEnabled() {
		t.Errorf("expected PIN to be disabled initially")
	}

	// 2. Set PIN
	if err := db.SetPIN("4321"); err != nil {
		t.Fatalf("failed setting PIN: %v", err)
	}
	if !db.IsPINEnabled() {
		t.Errorf("expected PIN to be enabled")
	}
	if !db.VerifyPIN("4321") {
		t.Errorf("expected PIN 4321 to be verified")
	}
	if db.VerifyPIN("0000") {
		t.Errorf("expected wrong PIN 0000 to fail verification")
	}

	// 3. Create Session
	token, err := db.CreateSession()
	if err != nil {
		t.Fatalf("failed creating session: %v", err)
	}
	if len(token) != 64 {
		t.Errorf("expected 64 character hex session token, got len %d", len(token))
	}

	// 4. Validate Session
	if !db.ValidateSession(token) {
		t.Errorf("expected valid session token to pass validation")
	}
	if db.ValidateSession("invalid-token-12345") {
		t.Errorf("expected invalid session token to fail validation")
	}

	// 5. Revoke Single Session (Logout)
	if err := db.RevokeSession(token); err != nil {
		t.Fatalf("failed revoking session: %v", err)
	}
	if db.ValidateSession(token) {
		t.Errorf("expected revoked session to fail validation")
	}

	// 6. Multiple sessions and RevokeAllSessions
	t1, _ := db.CreateSession()
	t2, _ := db.CreateSession()
	if !db.ValidateSession(t1) || !db.ValidateSession(t2) {
		t.Errorf("expected both sessions to be valid")
	}

	// Setting new PIN revokes all existing sessions
	if err := db.SetPIN("9999"); err != nil {
		t.Fatalf("failed setting new PIN: %v", err)
	}
	if db.ValidateSession(t1) || db.ValidateSession(t2) {
		t.Errorf("expected previous sessions to be revoked on PIN change")
	}

	// Disabling PIN clears sessions and enables free access
	if err := db.DisablePIN(); err != nil {
		t.Fatalf("failed disabling PIN: %v", err)
	}
	if db.IsPINEnabled() {
		t.Errorf("expected PIN to be disabled")
	}
}

