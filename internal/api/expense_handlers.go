package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"rentbill/internal/database"
)

// Expenses Handlers
func (s *Server) HandleExpenses(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		expenses, err := s.db.GetAllExpenses()
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if expenses == nil {
			expenses = []database.Expense{}
		}
		sendJSON(w, http.StatusOK, expenses)

	case http.MethodPost:
		var ex database.Expense
		if err := json.NewDecoder(r.Body).Decode(&ex); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if ex.PropertyID == 0 || ex.Title == "" || ex.Amount <= 0 || ex.ExpenseDate == "" {
			sendError(w, http.StatusBadRequest, "Property ID, Title, positive Amount, and Expense Date are required")
			return
		}
		id, err := s.db.CreateExpense(&ex)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		ex.ID = id
		sendJSON(w, http.StatusCreated, ex)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandleExpenseDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" && len(r.URL.Path) > len("/api/expenses/") {
		idStr = r.URL.Path[len("/api/expenses/"):]
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid expense ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		ex, err := s.db.GetExpenseByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Expense not found")
			return
		}
		sendJSON(w, http.StatusOK, ex)

	case http.MethodPut:
		var ex database.Expense
		if err := json.NewDecoder(r.Body).Decode(&ex); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		ex.ID = id
		if err := s.db.UpdateExpense(&ex); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, ex)

	case http.MethodDelete:
		if err := s.db.DeleteExpense(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Expense deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}
