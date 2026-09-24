package database

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
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

// SetPIN saves a new 4-digit PIN
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
	return db.SetSetting("app_pin_enabled", "true")
}

// VerifyPIN verifies the given PIN against the stored hash
func (db *DB) VerifyPIN(pin string) bool {
	if !db.IsPINEnabled() {
		return true
	}
	stored := db.GetSetting("app_pin_hash")
	return hashPIN(pin) == stored
}

// DisablePIN removes the PIN lock
func (db *DB) DisablePIN() error {
	if err := db.SetSetting("app_pin_enabled", "false"); err != nil {
		return err
	}
	return db.SetSetting("app_pin_hash", "")
}
