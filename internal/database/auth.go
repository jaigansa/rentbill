package database

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

func hashPIN(pin string) string {
	h := sha256.Sum256([]byte("rentbill_pin_salt_" + strings.TrimSpace(pin)))
	return hex.EncodeToString(h[:])
}

// IsPINEnabled returns whether a 4-digit PIN is currently set and active
func (db *DB) IsPINEnabled() bool {
	enabled := db.GetSetting("app_pin_enabled")
	hash := db.GetSetting("app_pin_hash")
	return enabled == "true" && len(hash) > 0
}

// SetPIN saves a new 4-digit PIN and invalidates old sessions
func (db *DB) SetPIN(pin string) error {
	trimmed := strings.TrimSpace(pin)
	if len(trimmed) != 4 {
		return fmt.Errorf("PIN must be exactly 4 digits")
	}
	for _, c := range trimmed {
		if c < '0' || c > '9' {
			return fmt.Errorf("PIN must contain only numbers")
		}
	}
	hash := hashPIN(trimmed)
	if err := db.SetSetting("app_pin_hash", hash); err != nil {
		return err
	}
	if err := db.SetSetting("app_pin_enabled", "true"); err != nil {
		return err
	}
	_ = db.RevokeAllSessions()
	return nil
}

// VerifyPIN verifies the given PIN against the stored hash
func (db *DB) VerifyPIN(pin string) bool {
	if !db.IsPINEnabled() {
		return true
	}

	// Check lockout
	lockoutUntil := db.GetSetting("app_pin_lockout_until")
	if lockoutUntil != "" {
		if t, err := time.Parse(time.RFC3339, lockoutUntil); err == nil && time.Now().Before(t) {
			return false // locked out
		}
		// Lockout expired, reset attempts
		db.SetSetting("app_pin_attempts", "0")
		db.SetSetting("app_pin_lockout_until", "")
	}

	stored := db.GetSetting("app_pin_hash")
	if hashPIN(pin) == stored {
		// Successful verify - reset attempts
		db.SetSetting("app_pin_attempts", "0")
		db.SetSetting("app_pin_lockout_until", "")
		return true
	}

	// Failed attempt - increment counter
	attemptsStr := db.GetSetting("app_pin_attempts")
	attempts := 0
	if attemptsStr != "" {
		fmt.Sscanf(attemptsStr, "%d", &attempts)
	}
	attempts++
	db.SetSetting("app_pin_attempts", fmt.Sprintf("%d", attempts))

	// Lockout after 5 failed attempts for 15 minutes
	if attempts >= 5 {
		until := time.Now().Add(15 * time.Minute).Format(time.RFC3339)
		db.SetSetting("app_pin_lockout_until", until)
		return false
	}

	return false
}

// DisablePIN removes the PIN lock and revokes all active sessions
func (db *DB) DisablePIN() error {
	if err := db.SetSetting("app_pin_enabled", "false"); err != nil {
		return err
	}
	_ = db.RevokeAllSessions()
	return db.SetSetting("app_pin_hash", "")
}

// CreateSession generates a cryptographically random session token and persists it in SQLite
func (db *DB) CreateSession() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)

	_, err := db.Exec(
		"INSERT INTO app_sessions (token, created_at, last_active) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		token,
	)
	if err != nil {
		return "", err
	}
	return token, nil
}

// ValidateSession verifies whether a session token is valid and active within 30 days
func (db *DB) ValidateSession(token string) bool {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return false
	}
	var exists int
	err := db.QueryRow(
		"SELECT 1 FROM app_sessions WHERE token = ? AND datetime(last_active, '+30 days') >= CURRENT_TIMESTAMP",
		trimmed,
	).Scan(&exists)
	if err != nil || exists != 1 {
		return false
	}

	// Update last_active timestamp
	_, _ = db.Exec("UPDATE app_sessions SET last_active = CURRENT_TIMESTAMP WHERE token = ?", trimmed)
	return true
}

// RevokeSession removes a specific session token (used for logout)
func (db *DB) RevokeSession(token string) error {
	_, err := db.Exec("DELETE FROM app_sessions WHERE token = ?", strings.TrimSpace(token))
	return err
}

// RevokeAllSessions clears all active session tokens
func (db *DB) RevokeAllSessions() error {
	_, err := db.Exec("DELETE FROM app_sessions")
	return err
}

// PinStatus returns the current PIN attempt count and lockout state
func (db *DB) PinStatus() (attempts int, lockoutUntil time.Time, locked bool) {
	attemptsStr := db.GetSetting("app_pin_attempts")
	if attemptsStr != "" {
		fmt.Sscanf(attemptsStr, "%d", &attempts)
	}
	lockoutStr := db.GetSetting("app_pin_lockout_until")
	if lockoutStr != "" {
		if t, err := time.Parse(time.RFC3339, lockoutStr); err == nil {
			if time.Now().Before(t) {
				return attempts, t, true
			}
			// Lockout expired - reset
			db.SetSetting("app_pin_attempts", "0")
			db.SetSetting("app_pin_lockout_until", "")
		}
	}
	return attempts, time.Time{}, false
}
