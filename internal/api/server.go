package api

import (
	"encoding/json"
	"log"
	"net/http"

	"rentbill/internal/database"
)

type Server struct {
	db            *database.DB
	LocalAppToken string
	AllowRemote   bool
	StaticPort    int
	LANURLs       []string
	IsLANShared   bool
}

func NewServer(db *database.DB) *Server {
	return &Server{
		db:      db,
		LANURLs: []string{},
	}
}

func (s *Server) SetLocalAppToken(token string) {
	s.LocalAppToken = token
}

func (s *Server) SetAllowRemote(allow bool) {
	s.AllowRemote = allow
}

func (s *Server) SetNetworkInfo(port int, lanURLs []string, isShared bool) {
	s.StaticPort = port
	s.LANURLs = lanURLs
	s.IsLANShared = isShared
}

// JSON Helper functions
func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func sendError(w http.ResponseWriter, status int, msg string) {
	log.Printf("API error %d: %s", status, msg)
	sendJSON(w, status, map[string]string{"error": msg})
}
