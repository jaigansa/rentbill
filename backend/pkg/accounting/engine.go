package accounting

import (
	"errors"
	"math"
)

// Currency amounts are in paise (1 INR = 100 paise) to ensure exact integer arithmetic
// Rates may have fractional paise, so we use float64 for rate multiplication and round to nearest paise

type TenantBillingProfile struct {
	BaseRent           int64   `json:"base_rent"`
	MaintCharge        int64   `json:"maint_charge"`
	EBUnitPrice        float64 `json:"eb_per_unit_price"`
	InitialEBReading   int64   `json:"initial_eb_reading"`
	WaterCalcMode      string  `json:"water_calc_mode"` // "FIXED" or "METERED"
	WaterFixedCharge   int64   `json:"water_fixed_charge"`
	WaterUnitPrice     float64 `json:"water_per_unit_price"`
	InitialWater       int64   `json:"initial_water_reading"`
	PendingArrears     int64   `json:"pending_arrears"`
}

type BillCalculationInput struct {
	BaseRentOverride *int64  `json:"base_rent_override,omitempty"`
	PrevEBReading    int64   `json:"prev_eb_reading"`
	CurrEBReading    int64   `json:"curr_eb_reading"`
	PrevWaterReading int64   `json:"prev_water_reading"`
	CurrWaterReading int64   `json:"curr_water_reading"`
	LateFee          int64   `json:"late_fee"`
	DiscountAmount   int64   `json:"discount_amount"`
	Others           int64   `json:"others"`
	ArrearsOverride  *int64  `json:"arrears_override,omitempty"`
}

type BillCalculationResult struct {
	RentAmount      int64  `json:"rent_amount"`
	MaintAmount     int64  `json:"maint_amount"`
	PrevEBReading   int64  `json:"prev_eb_reading"`
	CurrEBReading   int64  `json:"curr_eb_reading"`
	EBUnits         int64  `json:"eb_units"`
	EBAmount        int64  `json:"eb_amount"`
	PrevWater       int64  `json:"prev_water_reading"`
	CurrWater       int64  `json:"curr_water_reading"`
	WaterUnits      int64  `json:"water_units"`
	WaterAmount     int64  `json:"water_amount"`
	ArrearsIncluded int64  `json:"arrears_included"`
	LateFee         int64  `json:"late_fee"`
	DiscountAmount  int64  `json:"discount_amount"`
	Others          int64  `json:"others"`
	GrossAmount     int64  `json:"gross_amount"`
	NetAmount       int64  `json:"net_amount"`
	PaidAmount      int64  `json:"paid_amount"`
	BalanceAmount   int64  `json:"balance_amount"`
	Status          string `json:"status"`
}

type LedgerSummary struct {
	TotalBilled     int64 `json:"total_billed"`
	TotalWrittenOff int64 `json:"total_written_off"`
	TotalCollected  int64 `json:"total_collected"`
	TotalExpenses   int64 `json:"total_expenses"`
	TotalWithdrawn  int64 `json:"total_withdrawn"`
	Outstanding     int64 `json:"outstanding"`
	NetCashFlow     int64 `json:"net_cash_flow"`
}

type BillRecord struct {
	ID              int64  `json:"id"`
	NetAmount       int64  `json:"net_amount"`
	PaidAmount      int64  `json:"paid_amount"`
	WriteOffAmount  int64  `json:"write_off_amount"`
	Status          string `json:"status"`
	IsVoid          bool   `json:"is_void"`
	DeletedAt       string `json:"deleted_at"`
}

type PaymentRecord struct {
	ID          int64  `json:"id"`
	BillID      *int64 `json:"bill_id"`
	Amount      int64  `json:"amount"`
	ProofStatus string `json:"proof_status"`
	ReversedAt  string `json:"reversed_at"`
	DeletedAt   string `json:"deleted_at"`
}

type ExpenseRecord struct {
	ID        int64  `json:"id"`
	Amount    int64  `json:"amount"`
	DeletedAt string `json:"deleted_at"`
}

type WithdrawalRecord struct {
	ID        int64  `json:"id"`
	Amount    int64  `json:"amount"`
	DeletedAt string `json:"deleted_at"`
}

