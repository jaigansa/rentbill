package accounting

import (
	"testing"
)

func TestCalculateBill(t *testing.T) {
	profile := TenantBillingProfile{
		BaseRent:         1500000, // ₹15,000.00
		MaintCharge:      100000,  // ₹1,000.00
		EBUnitPrice:      8.50,    // ₹8.50 per unit
		InitialEBReading: 100,
		WaterCalcMode:    "METERED",
		WaterUnitPrice:   15.00, // ₹15.00 per unit
		InitialWater:     50,
		PendingArrears:   200000, // ₹2,000.00
	}

	input := BillCalculationInput{
		PrevEBReading:    100,
		CurrEBReading:    150, // 50 units * 8.50 = ₹425.00 = 42,500 paise
		PrevWaterReading: 50,
		CurrWaterReading: 60, // 10 units * 15.00 = ₹150.00 = 15,000 paise
		LateFee:          5000,  // ₹50.00
		DiscountAmount:   10000, // ₹100.00
		Others:           2000,  // ₹20.00
	}

	res, err := CalculateBill(profile, input)
	if err != nil {
		t.Fatalf("CalculateBill returned unexpected error: %v", err)
	}

	if res.EBUnits != 50 {
		t.Errorf("Expected 50 EB units, got %d", res.EBUnits)
	}
	if res.EBAmount != 42500 {
		t.Errorf("Expected 42,500 paise for EB, got %d", res.EBAmount)
	}
	if res.WaterUnits != 10 {
		t.Errorf("Expected 10 water units, got %d", res.WaterUnits)
	}
	if res.WaterAmount != 15000 {
		t.Errorf("Expected 15,000 paise for Water, got %d", res.WaterAmount)
	}

	// Gross = Rent (1,500,000) + Maint (100,000) + EB (42,500) + Water (15,000) + Others (2,000) = 1,659,500
	expectedGross := int64(1500000 + 100000 + 42500 + 15000 + 2000)
	if res.GrossAmount != expectedGross {
		t.Errorf("Expected gross %d, got %d", expectedGross, res.GrossAmount)
	}

	// Net = Gross (1,659,500) + Arrears (200,000) + LateFee (5,000) - Discount (10,000) = 1,854,500
	expectedNet := expectedGross + 200000 + 5000 - 10000
	if res.NetAmount != expectedNet {
		t.Errorf("Expected net %d, got %d", expectedNet, res.NetAmount)
	}
	if res.Status != "UNPAID" {
		t.Errorf("Expected initial status UNPAID, got %s", res.Status)
	}
}

func TestDeriveBillStatus(t *testing.T) {
	tests := []struct {
		net    int64
		paid   int64
		isVoid bool
		want   string
	}{
		{net: 100000, paid: 0, isVoid: false, want: "UNPAID"},
		{net: 100000, paid: 50000, isVoid: false, want: "PARTIAL"},
		{net: 100000, paid: 100000, isVoid: false, want: "PAID"},
		{net: 100000, paid: 120000, isVoid: false, want: "PAID"},
		{net: 100000, paid: 100000, isVoid: true, want: "VOID"},
		{net: 0, paid: 0, isVoid: false, want: "PAID"},
		{net: 0, paid: 5000, isVoid: false, want: "PARTIAL"},
	}

	for _, tc := range tests {
		got := DeriveBillStatus(tc.net, tc.paid, tc.isVoid)
		if got != tc.want {
			t.Errorf("DeriveBillStatus(net=%d, paid=%d, void=%v) = %s, want %s", tc.net, tc.paid, tc.isVoid, got, tc.want)
		}
	}
}

func TestReconcileLedger(t *testing.T) {
	bills := []BillRecord{
		{ID: 1, NetAmount: 10000, PaidAmount: 10000, Status: "PAID"},
		{ID: 2, NetAmount: 15000, PaidAmount: 5000, Status: "PARTIAL"},
		{ID: 3, NetAmount: 5000, Status: "VOID", IsVoid: true}, // Should be excluded
	}

	payments := []PaymentRecord{
		{ID: 1, Amount: 10000, ProofStatus: "VERIFIED"},
		{ID: 2, Amount: 5000, ProofStatus: "NONE"},
		{ID: 3, Amount: 2000, ProofStatus: "REJECTED"}, // Should be excluded
		{ID: 4, Amount: 1000, ReversedAt: "2026-09-22T00:00:00Z"}, // Should be excluded
	}

	expenses := []ExpenseRecord{
		{ID: 1, Amount: 3000},
		{ID: 2, Amount: 1000, DeletedAt: "2026-09-22T00:00:00Z"}, // Excluded
	}

	withdrawals := []WithdrawalRecord{
		{ID: 1, Amount: 4000},
	}

	ledger := ReconcileLedger(bills, payments, expenses, withdrawals)

	// Total Billed = 10000 + 15000 = 25000
	if ledger.TotalBilled != 25000 {
		t.Errorf("Expected TotalBilled 25000, got %d", ledger.TotalBilled)
	}

	// Total Collected = 10000 + 5000 = 15000
	if ledger.TotalCollected != 15000 {
		t.Errorf("Expected TotalCollected 15000, got %d", ledger.TotalCollected)
	}

	// Total Expenses = 3000
	if ledger.TotalExpenses != 3000 {
		t.Errorf("Expected TotalExpenses 3000, got %d", ledger.TotalExpenses)
	}

	// Total Withdrawn = 4000
	if ledger.TotalWithdrawn != 4000 {
		t.Errorf("Expected TotalWithdrawn 4000, got %d", ledger.TotalWithdrawn)
	}

	// Outstanding = 25000 - 0 - 15000 = 10000
	if ledger.Outstanding != 10000 {
		t.Errorf("Expected Outstanding 10000, got %d", ledger.Outstanding)
	}

	// Net Cash Flow = Collected (15000) - Expenses (3000) - Withdrawn (4000) = 8000
	if ledger.NetCashFlow != 8000 {
		t.Errorf("Expected NetCashFlow 8000, got %d", ledger.NetCashFlow)
	}
}
