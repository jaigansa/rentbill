package api

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB
var BackupsDir = "./backups"

func InitDB() error {
	var err error
	DB, err = sql.Open("sqlite", AppConfig.DbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	DB.Exec("PRAGMA foreign_keys = ON;")
	DB.Exec("PRAGMA journal_mode = WAL;")
	DB.Exec("PRAGMA synchronous = NORMAL;")
	DB.Exec("PRAGMA busy_timeout = 5000;")
	DB.Exec("PRAGMA auto_vacuum = INCREMENTAL;")

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(10)
	DB.SetConnMaxLifetime(30 * time.Minute)

	queries := []string{
		`CREATE TABLE IF NOT EXISTS renters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT, room_no TEXT, aadhar_no TEXT, move_in_date DATE, 
			advance_amount REAL, base_rent REAL, eb_unit_price REAL, 
			water_maint REAL DEFAULT 0, maint_charge REAL DEFAULT 0, is_active INTEGER DEFAULT 1,
			mobile_number TEXT, email TEXT, initial_eb REAL DEFAULT 0,
			perm_address TEXT, emergency_contact TEXT, occupation TEXT, assigned_upi TEXT,
			pending_arrears REAL DEFAULT 0, co_tenant_names TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS bills (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			renter_id INTEGER, billing_month TEXT, prev_eb_reading REAL DEFAULT 0,
			curr_eb_reading REAL, others REAL DEFAULT 0, total_amount REAL, 
			is_paid INTEGER DEFAULT 0, payment_method TEXT, payment_details TEXT,
			payment_date DATE, date_generated DATE, notes TEXT,
			rent_amount REAL DEFAULT 0, water_amount REAL DEFAULT 0, maint_amount REAL DEFAULT 0,
			paid_amount REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
			write_off_amount REAL DEFAULT 0, arrears_amount REAL DEFAULT 0,
			arrears_included REAL DEFAULT 0,
			FOREIGN KEY(renter_id) REFERENCES renters(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS expenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category TEXT, amount REAL, date DATE, notes TEXT,
			owner_name TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE, pin_hash TEXT, email TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS activity_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			action TEXT, details TEXT, amount REAL DEFAULT 0, username TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS owner_withdrawals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			owner_name TEXT, amount REAL, date DATE, notes TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS maintenance_tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			renter_id INTEGER, title TEXT, description TEXT, 
			category TEXT, priority TEXT, status TEXT DEFAULT 'Pending',
			owner_name TEXT, estimated_cost REAL DEFAULT 0, actual_cost REAL DEFAULT 0,
			date_reported DATE, date_resolved DATE,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(renter_id) REFERENCES renters(id) ON DELETE SET NULL
		)`,
		`CREATE TABLE IF NOT EXISTS documents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			renter_id INTEGER, file_name TEXT, file_path TEXT, 
			file_type TEXT, upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
			expiry_date DATE, notes TEXT,
			FOREIGN KEY(renter_id) REFERENCES renters(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS properties (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT, address TEXT, owner_name TEXT, agreement_terms TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS units (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			unit_name TEXT UNIQUE, floor TEXT, default_rent REAL DEFAULT 0,
			default_maint REAL DEFAULT 0, is_occupied INTEGER DEFAULT 0,
			agreement_terms TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("schema error: %w\nQuery: %s", err, q)
		}
	}

	DB.Exec("ALTER TABLE units ADD COLUMN agreement_terms TEXT")

	DB.Exec("ALTER TABLE renters ADD COLUMN maint_charge REAL DEFAULT 0")
	DB.Exec("ALTER TABLE bills ADD COLUMN maint_amount REAL DEFAULT 0")
	DB.Exec("ALTER TABLE bills ADD COLUMN arrears_included REAL DEFAULT 0")
	DB.Exec("ALTER TABLE expenses ADD COLUMN owner_name TEXT")
	DB.Exec("ALTER TABLE activity_logs ADD COLUMN amount REAL DEFAULT 0")
	DB.Exec("ALTER TABLE maintenance_tasks ADD COLUMN photo_path TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN vacate_date DATE")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_refund_amount TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_dues_deducted REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_repairs_deducted REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_refund_label TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_balance REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_eb_reading TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_reason TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_rent_due REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN exit_eb_due REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN password_hash TEXT")
	DB.Exec("ALTER TABLE renters ADD COLUMN agreement_expiry_date DATE")
	DB.Exec("ALTER TABLE renters ADD COLUMN water_calc_mode TEXT DEFAULT 'FIXED'")
	DB.Exec("ALTER TABLE renters ADD COLUMN water_unit_price REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN initial_water REAL DEFAULT 0")
	DB.Exec("ALTER TABLE renters ADD COLUMN co_tenant_names TEXT")
	DB.Exec("ALTER TABLE bills ADD COLUMN proof_status TEXT DEFAULT 'NONE'")
	DB.Exec("ALTER TABLE bills ADD COLUMN proof_ref TEXT")
	DB.Exec("ALTER TABLE bills ADD COLUMN proof_photo TEXT")
	DB.Exec("ALTER TABLE bills ADD COLUMN proof_date DATETIME")
	DB.Exec("ALTER TABLE bills ADD COLUMN prev_water_reading REAL DEFAULT 0")
	DB.Exec("ALTER TABLE bills ADD COLUMN curr_water_reading REAL DEFAULT 0")
	DB.Exec("ALTER TABLE bills ADD COLUMN water_unit_price REAL DEFAULT 0")
	DB.Exec("ALTER TABLE bills ADD COLUMN water_calc_mode TEXT DEFAULT 'FIXED'")
	DB.Exec("ALTER TABLE bills ADD COLUMN late_fee REAL DEFAULT 0")

	// DB Indexes for High Performance Queries
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_renters_is_active_room ON renters(is_active, room_no);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_renter_month ON bills(renter_id, billing_month);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_is_paid ON bills(is_paid);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_proof_status ON bills(proof_status);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_billing_month ON bills(billing_month);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_date_generated ON bills(date_generated);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_payment_date ON bills(payment_date);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_bills_renter_is_paid ON bills(renter_id, is_paid);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_withdrawals_date ON owner_withdrawals(date);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_units_unit_name ON units(unit_name);")

	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count == 0 {
		DB.Exec("INSERT INTO users (username, pin_hash) VALUES (?, ?)", AppConfig.Username, AppConfig.MasterPinHash)
	}

	if _, err := os.Stat(BackupsDir); os.IsNotExist(err) {
		os.Mkdir(BackupsDir, 0755)
	}
	if _, err := os.Stat("./uploads"); os.IsNotExist(err) {
		os.Mkdir("./uploads", 0755)
	}
	if _, err := os.Stat("./uploads/maintenance"); os.IsNotExist(err) {
		os.Mkdir("./uploads/maintenance", 0755)
	}
	if _, err := os.Stat("./uploads/proofs"); os.IsNotExist(err) {
		os.Mkdir("./uploads/proofs", 0755)
	}
	return nil
}

func LogActivity(action, details, username string, amount float64) {
	DB.Exec("INSERT INTO activity_logs (action, details, amount, username) VALUES (?, ?, ?, ?)", action, details, amount, username)
}

func StartAutoBackup() {
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			backupPath := filepath.Join(BackupsDir, fmt.Sprintf("auto_%s_backup.db", time.Now().Format("2006-01-02_15-04-05")))
			DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath))
			LogActivity("DB_BACKUP", "Auto Backup Created: "+filepath.Base(backupPath), "system", 0)
			fmt.Println("Automatic backup created:", backupPath)
		}
	}()
}

func RestoreFromPath(newPath string) error {
	if DB != nil {
		fmt.Println("Closing DB connection for restore...")
		DB.Close()
	}

	time.Sleep(500 * time.Millisecond)

	fmt.Printf("Restoring from %s to %s\n", newPath, AppConfig.DbPath)

	backupOld := AppConfig.DbPath + ".bak"
	os.Rename(AppConfig.DbPath, backupOld)

	input, err := os.ReadFile(newPath)
	if err != nil {
		fmt.Printf("Error reading upload: %v\n", err)
		os.Rename(backupOld, AppConfig.DbPath)
		return err
	}

	err = os.WriteFile(AppConfig.DbPath, input, 0644)
	if err != nil {
		fmt.Printf("Error writing to DB path: %v\n", err)
		os.Rename(backupOld, AppConfig.DbPath)
		return err
	}

	if !IsValidSqliteDb(AppConfig.DbPath) {
		fmt.Println("Error: Restored file is not a valid SQLite database")
		os.Rename(backupOld, AppConfig.DbPath)
		return fmt.Errorf("invalid sqlite database")
	}

	os.Remove(backupOld)

	fmt.Println("Re-opening DB connection...")
	return InitDB()
}

func IsValidSqliteDb(path string) bool {
	tempDb, err := sql.Open("sqlite", path)
	if err == nil {
		defer tempDb.Close()
		return tempDb.Ping() == nil
	}
	return false
}
