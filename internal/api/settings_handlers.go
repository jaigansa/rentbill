package api

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Settings Handlers (App Settings)
func (s *Server) HandleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		currencySymbol := s.db.GetSetting("currency_symbol")
		if currencySymbol == "" {
			currencySymbol = "₹"
		}
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"currency_symbol": currencySymbol,
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
