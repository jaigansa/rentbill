package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"rentbill/internal/api"
	"rentbill/internal/database"
)

//go:embed public/*
var publicFS embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("RENTBILL_DB_PATH")
	for i, arg := range os.Args[1:] {
		if (arg == "--db-path" || arg == "-db-path") && i+2 < len(os.Args) {
			dbPath = os.Args[i+2]
		}
	}
	if dbPath == "" {
		if _, err := os.Stat("data/rentbill.db"); err == nil {
			dbPath = "data/rentbill.db"
		} else if _, err := os.Stat("rentbill.db"); err == nil {
			dbPath = "rentbill.db"
		} else {
			dbPath = filepath.Join("data", "rentbill.db")
		}
	}
	if dir := filepath.Dir(dbPath); dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0755)
	}
	log.Printf("📂 Opening SQLite database: %s", dbPath)

	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("❌ Database initialization failed: %v", err)
	}
	defer db.Close()

	// Emergency PIN Reset CLI Flag (--reset-pin)
	for _, arg := range os.Args[1:] {
		if arg == "--reset-pin" || arg == "-reset-pin" {
			if err := db.DisablePIN(); err != nil {
				log.Fatalf("❌ Failed to reset PIN: %v", err)
			}
			fmt.Println("======================================================")
			fmt.Println("  🔓 4-Digit Security PIN has been RESET and disabled!")
			fmt.Println("======================================================")
			return
		}
	}

	// Strip 'public' prefix from embedded filesystem
	subFS, err := fs.Sub(publicFS, "public")
	if err != nil {
		log.Fatalf("❌ Failed to load embedded assets: %v", err)
	}

	// Create API Server & Register Routes
	server := api.NewServer(db)
	mux := http.NewServeMux()
	api.RegisterRoutes(mux, server, subFS)

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	fmt.Println("======================================================")
	fmt.Println("    🏠  RentBill Server Started!                      ")
	fmt.Println("======================================================")
	fmt.Printf("  • Web URL: http://localhost:%s\n", port)
	fmt.Println("======================================================")

	// Graceful shutdown channel
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ HTTP server error: %v", err)
		}
	}()

	<-stop
	fmt.Println("\n🛑 Shutting down RentBill gracefully...")
	_ = httpServer.Close()
	fmt.Println("👋 Bye!")
}
