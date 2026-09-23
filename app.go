package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"rentbills/backend/pkg/api"
	"rentbills/backend/pkg/db"
	"rentbills/backend/pkg/sync"
)

const (
	DefaultSupabaseURL = "https://kkixhxrniodyndgzkqgq.supabase.co"
	DefaultAnonKey     = "sb_publishable_zy5YRiETmug7i0qUII8pJQ_fVrF1th-"
)

// App struct
type App struct {
	ctx        context.Context
	database   *db.DB
	syncEngine *sync.SyncEngine
	apiRouter  *api.Router
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Locate or create persistent database path in user data dir (or local fallback)
	dbPath := resolveDatabasePath()
	log.Printf("Using SQLite database at: %s", dbPath)
	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("Fatal: Failed to open SQLite database: %v", err)
	}
	a.database = database

	// Start Supabase sync engine
	sbConfig := sync.SupabaseConfig{
		URL:     getEnv("SUPABASE_URL", DefaultSupabaseURL),
		AnonKey: getEnv("SUPABASE_KEY", DefaultAnonKey),
	}
	sbClient := sync.NewSupabaseClient(sbConfig)
	a.syncEngine = sync.NewSyncEngine(database, sbClient)
	a.syncEngine.Start()

	// Initialize API router for local API requests
	a.apiRouter = api.NewRouter(database, a.syncEngine)
}

// ServeHTTP implements http.Handler to handle /api/ endpoints routed internally by Wails
func (a *App) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if a.apiRouter != nil {
		a.apiRouter.ServeHTTP(w, req)
	} else {
		http.NotFound(w, req)
	}
}

// OpenExternalURL opens a URL (like WhatsApp Web) in the user's default browser
func (a *App) OpenExternalURL(targetURL string) {
	if a.ctx != nil {
		runtime.BrowserOpenURL(a.ctx, targetURL)
	}
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.syncEngine != nil {
		a.syncEngine.Stop()
	}
	if a.database != nil {
		a.database.Close()
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

// resolveDatabasePath determines the SQLite database location.
// 1. Checks DB_PATH environment variable if explicitly set.
// 2. If a local outputs/data/rentbill.db already exists, it uses that (for smooth development).
// 3. Otherwise, stores it in the standard OS user data directory:
//    - Linux: ~/.local/share/rentbills/rentbill.db
//    - Windows: %APPDATA%/rentbills/rentbill.db
//    - macOS: ~/Library/Application Support/rentbills/rentbill.db
func resolveDatabasePath() string {
	if custom := os.Getenv("DB_PATH"); custom != "" {
		return custom
	}

	localDevDb := filepath.Join("outputs", "data", "rentbill.db")
	if _, err := os.Stat(localDevDb); err == nil {
		return localDevDb
	}

	userConfigDir, err := os.UserConfigDir()
	if err == nil {
		appDir := filepath.Join(userConfigDir, "rentbills")
		if mkErr := os.MkdirAll(appDir, 0755); mkErr == nil {
			return filepath.Join(appDir, "rentbill.db")
		}
	}

	// Fallback to local outputs directory
	fallbackDir := filepath.Join("outputs", "data")
	_ = os.MkdirAll(fallbackDir, 0755)
	return filepath.Join(fallbackDir, "rentbill.db")
}
