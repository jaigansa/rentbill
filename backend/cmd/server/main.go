package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"rentbills/backend/internal/api"
	"rentbills/backend/internal/db"
	"rentbills/backend/internal/sync"
)

const (
	DefaultSupabaseURL = "https://kkixhxrniodyndgzkqgq.supabase.co"
	DefaultAnonKey     = "sb_publishable_zy5YRiETmug7i0qUII8pJQ_fVrF1th-"
)

func main() {
	port := flag.Int("port", 8080, "Port to serve HTTP traffic")
	dbPath := flag.String("db", filepath.Join("outputs", "data", "rentbill.db"), "Path to SQLite database file")
	webRoot := flag.String("web", "frontend", "Path to frontend static web assets directory")
	sbURL := flag.String("supabase-url", getEnv("SUPABASE_URL", DefaultSupabaseURL), "Supabase project URL")
	sbKey := flag.String("supabase-key", getEnv("SUPABASE_KEY", DefaultAnonKey), "Supabase publishable or anon key")
	flag.Parse()

	log.Println("=============================================================")
	log.Println(" RentBill Pro — Go-Powered Local-First Server & Cloud Sync")
	log.Println("=============================================================")

	// 1. Initialize Local SQLite Database
	log.Printf("Connecting to local SQLite database at: %s", *dbPath)
	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Fatal: Failed to open SQLite database: %v", err)
	}
	defer database.Close()
	log.Println("✔ Local SQLite schema verified and ready (WAL mode active).")

	// 2. Initialize Supabase Sync Engine
	sbConfig := sync.SupabaseConfig{
		URL:     *sbURL,
		AnonKey: *sbKey,
	}
	sbClient := sync.NewSupabaseClient(sbConfig)
	syncEngine := sync.NewSyncEngine(database, sbClient)
	syncEngine.Start()
	defer syncEngine.Stop()
	log.Println("✔ Background Supabase sync engine started.")

	// 3. Setup HTTP Routing
	apiRouter := api.NewRouter(database, syncEngine)

	mainMux := http.NewServeMux()
	// Mount API
	mainMux.Handle("/api/", apiRouter)

	// Static file server serving the web UI assets from frontend directory
	fileServer := http.FileServer(http.Dir(*webRoot))
	mainMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Cache-control header for local development
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		fileServer.ServeHTTP(w, r)
	})

	serverAddr := fmt.Sprintf(":%d", *port)
	server := &http.Server{
		Addr:         serverAddr,
		Handler:      mainMux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// 4. Graceful Shutdown listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("🚀 RentBill Pro is running locally at: http://localhost:%d", *port)
		log.Println("   - Local Database: Instant 0ms reads and writes")
		log.Println("   - Cloud Sync: Supabase synchronization active")
		log.Println("Press Ctrl+C to stop the server.")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stopChan
	log.Println("\nGracefully shutting down RentBill Pro server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Error during server shutdown: %v", err)
	}

	log.Println("RentBill Pro stopped.")
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
