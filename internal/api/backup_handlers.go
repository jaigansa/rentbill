package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"rentbill/internal/backup"
	"rentbill/internal/database"
)

// Backup & Restore Handlers

func (s *Server) HandleBackupExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	backup, err := s.db.ExportBackup()
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	filename := fmt.Sprintf("rentbill-backup-%s.json", time.Now().Format("2006-01-02-150405"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	_ = json.NewEncoder(w).Encode(backup)
}

func (s *Server) HandleBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var data database.BackupData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON backup file: "+err.Error())
		return
	}

	if err := s.db.RestoreBackup(&data); err != nil {
		sendError(w, http.StatusInternalServerError, "Restore failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"message":          "Database restored successfully",
		"properties_count": len(data.Properties),
		"tenants_count":    len(data.Tenants),
		"bills_count":      len(data.Bills),
		"payments_count":   len(data.Payments),
		"expenses_count":   len(data.Expenses),
	})
}

// HandleBackupEmailSend immediately triggers an email backup
func (s *Server) HandleBackupEmailSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cfg := s.db.GetEmailBackupConfig()

	var req struct {
		Host     string `json:"smtp_host"`
		Port     string `json:"smtp_port"`
		User     string `json:"smtp_user"`
		Pass     string `json:"smtp_pass"`
		To       string `json:"smtp_to"`
		Interval string `json:"auto_backup_interval"`
		Enabled  *bool  `json:"auto_backup_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
		if req.Host != "" {
			cfg.Host = req.Host
		}
		if req.Port != "" {
			cfg.Port = req.Port
		}
		if req.User != "" {
			cfg.User = req.User
		}
		if req.Pass != "" {
			cfg.Pass = req.Pass
		}
		if req.To != "" {
			cfg.To = req.To
		}
		if req.Interval != "" {
			cfg.Interval = req.Interval
		}
		if req.Enabled != nil {
			cfg.Enabled = *req.Enabled
		}
	}

	if cfg.Host == "" || cfg.User == "" {
		sendError(w, http.StatusBadRequest, "SMTP Host and Sender Email must be provided")
		return
	}

	if err := backup.SendEmailBackup(s.db, cfg); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed sending backup email: "+err.Error())
		return
	}

	target := cfg.To
	if target == "" {
		target = cfg.User
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Backup email successfully sent to %s!", target),
		"time":    s.db.GetSetting("last_backup_email_time"),
		"status":  s.db.GetSetting("last_backup_email_status"),
	})
}

// HandleBackupEmailTest tests the SMTP configuration
func (s *Server) HandleBackupEmailTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cfg := s.db.GetEmailBackupConfig()

	var req struct {
		Host string `json:"smtp_host"`
		Port string `json:"smtp_port"`
		User string `json:"smtp_user"`
		Pass string `json:"smtp_pass"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
		if req.Host != "" {
			cfg.Host = req.Host
		}
		if req.Port != "" {
			cfg.Port = req.Port
		}
		if req.User != "" {
			cfg.User = req.User
		}
		if req.Pass != "" {
			cfg.Pass = req.Pass
		}
	}

	if cfg.Host == "" {
		sendError(w, http.StatusBadRequest, "SMTP Host is required")
		return
	}

	if err := backup.TestSMTP(cfg); err != nil {
		sendError(w, http.StatusBadRequest, "Connection failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "SMTP Connection and Authentication succeeded!",
	})
}

// StartAutoBackupScheduler begins background execution of scheduled backup checks
func (s *Server) StartAutoBackupScheduler(stopChan <-chan struct{}) {
	backup.StartAutoBackupScheduler(s.db, stopChan)
}
