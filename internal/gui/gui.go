package gui

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
)

// WindowSession manages the lifecycle of the local desktop GUI window
type WindowSession struct {
	cmd     *exec.Cmd
	tempDir string
	closed  bool
	mu      sync.Mutex
}

// IsDesktopAvailable returns true if a graphical display environment is detected
func IsDesktopAvailable() bool {
	switch runtime.GOOS {
	case "windows", "darwin":
		return true
	default: // Linux, BSD
		return os.Getenv("DISPLAY") != "" || os.Getenv("WAYLAND_DISPLAY") != ""
	}
}

// FindBrowserEngine discovers an installed Chromium-based browser engine
func FindBrowserEngine() string {
	var candidates []string

	switch runtime.GOOS {
	case "windows":
		candidates = []string{
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
			"msedge.exe",
			"chrome.exe",
			"brave.exe",
		}
	case "darwin":
		candidates = []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
	default: // Linux, BSD
		candidates = []string{
			"chromium",
			"google-chrome",
			"google-chrome-stable",
			"brave",
			"brave-browser",
			"microsoft-edge",
			"microsoft-edge-stable",
			"chromium-browser",
		}
	}

	for _, c := range candidates {
		if path, err := exec.LookPath(c); err == nil {
			return path
		}
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

// LaunchWindow starts an isolated desktop application window pointing to the given URL
func LaunchWindow(ctx context.Context, targetURL string) (*WindowSession, error) {
	engine := FindBrowserEngine()

	// If no Chromium engine found, fallback to OS default browser
	if engine == "" {
		if err := OpenInDefaultBrowser(targetURL); err != nil {
			return nil, fmt.Errorf("failed to launch browser: %w", err)
		}
		return &WindowSession{}, nil
	}

	// Create an isolated temporary user profile directory (no shared cookies, no extensions)
	tempDir, err := os.MkdirTemp("", "rentbill_gui_*")
	if err != nil {
		tempDir = ""
	}

	args := []string{
		fmt.Sprintf("--app=%s", targetURL),
		"--class=rentbill",
		"--name=rentbill",
		"--window-size=480,850",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-extensions",
		"--disable-sync",
		"--disable-background-networking",
		"--disable-default-apps",
	}

	if tempDir != "" {
		args = append(args, fmt.Sprintf("--user-data-dir=%s", tempDir))
	}

	// On Linux Wayland, allow native Wayland rendering
	if runtime.GOOS == "linux" && os.Getenv("WAYLAND_DISPLAY") != "" {
		args = append(args, "--ozone-platform-hint=auto")
	}

	cmd := exec.CommandContext(ctx, engine, args...)
	if err := cmd.Start(); err != nil {
		if tempDir != "" {
			_ = os.RemoveAll(tempDir)
		}
		return nil, fmt.Errorf("error starting GUI window (%s): %w", engine, err)
	}

	session := &WindowSession{
		cmd:     cmd,
		tempDir: tempDir,
	}

	return session, nil
}

// Wait blocks until the GUI window is closed by the user
func (s *WindowSession) Wait() error {
	if s.cmd == nil {
		// No child process to wait on (fallback browser mode);
		// return immediately — shutdown is driven by OS signals.
		return nil
	}
	err := s.cmd.Wait()
	s.Close()
	return err
}

// Close terminates the GUI window and cleans up temporary profile data
func (s *WindowSession) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return
	}
	s.closed = true

	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	if s.tempDir != "" {
		_ = os.RemoveAll(s.tempDir)
		s.tempDir = ""
	}
}

// OpenInDefaultBrowser opens target URL in standard OS browser
func OpenInDefaultBrowser(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default:
		cmd = "xdg-open"
		args = []string{url}
	}

	return exec.Command(cmd, args...).Start()
}
