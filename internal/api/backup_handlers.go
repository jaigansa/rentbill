package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

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
