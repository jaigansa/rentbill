package api

import (
	"fmt"
	"net/http"
	"time"
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

// CSV Report Handler
func (s *Server) HandleReportsCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	reportType := r.URL.Query().Get("type")
	var csvData []byte
	var err error
	var filename string
	today := time.Now().Format("2006-01-02")

	switch reportType {
	case "bills":
		csvData, err = s.db.ExportBillsCSV()
		filename = fmt.Sprintf("rentbill-bills-%s.csv", today)
	case "payments":
		csvData, err = s.db.ExportPaymentsCSV()
		filename = fmt.Sprintf("rentbill-payments-%s.csv", today)
	case "expenses":
		csvData, err = s.db.ExportExpensesCSV()
		filename = fmt.Sprintf("rentbill-expenses-%s.csv", today)
	case "meters":
		csvData, err = s.db.ExportMetersCSV()
		filename = fmt.Sprintf("rentbill-meters-%s.csv", today)
	default:
		sendError(w, http.StatusBadRequest, "Invalid report type. Options: bills, payments, expenses, meters")
		return
	}

	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	_, _ = w.Write(csvData)
}
