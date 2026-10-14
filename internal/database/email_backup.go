package database

import (
	"strconv"
	"strings"
)

type EmailBackupConfig struct {
	Host       string `json:"smtp_host"`
	Port       string `json:"smtp_port"`
	User       string `json:"smtp_user"`
	Pass       string `json:"smtp_pass"`
	To         string `json:"smtp_to"`
	Enabled    bool   `json:"auto_backup_enabled"`
	Interval   string `json:"auto_backup_interval"` // "daily" or "weekly"
	LastSent   string `json:"last_backup_email_time"`
	LastStatus string `json:"last_backup_email_status"`
}

func (db *DB) GetEmailBackupConfig() EmailBackupConfig {
	port := db.GetSetting("smtp_port")
	if port == "" {
		port = "587"
	}
	interval := db.GetSetting("auto_backup_interval")
	if interval == "" {
		interval = "daily"
	}

	return EmailBackupConfig{
		Host:       db.GetSetting("smtp_host"),
		Port:       port,
		User:       db.GetSetting("smtp_user"),
		Pass:       db.GetSetting("smtp_pass"),
		To:         db.GetSetting("smtp_to"),
		Enabled:    db.GetSetting("auto_backup_enabled") == "true",
		Interval:   interval,
		LastSent:   db.GetSetting("last_backup_email_time"),
		LastStatus: db.GetSetting("last_backup_email_status"),
	}
}

func (db *DB) SaveEmailBackupConfig(cfg EmailBackupConfig) error {
	_ = db.SetSetting("smtp_host", strings.TrimSpace(cfg.Host))
	_ = db.SetSetting("smtp_port", strings.TrimSpace(cfg.Port))
	_ = db.SetSetting("smtp_user", strings.TrimSpace(cfg.User))
	if cfg.Pass != "" {
		_ = db.SetSetting("smtp_pass", strings.TrimSpace(cfg.Pass))
	}
	_ = db.SetSetting("smtp_to", strings.TrimSpace(cfg.To))
	_ = db.SetSetting("auto_backup_enabled", strconv.FormatBool(cfg.Enabled))
	_ = db.SetSetting("auto_backup_interval", strings.TrimSpace(cfg.Interval))
	return nil
}
