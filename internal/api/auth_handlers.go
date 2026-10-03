package api

import (
	"encoding/json"
	"net/http"
	"strings"
)

// ExtractToken retrieves the session token from the HTTP cookie or Authorization/X-Auth-Token header
func (s *Server) ExtractToken(r *http.Request) string {
	if cookie, err := r.Cookie("rentbill_session"); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	if xAuth := r.Header.Get("X-Auth-Token"); xAuth != "" {
		return strings.TrimSpace(xAuth)
	}
	return ""
}

func (s *Server) HandleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	pinEnabled := s.db.IsPINEnabled()
	authenticated := !pinEnabled
	if pinEnabled {
		token := s.ExtractToken(r)
		if token != "" && s.db.ValidateSession(token) {
			authenticated = true
		}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"pin_enabled":   pinEnabled,
		"authenticated": authenticated,
	})
}

func (s *Server) HandleAuthVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var payload struct {
		PIN string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	if !s.db.IsPINEnabled() {
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "PIN not set",
		})
		return
	}
	if s.db.VerifyPIN(payload.PIN) {
		token, err := s.db.CreateSession()
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to create session")
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "rentbill_session",
			Value:    token,
			Path:     "/",
			MaxAge:   86400 * 30, // 30 days
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
		sendJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"token":   token,
			"message": "PIN verified successfully",
		})
		return
	}
	sendError(w, http.StatusUnauthorized, "Incorrect 4-digit PIN")
}

func (s *Server) HandleAuthSetPIN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var payload struct {
		CurrentPIN string `json:"current_pin"`
		NewPIN     string `json:"new_pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	if s.db.IsPINEnabled() {
		if !s.db.VerifyPIN(payload.CurrentPIN) {
			sendError(w, http.StatusUnauthorized, "Current PIN is incorrect")
			return
		}
	}
	if err := s.db.SetPIN(payload.NewPIN); err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}
	token, err := s.db.CreateSession()
	if err == nil {
		http.SetCookie(w, &http.Cookie{
			Name:     "rentbill_session",
			Value:    token,
			Path:     "/",
			MaxAge:   86400 * 30,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   token,
		"message": "4-Digit PIN configured successfully",
	})
}

func (s *Server) HandleAuthDisablePIN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var payload struct {
		CurrentPIN string `json:"current_pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	if s.db.IsPINEnabled() {
		if !s.db.VerifyPIN(payload.CurrentPIN) {
			sendError(w, http.StatusUnauthorized, "Current PIN is incorrect")
			return
		}
	}
	if err := s.db.DisablePIN(); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "rentbill_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "PIN lock disabled successfully",
	})
}

func (s *Server) HandleAuthLogout(w http.ResponseWriter, r *http.Request) {
	token := s.ExtractToken(r)
	if token != "" {
		_ = s.db.RevokeSession(token)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "rentbill_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	})
}
