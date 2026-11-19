package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"rentbill/internal/api"
	"rentbill/internal/database"
	"rentbill/internal/gui"
)

// Version is set at compile time via -ldflags="-X main.Version=..."
var Version = "1.0.0"

//go:embed public/*
var publicFS embed.FS

// getDefaultDBPath resolves the persistent database location following XDG standards
func getDefaultDBPath() string {
	if envPath := os.Getenv("RENTBILL_DB_PATH"); envPath != "" {
		return envPath
	}

	// 1. If running in a repository or directory with an existing local database, prioritize it
	if _, err := os.Stat(filepath.Join("data", "rentbill.db")); err == nil {
		return filepath.Join("data", "rentbill.db")
	}
	if _, err := os.Stat("rentbill.db"); err == nil {
		return "rentbill.db"
	}

	// 2. Standard XDG / OS persistent data directory
	// Linux / BSD: ~/.local/share/rentbill/rentbill.db
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" {
		dataHome := os.Getenv("XDG_DATA_HOME")
		if dataHome == "" {
			if home, err := os.UserHomeDir(); err == nil {
				dataHome = filepath.Join(home, ".local", "share")
			}
		}
		if dataHome != "" {
			return filepath.Join(dataHome, "rentbill", "rentbill.db")
		}
	} else if runtime.GOOS == "darwin" {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, "Library", "Application Support", "rentbill", "rentbill.db")
		}
	} else if runtime.GOOS == "windows" {
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "RentBill", "rentbill.db")
		}
	}

	return filepath.Join("data", "rentbill.db")
}

