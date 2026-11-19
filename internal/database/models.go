package database

import (
	"fmt"
	"time"
)

type Property struct {
	ID                int64   `json:"id"`
	Name              string  `json:"name"`
	Address           string  `json:"address"`
	UnitType          string  `json:"unit_type"` // Apartment, Studio, House, Shop, Room
	DefaultRent       float64 `json:"default_rent"`
	ElectricityRate   float64 `json:"electricity_rate"`
	WaterBillingType  string  `json:"water_billing_type"` // FIXED or METER
	WaterCharge       float64 `json:"water_charge"`
	WaterRate         float64 `json:"water_rate"`
	MaintenanceCharge float64 `json:"maintenance_charge"`
	CreatedAt         string  `json:"created_at"`
	TenantCount       int     `json:"tenant_count,omitempty"`
	TotalExpenses     float64 `json:"total_expenses,omitempty"`
	ExpenseCount      int     `json:"expense_count,omitempty"`
	TotalIncome       float64 `json:"total_income,omitempty"`
	NetProfit         float64 `json:"net_profit,omitempty"`
}

type Expense struct {
	ID            int64   `json:"id"`
	PropertyID    int64   `json:"property_id"`
	PropertyName  string  `json:"property_name,omitempty"`
	Title         string  `json:"title"`
	Category      string  `json:"category"`
	Amount        float64 `json:"amount"`
	ExpenseDate   string  `json:"expense_date"`
	PaidTo        string  `json:"paid_to"`
	PaymentMethod string  `json:"payment_method"`
	Notes         string  `json:"notes"`
	CreatedAt     string  `json:"created_at"`
}

