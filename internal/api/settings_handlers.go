package api

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Settings Handlers (Email Backup / App Settings)
func (s *Server) HandleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg := s.db.GetEmailBackupConfig()
		currencySymbol := s.db.GetSetting("currency_symbol")
		if currencySymbol == "" {
			currencySymbol = "₹"
		}
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"currency_symbol":          currencySymbol,
			"smtp_host":                cfg.Host,
			"smtp_port":                cfg.Port,
			"smtp_user":                cfg.User,
			"smtp_pass":                cfg.Pass,
			"smtp_to":                  cfg.To,
			"auto_backup_enabled":      cfg.Enabled,
			"auto_backup_interval":     cfg.Interval,
			"last_backup_email_time":   cfg.LastSent,
			"last_backup_email_status": cfg.LastStatus,
		})

	case http.MethodPost:
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		for k, rawVal := range payload {
			strVal := fmt.Sprintf("%v", rawVal)
			_ = s.db.SetSetting(k, strVal)
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Settings updated"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}
