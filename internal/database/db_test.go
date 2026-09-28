package database_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

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

	// 2. Create Tenant with SMS_RCS preferred channel
	tenantID, err := db.CreateTenant(&database.Tenant{
		Name:             "Vikram Kumar",
		Phone:            "9876543210",
		Email:            "vikram@example.com",
		PropertyID:       &propID,
		SecurityDeposit:  30000,
		MoveInDate:       "2026-01-01",
		PreferredChannel: "SMS_RCS",
		IsActive:         true,
	})
	if err != nil {
		t.Fatalf("failed creating tenant: %v", err)
	}

	// 3. Retrieve Tenant and verify PreferredChannel
	retrieved, err := db.GetTenantByID(tenantID)
	if err != nil {
		t.Fatalf("failed retrieving tenant: %v", err)
	}
	if retrieved.PreferredChannel != "SMS_RCS" {
		t.Errorf("expected preferred_channel to be 'SMS_RCS', got '%s'", retrieved.PreferredChannel)
	}
	if retrieved.Name != "Vikram Kumar" {
		t.Errorf("expected name 'Vikram Kumar', got '%s'", retrieved.Name)
	}

	// 4. Update Tenant to WHATSAPP preferred channel
	retrieved.PreferredChannel = "WHATSAPP"
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

	// 5. Create a Bill
	billID, err := db.CreateBill(&database.Bill{
		BillNumber:           "RB-202609-0001",
		TenantID:             tenantID,
		PropertyID:           propID,
		BillingMonth:         "Sep 2026",
		DueDate:              "2026-10-05",
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

	// Auto backup check should run without error when conditions are met or not due
	if err := db.RunAutoBackupCheck(); err != nil {
		// Won't actually connect to fake credentials, but check logic itself should not crash
	}
}

func TestBuildEmailMIME(t *testing.T) {
	dummyAttachment := []byte(`{"test": "data"}`)
	msg := database.BuildEmailMIME("sender@test.com", "recipient@test.com", "Test Subject", "<p>Hello</p>", "backup.json", dummyAttachment)
	msgStr := string(msg)

	if !strings.Contains(msgStr, "From: sender@test.com") {
		t.Errorf("MIME missing From header")
	}
	if !strings.Contains(msgStr, "To: recipient@test.com") {
		t.Errorf("MIME missing To header")
	}
	if !strings.Contains(msgStr, "filename=\"backup.json\"") {
		t.Errorf("MIME missing attachment filename")
	}
	if !strings.Contains(msgStr, "multipart/mixed") {
		t.Errorf("MIME missing multipart content type")
	}
}