// CalculateBill performs exact, server-authoritative billing arithmetic
func CalculateBill(profile TenantBillingProfile, in BillCalculationInput) (*BillCalculationResult, error) {
	rent := profile.BaseRent
	if in.BaseRentOverride != nil && *in.BaseRentOverride >= 0 {
		rent = *in.BaseRentOverride
	}

	maint := profile.MaintCharge
	if maint < 0 {
		maint = 0
	}

	// 1. Electricity (EB)
	currEB := in.CurrEBReading
	if currEB < in.PrevEBReading {
		currEB = in.PrevEBReading
	}
	ebUnits := currEB - in.PrevEBReading
	// Rate is in rupees per unit, convert result to paise (* 100)
	ebRate := profile.EBUnitPrice
	if ebRate <= 0 {
		ebRate = 8.00 // Default ₹8/unit
	}
	ebAmount := int64(math.Round(float64(ebUnits) * ebRate * 100.0))

	// 2. Water
	var waterUnits int64 = 0
	var waterAmount int64 = 0

	if profile.WaterCalcMode == "METERED" {
		currWater := in.CurrWaterReading
		if currWater < in.PrevWaterReading {
			currWater = in.PrevWaterReading
		}
		waterUnits = currWater - in.PrevWaterReading
		wRate := profile.WaterUnitPrice
		waterAmount = int64(math.Round(float64(waterUnits) * wRate * 100.0))
	} else {
		// FIXED flat charge
		waterAmount = profile.WaterFixedCharge
		if waterAmount < 0 {
			waterAmount = 0
		}
		// If stored as whole rupees (< 500), convert to paise
		if waterAmount > 0 && waterAmount < 500 {
			waterAmount = waterAmount * 100
		}
	}

	// 3. Arrears
	arrears := profile.PendingArrears
	if in.ArrearsOverride != nil {
		arrears = *in.ArrearsOverride
	}

	lateFee := in.LateFee
	if lateFee < 0 {
		lateFee = 0
	}

	discount := in.DiscountAmount
	if discount < 0 {
		discount = 0
	}

	others := in.Others
	if others < 0 {
		others = 0
	}

	// 4. Totals
	gross := rent + maint + ebAmount + waterAmount + others
	net := gross + arrears + lateFee - discount
	if net < 0 {
		net = 0
	}

	status := DeriveBillStatus(net, 0, false)

	return &BillCalculationResult{
		RentAmount:      rent,
		MaintAmount:     maint,
		PrevEBReading:   in.PrevEBReading,
		CurrEBReading:   currEB,
		EBUnits:         ebUnits,
		EBAmount:        ebAmount,
		PrevWater:       in.PrevWaterReading,
		CurrWater:       in.CurrWaterReading,
		WaterUnits:      waterUnits,
		WaterAmount:     waterAmount,
		ArrearsIncluded: arrears,
		LateFee:         lateFee,
		DiscountAmount:  discount,
		Others:          others,
		GrossAmount:     gross,
		NetAmount:       net,
		PaidAmount:      0,
		BalanceAmount:   net,
		Status:          status,
	}, nil
}

// DeriveBillStatus computes invoice state according to accounting rules
func DeriveBillStatus(netAmount, paidAmount int64, isVoid bool) string {
	if isVoid {
		return "VOID"
	}
	if netAmount <= 0 {
		if paidAmount > 0 {
			return "PARTIAL"
		}
		return "PAID"
	}
	if paidAmount >= netAmount {
		return "PAID"
	}
	if paidAmount > 0 {
		return "PARTIAL"
	}
	return "UNPAID"
}

// ReconcileLedger computes exact billed vs collected vs expenses ledger
func ReconcileLedger(bills []BillRecord, payments []PaymentRecord, expenses []ExpenseRecord, withdrawals []WithdrawalRecord) LedgerSummary {
	var totalBilled int64 = 0
	var totalWrittenOff int64 = 0

	for _, b := range bills {
		if b.DeletedAt != "" || b.IsVoid || b.Status == "VOID" {
			continue
		}
		totalBilled += b.NetAmount
		totalWrittenOff += b.WriteOffAmount
	}

	var totalCollected int64 = 0
	for _, p := range payments {
		if p.DeletedAt != "" || p.ReversedAt != "" {
			continue
		}
		proof := p.ProofStatus
		if proof == "" || proof == "NONE" || proof == "VERIFIED" {
			totalCollected += p.Amount
		}
	}

	var totalExpenses int64 = 0
	for _, e := range expenses {
		if e.DeletedAt != "" {
			continue
		}
		totalExpenses += e.Amount
	}

	var totalWithdrawn int64 = 0
	for _, w := range withdrawals {
		if w.DeletedAt != "" {
			continue
		}
		totalWithdrawn += w.Amount
	}

	outstanding := totalBilled - totalWrittenOff - totalCollected
	netCashFlow := totalCollected - totalExpenses - totalWithdrawn

	return LedgerSummary{
		TotalBilled:     totalBilled,
		TotalWrittenOff: totalWrittenOff,
		TotalCollected:  totalCollected,
		TotalExpenses:   totalExpenses,
		TotalWithdrawn:  totalWithdrawn,
		Outstanding:     outstanding,
		NetCashFlow:     netCashFlow,
	}
}

// ApplyPaymentToBill checks payment validity and calculates resulting bill balance and status
func ApplyPaymentToBill(netAmount, currentPaid, paymentAmount int64) (newPaid, newBalance int64, newStatus string, err error) {
	if paymentAmount <= 0 {
		return 0, 0, "", errors.New("payment amount must be greater than zero")
	}

	newPaid = currentPaid + paymentAmount
	newBalance = netAmount - newPaid
	if newBalance < 0 {
		newBalance = 0
	}
	newStatus = DeriveBillStatus(netAmount, newPaid, false)
	return newPaid, newBalance, newStatus, nil
}