type CoOccupant struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type TenantDocument struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`      // AGREEMENT, ID_PROOF, POLICE_VERIFICATION, OTHER
	FileType   string `json:"file_type"` // application/pdf, image/jpeg, image/png
	Data       string `json:"data"`      // Base64 data URL
	UploadedAt string `json:"uploaded_at"`
}

type Tenant struct {
	ID                int64            `json:"id"`
	Name              string           `json:"name"`
	Phone             string           `json:"phone"`
	Email             string           `json:"email"`
	PropertyID        *int64           `json:"property_id"`
	PropertyName      string           `json:"property_name,omitempty"`
	SecurityDeposit   float64          `json:"security_deposit"`
	OpeningArrear     float64          `json:"opening_arrear"`
	MoveInDate        string           `json:"move_in_date"`
	PaymentUPI        string           `json:"payment_upi"`
	PaymentBankName   string           `json:"payment_bank_name"`
	PaymentAccountNo  string           `json:"payment_account_no"`
	PaymentIFSC       string           `json:"payment_ifsc"`
	InitialElecMeter  float64          `json:"initial_elec_meter"`
	InitialWaterMeter float64          `json:"initial_water_meter"`
	PreferredChannel  string           `json:"preferred_channel"` // SMS_RCS, WHATSAPP, BOTH
	CoOccupants       []CoOccupant     `json:"co_occupants"`
	CoOccupantName    string           `json:"co_occupant_name"`
	CoOccupantPhone   string           `json:"co_occupant_phone"`
	IsActive          bool             `json:"is_active"`
	Photo             string           `json:"photo"`
	Documents         []TenantDocument `json:"documents,omitempty"`
	TotalPaid         float64          `json:"total_paid"`
	TotalDue          float64          `json:"total_due"`
	CreatedAt         string           `json:"created_at"`
}

type Bill struct {
	ID                   int64     `json:"id"`
	BillNumber           string    `json:"bill_number"`
	TenantID             int64     `json:"tenant_id"`
	TenantName           string    `json:"tenant_name,omitempty"`
	TenantPhone          string    `json:"tenant_phone,omitempty"`
	PaymentUPI           string    `json:"payment_upi,omitempty"`
	PaymentBankName      string    `json:"payment_bank_name,omitempty"`
	PaymentAccountNo     string    `json:"payment_account_no,omitempty"`
	PaymentIFSC          string    `json:"payment_ifsc,omitempty"`
	PropertyID           int64     `json:"property_id"`
	PropertyName         string    `json:"property_name,omitempty"`
	BillingMonth         string    `json:"billing_month"`
	BillingPeriodStart   string    `json:"billing_period_start"`
	BillingPeriodEnd     string    `json:"billing_period_end"`
	DueDate              string    `json:"due_date"`
	BaseRent             float64   `json:"base_rent"`
	PrevElectricityMeter float64   `json:"prev_electricity_meter"`
	CurrElectricityMeter float64   `json:"curr_electricity_meter"`
	ElectricityRate      float64   `json:"electricity_rate"`
	ElectricityUnits     float64   `json:"electricity_units"`
	ElectricityAmount    float64   `json:"electricity_amount"`
	WaterBillingType     string    `json:"water_billing_type"` // FIXED or METER
	PrevWaterMeter       float64   `json:"prev_water_meter"`
	CurrWaterMeter       float64   `json:"curr_water_meter"`
	WaterRate            float64   `json:"water_rate"`
	WaterUnits           float64   `json:"water_units"`
	WaterAmount          float64   `json:"water_amount"`
	MaintenanceAmount    float64   `json:"maintenance_amount"`
	OtherCharges         float64   `json:"other_charges"`
	OtherChargesDesc     string    `json:"other_charges_desc"`
	DiscountAmount       float64   `json:"discount_amount"`
	DiscountReason       string    `json:"discount_reason"`
	PreviousBalance      float64   `json:"previous_balance"`
	TotalAmount          float64   `json:"total_amount"`
	PaidAmount           float64   `json:"paid_amount"`
	BalanceAmount        float64   `json:"balance_amount"`
	Status               string    `json:"status"`
	Notes                string    `json:"notes"`
	CreatedAt            string    `json:"created_at"`
	Payments             []Payment `json:"payments,omitempty"`
}

type Payment struct {
	ID            int64   `json:"id"`
	BillID        int64   `json:"bill_id"`
	BillNumber    string  `json:"bill_number,omitempty"`
	TenantName    string  `json:"tenant_name,omitempty"`
	PropertyName  string  `json:"property_name,omitempty"`
	Amount        float64 `json:"amount"`
	PaymentDate   string  `json:"payment_date"`
	PaymentMethod string  `json:"payment_method"`
	ReferenceNo   string  `json:"reference_no"`
	Notes         string  `json:"notes"`
	CreatedAt     string  `json:"created_at"`
}

type LedgerEntry struct {
	ID             int64   `json:"id"`
	Type           string  `json:"type"` // "BILL" or "PAYMENT"
	Date           string  `json:"date"`
	BillID         int64   `json:"bill_id"`
	BillNumber     string  `json:"bill_number"`
	BillingMonth   string  `json:"billing_month,omitempty"`
	Description    string  `json:"description"`
	Debit          float64 `json:"debit"`  // Billed amount (increases dues)
	Credit         float64 `json:"credit"` // Paid amount (reduces dues)
	RunningBalance float64 `json:"running_balance"`
	PaymentMethod  string  `json:"payment_method,omitempty"`
	ReferenceNo    string  `json:"reference_no,omitempty"`
	Status         string  `json:"status,omitempty"`
}

type TenantLedger struct {
	Tenant         Tenant        `json:"tenant"`
	TotalBilled    float64       `json:"total_billed"`
	TotalPaid      float64       `json:"total_paid"`
	CurrentBalance float64       `json:"current_balance"`
	Entries        []LedgerEntry `json:"entries"`
}

type BatchBillEntry struct {
	TenantID             int64    `json:"tenant_id"`
	CurrElectricityMeter *float64 `json:"curr_electricity_meter,omitempty"`
	CurrWaterMeter       *float64 `json:"curr_water_meter,omitempty"`
}

type BatchBillPreviewItem struct {
	TenantID             int64   `json:"tenant_id"`
	TenantName           string  `json:"tenant_name"`
	TenantPhone          string  `json:"tenant_phone"`
	PropertyID           int64   `json:"property_id"`
	PropertyName         string  `json:"property_name"`
	DefaultRent          float64 `json:"default_rent"`
	ElectricityRate      float64 `json:"electricity_rate"`
	PrevElectricityMeter float64 `json:"prev_electricity_meter"`
	WaterBillingType     string  `json:"water_billing_type"`
	WaterCharge          float64 `json:"water_charge"`
	WaterRate            float64 `json:"water_rate"`
	PrevWaterMeter       float64 `json:"prev_water_meter"`
	MaintenanceCharge    float64 `json:"maintenance_charge"`
	PreviousBalance      float64 `json:"previous_balance"`
}

type DashboardAlerts struct {
	OverdueBills    []Bill   `json:"overdue_bills"`
	UnbilledTenants []Tenant `json:"unbilled_tenants"`
}

type DashboardSummary struct {
	TotalProperties    int64           `json:"total_properties"`
	TotalBilled        float64         `json:"total_billed"`
	TotalCollected     float64         `json:"total_collected"`
	TotalPending       float64         `json:"total_pending"`
	TotalOverdue       float64         `json:"total_overdue"`
	TotalExpenses      float64         `json:"total_expenses"`
	NetProfit          float64         `json:"net_profit"`
	CollectionRate     float64         `json:"collection_rate"`
	TotalDepositsHeld  float64         `json:"total_deposits_held"`
	ActiveTenantsCount int             `json:"active_tenants_count"`
	ActionRequired     DashboardAlerts `json:"action_required"`
	AvailableMonths    []string        `json:"available_months"`
	SelectedMonth      string          `json:"selected_month"`
}

func GenerateBillNumber() string {
	return fmt.Sprintf("RB-%s-%06d", time.Now().Format("200601"), time.Now().UnixNano()%1000000)
}
