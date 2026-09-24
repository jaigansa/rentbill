package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func InitDB(dataSourceName string) (*DB, error) {
	db, err := sql.Open("sqlite", dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("error opening db: %w", err)
	}

	// Performance pragmas for SQLite
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA foreign_keys = ON;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			return nil, fmt.Errorf("failed pragma %s: %w", p, err)
		}
	}

	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("failed creating tables: %w", err)
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS properties (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		unit_type TEXT DEFAULT 'Apartment',
		default_rent REAL DEFAULT 0.0,
		electricity_rate REAL DEFAULT 0.0,
		water_billing_type TEXT DEFAULT 'FIXED', -- FIXED or METER
		water_charge REAL DEFAULT 0.0,
		water_rate REAL DEFAULT 0.0,
		maintenance_charge REAL DEFAULT 0.0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS tenants (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		phone TEXT NOT NULL,
		email TEXT,
		property_id INTEGER,
		security_deposit REAL DEFAULT 0.0,
		move_in_date TEXT,
		payment_upi TEXT DEFAULT '',
		payment_bank_name TEXT DEFAULT '',
		payment_account_no TEXT DEFAULT '',
		payment_ifsc TEXT DEFAULT '',
		initial_elec_meter REAL DEFAULT 0.0,
		initial_water_meter REAL DEFAULT 0.0,
		is_active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS bills (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		bill_number TEXT UNIQUE,
		tenant_id INTEGER NOT NULL,
		property_id INTEGER NOT NULL,
		billing_month TEXT NOT NULL, -- e.g. '2026-09' or 'Sep 2026'
		billing_period_start TEXT,
		billing_period_end TEXT,
		due_date TEXT NOT NULL,
		base_rent REAL DEFAULT 0.0,
		prev_electricity_meter REAL DEFAULT 0.0,
		curr_electricity_meter REAL DEFAULT 0.0,
		electricity_rate REAL DEFAULT 0.0,
		electricity_units REAL DEFAULT 0.0,
		electricity_amount REAL DEFAULT 0.0,
		water_billing_type TEXT DEFAULT 'FIXED', -- FIXED or METER
		prev_water_meter REAL DEFAULT 0.0,
		curr_water_meter REAL DEFAULT 0.0,
		water_rate REAL DEFAULT 0.0,
		water_units REAL DEFAULT 0.0,
		water_amount REAL DEFAULT 0.0,
		maintenance_amount REAL DEFAULT 0.0,
		other_charges REAL DEFAULT 0.0,
		other_charges_desc TEXT,
		previous_balance REAL DEFAULT 0.0,
		total_amount REAL NOT NULL,
		paid_amount REAL DEFAULT 0.0,
		status TEXT DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, OVERDUE
		notes TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
		FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS payments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		bill_id INTEGER NOT NULL,
		amount REAL NOT NULL,
		payment_date TEXT NOT NULL,
		payment_method TEXT DEFAULT 'UPI', -- Cash, UPI, Bank Transfer, Cheque
		reference_no TEXT,
		notes TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS expenses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		property_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		amount REAL NOT NULL,
		expense_date TEXT NOT NULL,
		paid_to TEXT DEFAULT '',
		payment_method TEXT DEFAULT 'Cash', -- Cash, UPI, Bank Transfer, Cheque
		notes TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`

	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// Dynamic column migrations for existing SQLite database files
	migrations := []string{
		"ALTER TABLE properties ADD COLUMN water_billing_type TEXT DEFAULT 'FIXED'",
		"ALTER TABLE properties ADD COLUMN water_rate REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN water_billing_type TEXT DEFAULT 'FIXED'",
		"ALTER TABLE bills ADD COLUMN prev_water_meter REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN curr_water_meter REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN water_rate REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN water_units REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN previous_balance REAL DEFAULT 0.0",
		"ALTER TABLE tenants ADD COLUMN payment_upi TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_bank_name TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_account_no TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_ifsc TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN initial_elec_meter REAL DEFAULT 0.0",
		"ALTER TABLE tenants ADD COLUMN initial_water_meter REAL DEFAULT 0.0",
	}
	for _, m := range migrations {
		_, _ = db.Exec(m) // Ignore if column already exists
	}
	return nil
}

type Property struct {
	ID                int64   `json:"id"`
	Name              string  `json:"name"`
	Address           string  `json:"address"`
	UnitType          string  `json:"unit_type"`
	DefaultRent       float64 `json:"default_rent"`
	ElectricityRate   float64 `json:"electricity_rate"`
	WaterBillingType  string  `json:"water_billing_type"` // FIXED or METER
	WaterCharge       float64 `json:"water_charge"`       // For fixed
	WaterRate         float64 `json:"water_rate"`         // For meter (per unit/kL)
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

type Tenant struct {
	ID                int64   `json:"id"`
	Name              string  `json:"name"`
	Phone             string  `json:"phone"`
	Email             string  `json:"email"`
	PropertyID        *int64  `json:"property_id"`
	PropertyName      string  `json:"property_name,omitempty"`
	SecurityDeposit   float64 `json:"security_deposit"`
	MoveInDate        string  `json:"move_in_date"`
	PaymentUPI        string  `json:"payment_upi"`
	PaymentBankName   string  `json:"payment_bank_name"`
	PaymentAccountNo  string  `json:"payment_account_no"`
	PaymentIFSC       string  `json:"payment_ifsc"`
	InitialElecMeter  float64 `json:"initial_elec_meter"`
	InitialWaterMeter float64 `json:"initial_water_meter"`
	IsActive          bool    `json:"is_active"`
	CreatedAt         string  `json:"created_at"`
}

type Bill struct {
	ID                   int64   `json:"id"`
	BillNumber           string  `json:"bill_number"`
	TenantID             int64   `json:"tenant_id"`
	TenantName           string  `json:"tenant_name,omitempty"`
	TenantPhone          string  `json:"tenant_phone,omitempty"`
	PaymentUPI           string  `json:"payment_upi,omitempty"`
	PaymentBankName      string  `json:"payment_bank_name,omitempty"`
	PaymentAccountNo     string  `json:"payment_account_no,omitempty"`
	PaymentIFSC          string  `json:"payment_ifsc,omitempty"`
	PropertyID           int64   `json:"property_id"`
	PropertyName         string  `json:"property_name,omitempty"`
	BillingMonth         string  `json:"billing_month"`
	BillingPeriodStart   string  `json:"billing_period_start"`
	BillingPeriodEnd     string  `json:"billing_period_end"`
	DueDate              string  `json:"due_date"`
	BaseRent             float64 `json:"base_rent"`
	PrevElectricityMeter float64 `json:"prev_electricity_meter"`
	CurrElectricityMeter float64 `json:"curr_electricity_meter"`
	ElectricityRate      float64 `json:"electricity_rate"`
	ElectricityUnits     float64 `json:"electricity_units"`
	ElectricityAmount    float64 `json:"electricity_amount"`
	WaterBillingType     string  `json:"water_billing_type"` // FIXED or METER
	PrevWaterMeter       float64 `json:"prev_water_meter"`
	CurrWaterMeter       float64 `json:"curr_water_meter"`
	WaterRate            float64 `json:"water_rate"`
	WaterUnits           float64 `json:"water_units"`
	WaterAmount          float64 `json:"water_amount"`
	MaintenanceAmount    float64 `json:"maintenance_amount"`
	OtherCharges         float64 `json:"other_charges"`
	OtherChargesDesc     string  `json:"other_charges_desc"`
	PreviousBalance      float64 `json:"previous_balance"`
	TotalAmount          float64 `json:"total_amount"`
	PaidAmount           float64 `json:"paid_amount"`
	BalanceAmount        float64 `json:"balance_amount"`
	Status               string  `json:"status"`
	Notes                string  `json:"notes"`
	CreatedAt            string  `json:"created_at"`
}

type Payment struct {
	ID            int64   `json:"id"`
	BillID        int64   `json:"bill_id"`
	BillNumber    string  `json:"bill_number,omitempty"`
	TenantName    string  `json:"tenant_name,omitempty"`
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
	Debit          float64 `json:"debit"`          // Billed amount (increases dues)
	Credit         float64 `json:"credit"`         // Paid amount (reduces dues)
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



type DashboardAlerts struct {
	OverdueBills    []Bill   `json:"overdue_bills"`
	UnbilledTenants []Tenant `json:"unbilled_tenants"`
}

type DashboardSummary struct {
	TotalProperties  int64           `json:"total_properties"`
	TotalTenants     int64           `json:"total_tenants"`
	OccupiedUnits    int64           `json:"occupied_units"`
	VacantUnits      int64           `json:"vacant_units"`
	VacantProperties []Property      `json:"vacant_properties"`
	TotalBilled      float64         `json:"total_billed"`
	TotalCollected   float64         `json:"total_collected"`
	TotalPending     float64         `json:"total_pending"`
	TotalOverdue     float64         `json:"total_overdue"`
	TotalExpenses    float64         `json:"total_expenses"`
	NetProfit        float64         `json:"net_profit"`
	CollectionRate   float64         `json:"collection_rate"`
	TotalElecUnits   float64         `json:"total_elec_units"`
	TotalWaterUnits  float64         `json:"total_water_units"`
	TotalElecAmount  float64         `json:"total_elec_amount"`
	TotalWaterAmount float64         `json:"total_water_amount"`
	ActionRequired   DashboardAlerts `json:"action_required"`
	AvailableMonths  []string        `json:"available_months"`
	SelectedMonth    string          `json:"selected_month"`
	PendingBills     int64           `json:"pending_bills_count"`
	RecentBills      []Bill          `json:"recent_bills"`
}

func GenerateBillNumber() string {
	return fmt.Sprintf("RB-%s-%04d", time.Now().Format("200601"), time.Now().Unix()%10000)
}
