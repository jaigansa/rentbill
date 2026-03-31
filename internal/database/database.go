package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
	"rentbill/internal/config"
)

var DB *sql.DB
var BackupsDir = "./backups"

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite", config.AppConfig.DbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	DB.Exec("PRAGMA foreign_keys = ON")

	queries := []string{
		`CREATE TABLE IF NOT EXISTS renters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT, room_no TEXT, aadhar_no TEXT, move_in_date DATE, 
			advance_amount REAL, base_rent REAL, eb_unit_price REAL, 
			water_maint REAL DEFAULT 0, is_active INTEGER DEFAULT 1,
			mobile_number TEXT, email TEXT, initial_eb REAL DEFAULT 0,
			perm_address TEXT, emergency_contact TEXT, occupation TEXT, assigned_upi TEXT,
			pending_arrears REAL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS bills (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			renter_id INTEGER, billing_month TEXT, prev_eb_reading REAL DEFAULT 0,
			curr_eb_reading REAL, others REAL DEFAULT 0, total_amount REAL, 
			is_paid INTEGER DEFAULT 0, payment_method TEXT, payment_details TEXT,
			payment_date DATE, date_generated DATE, notes TEXT,
			rent_amount REAL DEFAULT 0, water_amount REAL DEFAULT 0,
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
			action TEXT, details TEXT, username TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS owner_withdrawals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			owner_name TEXT, amount REAL, date DATE, notes TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(q); err != nil {
			log.Fatalf("Schema error: %v\nQuery: %s", err, q)
		}
	}

	// Simple migrations: ignore error if columns already exist
	DB.Exec("ALTER TABLE bills ADD COLUMN arrears_included REAL DEFAULT 0")
	DB.Exec("ALTER TABLE expenses ADD COLUMN owner_name TEXT")

	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count == 0 {
		DB.Exec("INSERT INTO users (username, pin_hash) VALUES (?, ?)", config.AppConfig.Username, config.AppConfig.MasterPinHash)
	}

	if _, err := os.Stat(BackupsDir); os.IsNotExist(err) {
		os.Mkdir(BackupsDir, 0755)
	}
}

func LogActivity(action, details, username string) {
	DB.Exec("INSERT INTO activity_logs (action, details, username) VALUES (?, ?, ?)", action, details, username)
}

func StartAutoBackup() {
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			backupPath := filepath.Join(BackupsDir, fmt.Sprintf("auto_%s_backup.db", time.Now().Format("2006-01-02_15-04-05")))
			DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath))
			LogActivity("DB_BACKUP", "Auto Backup Created: "+filepath.Base(backupPath), "system")
			fmt.Println("Automatic backup created:", backupPath)
		}
	}()
}

func RestoreFromPath(newPath string) error {
	if DB != nil {
		fmt.Println("Closing DB connection for restore...")
		DB.Close()
	}

	// Wait a moment for OS to release file locks
	time.Sleep(500 * time.Millisecond)

	fmt.Printf("Restoring from %s to %s\n", newPath, config.AppConfig.DbPath)
	
	// Copy new file over the current database path
	input, err := os.ReadFile(newPath)
	if err != nil {
		fmt.Printf("Error reading upload: %v\n", err)
		return err
	}

	err = os.WriteFile(config.AppConfig.DbPath, input, 0644)
	if err != nil {
		fmt.Printf("Error writing to DB path: %v\n", err)
		return err
	}

	// Re-initialize the DB connection
	fmt.Println("Re-opening DB connection...")
	InitDB()
	return nil
}

func IsValidSqliteDb(path string) bool {
	tempDb, err := sql.Open("sqlite", path)
	if err == nil {
		defer tempDb.Close()
		return tempDb.Ping() == nil
	}
	return false
}
