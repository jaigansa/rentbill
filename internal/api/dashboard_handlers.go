package api

import (
	"net/http"
)

// Dashboard Handler
func (s *Server) HandleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	month := r.URL.Query().Get("month")
	summary, err := s.db.GetDashboardSummary(month)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, summary)
}