// tryConnectRunningInstance checks if a RentBill server is already running on the given port
func tryConnectRunningInstance(port string) (string, bool) {
	client := &http.Client{Timeout: 600 * time.Millisecond}
	apiURL := fmt.Sprintf("http://127.0.0.1:%s/api/network/info", port)

	resp, err := client.Get(apiURL)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var info struct {
				LocalURL string `json:"local_url"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&info); err == nil && info.LocalURL != "" {
				return info.LocalURL, true
			}
			return fmt.Sprintf("http://127.0.0.1:%s/", port), true
		}
		// When security token is active on the running instance, 403 Forbidden confirms RentBill is listening
		if resp.StatusCode == http.StatusForbidden {
			return fmt.Sprintf("http://127.0.0.1:%s/", port), true
		}
	}

	// Secondary check: verify health endpoint
	respHealth, errHealth := client.Get(fmt.Sprintf("http://127.0.0.1:%s/api/health", port))
	if errHealth == nil {
		defer respHealth.Body.Close()
		if respHealth.StatusCode == http.StatusOK {
			return fmt.Sprintf("http://127.0.0.1:%s/", port), true
		}
	}

	// Tertiary check: verify HTML shell
	respRoot, errRoot := client.Get(fmt.Sprintf("http://127.0.0.1:%s/", port))
	if errRoot == nil {
		defer respRoot.Body.Close()
		if respRoot.StatusCode == http.StatusOK && strings.Contains(respRoot.Header.Get("Content-Security-Policy"), "rentbill") {
			return fmt.Sprintf("http://127.0.0.1:%s/", port), true
		}
	}

	return "", false
}

func main() {
	// Set India timezone for all date/time operations
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		log.Printf("⚠️  Could not load Asia/Kolkata timezone: %v, using system local", err)
	} else {
		time.Local = loc
	}

	defaultDB := getDefaultDBPath()

	defaultPort := os.Getenv("PORT")
	if defaultPort == "" {
		defaultPort = "8080"
	}

	// CLI Flags
	portFlag := flag.String("port", defaultPort, "Static HTTP port to listen on (default: 8080)")
	hostFlag := flag.String("host", "", "Bind host address (default: 127.0.0.1 for local, 0.0.0.0 for LAN share)")
	shareFlag := flag.Bool("share", false, "Share RentBill over local network (Wi-Fi access for mobile phones)")
	flag.BoolVar(shareFlag, "lan", false, "Share RentBill over local network (alias)")
	tokenFlag := flag.String("token", "", "Optional custom security token (enforces token authentication on all API requests)")
	dbPath := flag.String("db-path", defaultDB, "Path to SQLite database file")
	serverMode := flag.Bool("server", false, "Run as headless background server (without desktop GUI window)")
	flag.BoolVar(serverMode, "headless", false, "Run as headless background server (alias)")
	flag.BoolVar(serverMode, "no-gui", false, "Run without desktop GUI (alias)")
	allowRemote := flag.Bool("allow-remote", false, "Allow external non-localhost network connections (alias for -share)")
	resetPIN := flag.Bool("reset-pin", false, "Reset and disable the 4-digit security PIN")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.BoolVar(showVersion, "v", false, "Print version and exit (shorthand)")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "RentBill - Local Pure Go GUI Desktop Application\n\n")
		fmt.Fprintf(os.Stderr, "Usage: rentbill [options]\n\nOptions:\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if *showVersion {
		fmt.Printf("RentBill v%s (%s/%s, pure Go, CGO_ENABLED=0)\n", Version, runtime.GOOS, runtime.GOARCH)
		return
	}

	// Ensure database directory exists
	if dir := filepath.Dir(*dbPath); dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0755)
	}

	// Initialize Pure Go SQLite Database
	db, err := database.InitDB(*dbPath)
	if err != nil {
		log.Fatalf("❌ Database initialization failed: %v", err)
	}
	defer db.Close()

	// Reclaim space on startup
	if _, err := db.Exec("VACUUM"); err != nil {
		log.Printf("⚠️  Startup VACUUM: %v", err)
	}

	log.Printf("✅ Database initialized: %s", *dbPath)

	// Emergency PIN Reset CLI Flag (--reset-pin)
	if *resetPIN {
		if err := db.DisablePIN(); err != nil {
			log.Fatalf("❌ Failed to reset PIN: %v", err)
		}
		fmt.Println("======================================================")
		fmt.Println("  🔓 4-Digit Security PIN has been RESET and disabled!")
		fmt.Println("======================================================")
		return
	}

	// Determine Mode: GUI Desktop App vs Headless Server
	isDesktop := gui.IsDesktopAvailable()
	isGUIMode := !*serverMode && isDesktop
	isLANShared := *shareFlag || *allowRemote

	// Configure network binding (Static port across all modes)
	bindPort := *portFlag
	if bindPort == "" {
		bindPort = defaultPort
	}

	bindHost := *hostFlag
	if bindHost == "" {
		if isLANShared {
			bindHost = "0.0.0.0" // Allow devices on local network / Wi-Fi
		} else {
			bindHost = "127.0.0.1" // Strict local loopback protection
		}
	}

	// In GUI Desktop mode: check if RentBill is already running on the target port
	if isGUIMode {
		if existingURL, ok := tryConnectRunningInstance(bindPort); ok {
			fmt.Printf("🚀 RentBill is already running. Connecting GUI window to %s\n", existingURL)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			session, err := gui.LaunchWindow(ctx, existingURL)
			if err != nil {
				_ = gui.OpenInDefaultBrowser(existingURL)
				return
			}
			_ = session.Wait()
			return
		}
	}

	// Security Token: only enforce when explicitly provided by the user via -token flag.
	// For normal local desktop GUI and server operations, Zero-Trust is enforced via
	// strict Anti-CSRF Origin/Referer checks, Anti-DNS-Rebinding Host validation,
	// Content-Security-Policy, and the 4-digit PIN authentication system.
	appToken := *tokenFlag

	// Strip 'public' prefix from embedded filesystem
	subFS, err := fs.Sub(publicFS, "public")
	if err != nil {
		log.Fatalf("❌ Failed to load embedded assets: %v", err)
	}

	// Create API Server & Register Routes
	server := api.NewServer(db)
	server.SetLocalAppToken(appToken)
	server.SetAllowRemote(isLANShared)

	mux := http.NewServeMux()
	api.RegisterRoutes(mux, server, subFS)

	// Wrap entire router with security middleware (Anti-CSRF, Anti-DNS-Rebinding, Token Auth)
	secureHandler := server.SecurityMiddleware(mux)

	// Start TCP listener (with automatic fallback to available port in GUI desktop mode)
	listener, err := net.Listen("tcp", fmt.Sprintf("%s:%s", bindHost, bindPort))
	if err != nil {
		if isGUIMode && *portFlag == defaultPort {
			// Auto-fallback for desktop mode if default port 8080 is blocked by other non-RentBill software
			listener, err = net.Listen("tcp", fmt.Sprintf("%s:0", bindHost))
		}
		if err != nil {
			log.Fatalf("❌ Failed to bind to %s:%s: %v\n💡 If port %s is already in use by another app, choose a different port using '-port <number>' (e.g., ./rentbill -port 8085) or set PORT=8085.", bindHost, bindPort, err, bindPort)
		}
	}
	defer listener.Close()

	assignedPort := listener.Addr().(*net.TCPAddr).Port
	var localURL string
	if appToken != "" {
		localURL = fmt.Sprintf("http://127.0.0.1:%d/?token=%s", assignedPort, appToken)
	} else {
		localURL = fmt.Sprintf("http://127.0.0.1:%d/", assignedPort)
	}

	// Detect LAN IPs for mobile sharing
	var lanURLs []string
	for _, ip := range getLocalIPs() {
		if appToken != "" {
			lanURLs = append(lanURLs, fmt.Sprintf("http://%s:%d/?token=%s", ip, assignedPort, appToken))
		} else {
			lanURLs = append(lanURLs, fmt.Sprintf("http://%s:%d/", ip, assignedPort))
		}
	}
	server.SetNetworkInfo(assignedPort, lanURLs, isLANShared)

	httpServer := &http.Server{
		Handler:      secureHandler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server error: %v", err)
		}
	}()

	// Graceful shutdown channel
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Handle GUI Mode vs Server Mode
	if isGUIMode {
		engine := gui.FindBrowserEngine()
		fmt.Println("======================================================")
		fmt.Printf("    🏠  RentBill v%s - Local Pure Go GUI App\n", Version)
		fmt.Println("======================================================")
		fmt.Println("  • Application:   Local Native Desktop Window")
		if engine != "" {
			fmt.Printf("  • GUI Engine:    %s (Native App Mode)\n", filepath.Base(engine))
		} else {
			fmt.Println("  • GUI Engine:    Default OS Browser (Secured)")
		}
		fmt.Printf("  • Static Port:   %d (http://127.0.0.1:%d)\n", assignedPort, assignedPort)
		if isLANShared {
			fmt.Println("  • LAN Sharing:   ✅ ACTIVE (Accessible on Wi-Fi)")
			for _, u := range lanURLs {
				fmt.Printf("  • Mobile URL:    %s\n", u)
			}
		} else {
			fmt.Println("  • LAN Sharing:   🔒 Disabled (Local Desktop Loopback Only)")
			fmt.Println("  • Tip:           Run with '-share' to enable mobile phone access")
		}
		if appToken != "" {
			fmt.Println("  • Security:      Zero-Trust Token Auth (Anti-CSRF / Anti-Rebinding)")
		} else {
			fmt.Println("  • Security:      Zero-Trust Protected (Anti-CSRF / Rebinding / PIN)")
		}
		fmt.Printf("  • Database:      %s (Pure Go SQLite)\n", *dbPath)
		fmt.Println("======================================================")
		fmt.Println("  💡 Tip: Close the RentBill desktop window to exit.")
		fmt.Println("======================================================")

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		session, err := gui.LaunchWindow(ctx, localURL)
		if err != nil {
			log.Printf("⚠️ Could not open native app window: %v. Opening default browser...", err)
			_ = gui.OpenInDefaultBrowser(localURL)
		} else {
			// When user closes the GUI window, trigger graceful shutdown of backend
			go func() {
				_ = session.Wait()
				select {
				case stop <- os.Interrupt:
				default:
				}
			}()
			defer session.Close()
		}
	} else {
		// Server / Headless Mode
		fmt.Println("======================================================")
		fmt.Printf("    🏠  RentBill v%s - Server Mode\n", Version)
		fmt.Println("======================================================")
		fmt.Printf("  • Static Port:   %d\n", assignedPort)
		fmt.Printf("  • Bind Address:  %s:%d\n", bindHost, assignedPort)
		fmt.Printf("  • Local URL:     %s\n", localURL)
		if isLANShared {
			fmt.Println("  • LAN Sharing:   ✅ ACTIVE")
			for _, u := range lanURLs {
				fmt.Printf("  • Mobile / LAN:  %s\n", u)
			}
		} else {
			fmt.Println("  • LAN Sharing:   🔒 Loopback only (run with '-share' to enable)")
		}
		fmt.Printf("  • Database:      %s\n", *dbPath)
		fmt.Println("======================================================")
	}

	<-stop
	fmt.Println("\n🛑 Shutting down RentBill GUI & cleaning up...")
	ctxShut, cancelShut := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancelShut()
	_ = httpServer.Shutdown(ctxShut)
	fmt.Println("👋 Bye!")
}

// getLocalIPs returns non-loopback IPv4 addresses
func getLocalIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			if ip4 := ip.To4(); ip4 != nil {
				ips = append(ips, ip4.String())
			}
		}
	}
	return ips
}
