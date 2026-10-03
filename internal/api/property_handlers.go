package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"rentbill/internal/database"
)

// Properties Handlers
func (s *Server) HandleProperties(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		properties, err := s.db.GetAllProperties()
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if properties == nil {
			properties = []database.Property{}
		}
		sendJSON(w, http.StatusOK, properties)

	case http.MethodPost:
		var p database.Property
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		if p.Name == "" {
			sendError(w, http.StatusBadRequest, "Property name is required")
			return
		}
		id, err := s.db.CreateProperty(&p)
		if err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.ID = id
		sendJSON(w, http.StatusCreated, p)

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandlePropertyDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/properties/"):]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid property ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		prop, err := s.db.GetPropertyByID(id)
		if err != nil {
			sendError(w, http.StatusNotFound, "Property not found")
			return
		}
		sendJSON(w, http.StatusOK, prop)

	case http.MethodPut:
		var p database.Property
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		p.ID = id
		if err := s.db.UpdateProperty(&p); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, p)

	case http.MethodDelete:
		if err := s.db.DeleteProperty(id); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sendJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *Server) HandlePropertyExpenses(w http.ResponseWriter, r *http.Request) {
	// Path is /api/properties/{id}/expenses
	path := r.URL.Path[len("/api/properties/"):]
	idStr := strings.TrimSuffix(path, "/expenses")
	propID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid property ID")
		return
	}

	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	expenses, err := s.db.GetExpensesByProperty(propID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if expenses == nil {
		expenses = []database.Expense{}
	}
	sendJSON(w, http.StatusOK, expenses)
}
