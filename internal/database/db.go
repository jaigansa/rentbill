package database

import (
	"database/sql"
	"fmt"

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

	// Single connection pool to prevent SQLite table/database lock collisions in pure Go
	db.SetMaxOpenConns(1)

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
		opening_arrear REAL DEFAULT 0.0,
		move_in_date TEXT,
		payment_upi TEXT DEFAULT '',
		payment_bank_name TEXT DEFAULT '',
		payment_account_no TEXT DEFAULT '',
		payment_ifsc TEXT DEFAULT '',
		initial_elec_meter REAL DEFAULT 0.0,
		initial_water_meter REAL DEFAULT 0.0,
		preferred_channel TEXT DEFAULT 'SMS_RCS',
		co_occupants TEXT DEFAULT '[]',
		co_occupant_name TEXT DEFAULT '',
		co_occupant_phone TEXT DEFAULT '',
		photo TEXT DEFAULT '',
		documents TEXT DEFAULT '[]',
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
		discount_amount REAL DEFAULT 0.0,
		discount_reason TEXT DEFAULT '',
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

	CREATE TABLE IF NOT EXISTS app_sessions (
		token TEXT PRIMARY KEY,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_active DATETIME DEFAULT CURRENT_TIMESTAMP
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
		"ALTER TABLE bills ADD COLUMN discount_amount REAL DEFAULT 0.0",
		"ALTER TABLE bills ADD COLUMN discount_reason TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_upi TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_bank_name TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_account_no TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN payment_ifsc TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN initial_elec_meter REAL DEFAULT 0.0",
		"ALTER TABLE tenants ADD COLUMN initial_water_meter REAL DEFAULT 0.0",
		"ALTER TABLE tenants ADD COLUMN preferred_channel TEXT DEFAULT 'SMS_RCS'",
		"ALTER TABLE tenants ADD COLUMN co_occupants TEXT DEFAULT '[]'",
		"ALTER TABLE tenants ADD COLUMN co_occupant_name TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN co_occupant_phone TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN opening_arrear REAL DEFAULT 0.0",
		"ALTER TABLE tenants ADD COLUMN photo TEXT DEFAULT ''",
		"ALTER TABLE tenants ADD COLUMN documents TEXT DEFAULT '[]'",
	}
	for _, m := range migrations {
		_, _ = db.Exec(m) // Ignore if column already exists
	}
	return nil
}
