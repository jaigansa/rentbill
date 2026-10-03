package database

import "strings"

func (db *DB) SetSetting(key, value string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", key, value)
	return err
}

func (db *DB) GetSetting(key string) string {
	var val string
	_ = db.QueryRow("SELECT value FROM app_settings WHERE key = ?", key).Scan(&val)
	return strings.TrimSpace(val)
}
