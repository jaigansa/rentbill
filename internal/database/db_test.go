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

func TestPaymentEditDeleteRecalculation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	propID, err := db.CreateProperty(&database.Property{
		Name: "Unit A", UnitType: "Apartment", DefaultRent: 10000,
	})
	if err != nil {
		t.Fatal(err)
	}

	tenantID, err := db.CreateTenant(&database.Tenant{
		Name: "Alice", Phone: "9999988888", PropertyID: &propID,
	})
	if err != nil {
		t.Fatal(err)
	}

	billID, err := db.CreateBill(&database.Bill{
		TenantID: tenantID, PropertyID: propID, BillingMonth: "2026-12",
		DueDate: "2099-12-15", BaseRent: 10000,
	})
	if err != nil {
		t.Fatal(err)
	}

	// 1. Record payment: 4000
	payID, err := db.RecordPayment(&database.Payment{
		BillID: billID, Amount: 4000, PaymentDate: "2026-10-10", PaymentMethod: "UPI",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Verify bill is PARTIAL, paid 4000
	b, err := db.GetBillByID(billID)
	if err != nil || b.PaidAmount != 4000 || b.Status != "PARTIAL" || len(b.Payments) != 1 {
		t.Fatalf("expected paid 4000 PARTIAL with 1 payment, got %v", b)
	}

	// 2. Update payment to 10000 (Full payment)
	err = db.UpdatePayment(&database.Payment{
		ID: payID, Amount: 10000, PaymentDate: "2026-10-10", PaymentMethod: "Bank Transfer", Notes: "Settled",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Verify bill is now PAID
	b, err = db.GetBillByID(billID)
	if err != nil || b.PaidAmount != 10000 || b.Status != "PAID" {
		t.Fatalf("expected paid 10000 PAID, got %v", b)
	}

	// 3. Delete payment
	err = db.DeletePayment(payID)
	if err != nil {
		t.Fatal(err)
	}

	// Verify bill is back to 0 paid and PENDING (due date is in future)
	b, err = db.GetBillByID(billID)
	if err != nil || b.PaidAmount != 0 || b.Status != "PENDING" || len(b.Payments) != 0 {
		t.Fatalf("expected paid 0 PENDING with 0 payments, got %v", b)
	}
}

func TestStrictDeletionOrder(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup: Property -> Tenant -> Bill -> Payment, and Property -> Expense
	propID, err := db.CreateProperty(&database.Property{
		Name: "Unit 301", DefaultRent: 12000,
	})
	if err != nil {
		t.Fatal(err)
	}

	tenantID, err := db.CreateTenant(&database.Tenant{
		Name: "Bob Smith", Phone: "9876543210", PropertyID: &propID,
	})
	if err != nil {
		t.Fatal(err)
	}

	billID, err := db.CreateBill(&database.Bill{
		TenantID: tenantID, PropertyID: propID, BillingMonth: "2026-11",
		DueDate: "2099-12-15", BaseRent: 12000, TotalAmount: 12000,
	})
	if err != nil {
		t.Fatal(err)
	}

	payID, err := db.RecordPayment(&database.Payment{
		BillID: billID, Amount: 6000, PaymentDate: "2026-11-05", PaymentMethod: "UPI",
	})
	if err != nil {
		t.Fatal(err)
	}

	expenseID, err := db.CreateExpense(&database.Expense{
		PropertyID: propID, Title: "Plumbing repair", Category: "Repairs", Amount: 500, ExpenseDate: "2026-11-06",
	})
	if err != nil {
		t.Fatal(err)
	}

	// 1. Trying to delete Property must fail because Tenant, Bill, and Expense exist
	if err := db.DeleteProperty(propID); err == nil {
		t.Fatalf("expected error deleting property with dependencies, got nil")
	}

	// 2. Trying to delete Tenant must fail because Bill exists
	if err := db.DeleteTenant(tenantID); err == nil {
		t.Fatalf("expected error deleting tenant with bills, got nil")
	}

	// 3. Trying to delete Bill must fail because Payment exists
	if err := db.DeleteBill(billID); err == nil {
		t.Fatalf("expected error deleting bill with payments, got nil")
	}

	// 4. Delete Payment in correct bottom-up order -> succeeds
	if err := db.DeletePayment(payID); err != nil {
		t.Fatalf("failed deleting payment: %v", err)
	}

	// 5. Delete Bill now -> succeeds
	if err := db.DeleteBill(billID); err != nil {
		t.Fatalf("failed deleting bill without payments: %v", err)
	}

	// 6. Delete Tenant now -> succeeds
	if err := db.DeleteTenant(tenantID); err != nil {
		t.Fatalf("failed deleting tenant without bills: %v", err)
	}

	// 7. Property still has 1 expense -> Delete Property must still fail
	if err := db.DeleteProperty(propID); err == nil {
		t.Fatalf("expected error deleting property with logged expense, got nil")
	}

	// 8. Delete Expense -> succeeds
	if err := db.DeleteExpense(expenseID); err != nil {
		t.Fatalf("failed deleting expense: %v", err)
	}

	// 9. Now Property has 0 tenants, 0 bills, 0 expenses -> Delete Property succeeds!
	if err := db.DeleteProperty(propID); err != nil {
		t.Fatalf("failed deleting property after all dependencies removed: %v", err)
	}
}

func TestBatchCreateMonthlyBills(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Create Property
	propID, err := db.CreateProperty(&database.Property{
		Name:              "Tower A - Flat 101",
		DefaultRent:       15000,
		ElectricityRate:   9.0,
		WaterBillingType:  "FIXED",
		WaterCharge:       300,
		MaintenanceCharge: 500,
	})
	if err != nil {
		t.Fatalf("failed creating property: %v", err)
	}

	// 2. Create Active Tenant with initial meters & arrears
	tenantID, err := db.CreateTenant(&database.Tenant{
		Name:              "Alice Wonderland",
		Phone:             "9876543210",
		PropertyID:        &propID,
		OpeningArrear:     1200,
		InitialElecMeter:  100,
		InitialWaterMeter: 50,
		IsActive:          true,
	})
	if err != nil {
		t.Fatalf("failed creating tenant: %v", err)
	}

	// 3. Test Preview
	prevItems, err := db.GetBatchBillPreview("2026-11")
	if err != nil {
		t.Fatalf("GetBatchBillPreview error: %v", err)
	}
	if len(prevItems) != 1 {
		t.Fatalf("expected 1 preview item, got %d", len(prevItems))
	}
	if prevItems[0].PrevElectricityMeter != 100 {
		t.Errorf("expected prev elec 100, got %f", prevItems[0].PrevElectricityMeter)
	}

	// 4. Batch generate bill with custom curr EB meter 150 (50 units consumed @ 9/unit = 450)
	currElecVal := 150.0
	entries := []database.BatchBillEntry{
		{
			TenantID:             tenantID,
			CurrElectricityMeter: &currElecVal,
		},
	}
	bills, err := db.BatchCreateMonthlyBills("2026-11", "2026-11-10", entries)
	if err != nil {
		t.Fatalf("BatchCreateMonthlyBills error: %v", err)
	}
	if len(bills) != 1 {
		t.Fatalf("expected 1 bill created, got %d", len(bills))
	}

	b := bills[0]
	if b.TenantID != tenantID {
		t.Errorf("expected tenant ID %d, got %d", tenantID, b.TenantID)
	}
	if b.BaseRent != 15000 {
		t.Errorf("expected BaseRent 15000, got %f", b.BaseRent)
	}
	if b.ElectricityUnits != 50 {
		t.Errorf("expected ElectricityUnits 50, got %f", b.ElectricityUnits)
	}
	if b.ElectricityAmount != 450 {
		t.Errorf("expected ElectricityAmount 450, got %f", b.ElectricityAmount)
	}
	if b.WaterAmount != 300 {
		t.Errorf("expected WaterAmount 300, got %f", b.WaterAmount)
	}
	if b.MaintenanceAmount != 500 {
		t.Errorf("expected MaintenanceAmount 500, got %f", b.MaintenanceAmount)
	}
	if b.PreviousBalance != 1200 {
		t.Errorf("expected PreviousBalance 1200, got %f", b.PreviousBalance)
	}
	expectedTotal := 15000.0 + 450.0 + 300.0 + 500.0 + 1200.0
	if b.TotalAmount != expectedTotal {
		t.Errorf("expected TotalAmount %f, got %f", expectedTotal, b.TotalAmount)
	}
	if b.PrevElectricityMeter != 100 || b.CurrElectricityMeter != 150 {
		t.Errorf("expected elec meter prev=100 curr=150, got prev=%f curr=%f", b.PrevElectricityMeter, b.CurrElectricityMeter)
	}

	// 5. Running batch generation again for the same month must create 0 bills (idempotent / skips already billed)
	billsAgain, err := db.BatchCreateMonthlyBills("2026-11", "2026-11-10", nil)
	if err != nil {
		t.Fatalf("second BatchCreateMonthlyBills error: %v", err)
	}
	if len(billsAgain) != 0 {
		t.Errorf("expected 0 bills created on second run, got %d", len(billsAgain))
	}
}

func TestTenantDocumentsAndDepositsHeldAndAdvanceCredit(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	propID, err := db.CreateProperty(&database.Property{
		Name:              "Villa 101",
		Address:           "101 Palm Grove",
		DefaultRent:       10000,
		ElectricityRate:   9,
		WaterCharge:       200,
		MaintenanceCharge: 500,
	})
	if err != nil {
		t.Fatalf("CreateProperty error: %v", err)
	}

	tenant := &database.Tenant{
		Name:            "Siddharth Rao",
		Phone:           "9876500000",
		PropertyID:      &propID,
		SecurityDeposit: 30000,
		Documents: []database.TenantDocument{
			{
				ID:         "doc_1",
				Name:       "Lease_Agreement_2026.pdf",
				Type:       "AGREEMENT",
				FileType:   "application/pdf",
				Data:       "data:application/pdf;base64,JVBERi0xLjQK...",
				UploadedAt: "2026-11-01",
			},
			{
				ID:         "doc_2",
				Name:       "Aadhaar_Card.jpg",
				Type:       "ID_PROOF",
				FileType:   "image/jpeg",
				Data:       "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
				UploadedAt: "2026-11-01",
			},
		},
		IsActive: true,
	}

	tenantID, err := db.CreateTenant(tenant)
	if err != nil {
		t.Fatalf("CreateTenant error: %v", err)
	}

	// 1. Verify Documents saved and retrieved
	retrieved, err := db.GetTenantByID(tenantID)
	if err != nil {
		t.Fatalf("GetTenantByID error: %v", err)
	}
	if len(retrieved.Documents) != 2 {
		t.Fatalf("expected 2 documents, got %d", len(retrieved.Documents))
	}
	if retrieved.Documents[0].Name != "Lease_Agreement_2026.pdf" || retrieved.Documents[0].Type != "AGREEMENT" {
		t.Errorf("document 0 mismatch: %+v", retrieved.Documents[0])
	}
	if retrieved.Documents[1].Name != "Aadhaar_Card.jpg" || retrieved.Documents[1].Type != "ID_PROOF" {
		t.Errorf("document 1 mismatch: %+v", retrieved.Documents[1])
	}

	// 2. Verify TotalDepositsHeld in Dashboard Summary
	summary, err := db.GetDashboardSummary("")
	if err != nil {
		t.Fatalf("GetDashboardSummary error: %v", err)
	}
	if summary.TotalDepositsHeld != 30000 {
		t.Errorf("expected TotalDepositsHeld 30000, got %f", summary.TotalDepositsHeld)
	}

	// 3. Test Advance Overpayment Credit Roll
	// First month bill: BaseRent 10000 + Water 200 + Maint 500 = 10700
	bill1 := &database.Bill{
		TenantID:          tenantID,
		PropertyID:        propID,
		BillingMonth:      "2026-10",
		DueDate:           "2026-10-10",
		BaseRent:          10000,
		WaterAmount:       200,
		MaintenanceAmount: 500,
		TotalAmount:       10700,
		BalanceAmount:     10700,
		Status:            "PENDING",
	}
	billID, err := db.CreateBill(bill1)
	if err != nil {
		t.Fatalf("CreateBill error: %v", err)
	}

	// Tenant overpays: pays 12700 (2000 extra advance overpayment)
	_, err = db.RecordPayment(&database.Payment{
		BillID:        billID,
		Amount:        12700,
		PaymentDate:   "2026-10-05",
		PaymentMethod: "UPI",
	})
	if err != nil {
		t.Fatalf("RecordPayment error: %v", err)
	}

	// Verify bill balance is -2000
	b1, err := db.GetBillByID(billID)
	if err != nil {
		t.Fatalf("GetBillByID error: %v", err)
	}
	if b1.BalanceAmount != -2000 {
		t.Errorf("expected negative balance -2000 for advance overpayment, got %f", b1.BalanceAmount)
	}

	// Preview next month batch bill
	previews, err := db.GetBatchBillPreview("2026-11")
	if err != nil {
		t.Fatalf("GetBatchBillPreview error: %v", err)
	}
	if len(previews) != 1 {
		t.Fatalf("expected 1 preview, got %d", len(previews))
	}
	p := previews[0]
	if p.PreviousBalance != -2000 {
		t.Errorf("expected PreviousBalance to carry over -2000 advance credit, got %f", p.PreviousBalance)
	}

	// Expected batch total: BaseRent 10000 + Water 200 + Maint 500 + (-2000) = 8700
	expectedBatchTotal := 10000.0 + 200.0 + 500.0 - 2000.0

	// Batch create next month bills and verify total amount
	createdBills, err := db.BatchCreateMonthlyBills("2026-11", "2026-11-10", nil)
	if err != nil {
		t.Fatalf("BatchCreateMonthlyBills error: %v", err)
	}
	if len(createdBills) != 1 {
		t.Fatalf("expected 1 created bill, got %d", len(createdBills))
	}
	if createdBills[0].PreviousBalance != -2000 {
		t.Errorf("expected created bill PreviousBalance -2000, got %f", createdBills[0].PreviousBalance)
	}
	if createdBills[0].TotalAmount != expectedBatchTotal {
		t.Errorf("expected created bill TotalAmount %f, got %f", expectedBatchTotal, createdBills[0].TotalAmount)
	}
}
