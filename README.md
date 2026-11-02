# 🏠 RentBill - Local Pure Go GUI App

RentBill is a modern, mobile-first rental management and billing application packaged into a **100% pure Go, statically linked native desktop application**.

It has **zero CGO dependencies** (`CGO_ENABLED=0`), requires no C compiler (`gcc`), no Node.js, and no external database server. The pure Go SQLite database and embedded UI run directly inside a secured native desktop application window.

---

## 🔒 Security Hardening (Zero-Trust Localhost Architecture)

Generic localhost web apps carry significant security risks (malicious websites in standard browsers can attempt CSRF, DNS rebinding, or port scanning). RentBill completely eliminates these risks:

1. **Native App Mode Window (No Browser Chrome)**:
   - Launches in a dedicated, isolated standalone desktop window (`--app` mode).
   - Operates with an isolated temporary user profile directory (`--user-data-dir`). No shared cookies, no browser extensions, no browsing history.
   - Closing the window cleanly terminates the Go process and removes temporary files.

2. **Strict Loopback Binding & Network Isolation**:
   - Binds strictly to `127.0.0.1` loopback by default, blocking external LAN/WAN access unless explicitly enabled with `-share` (or `make share`).

3. **Cryptographic One-Time Token Authentication**:
   - Generates a 256-bit cryptographic security token on every startup.
   - All API endpoints (`/api/*`) require the token via `X-RentBill-Token` header or `SameSite=Strict` cookie.
   - External tabs or third-party applications without this token receive `403 Forbidden`.

4. **Strict Anti-CSRF (Origin & Referer Validation)**:
   - Blocks any request carrying an external or third-party `Origin` or `Referer` header.

5. **Strict Anti-DNS-Rebinding (Host Header Validation)**:
   - Validates that the `Host` header strictly matches `127.0.0.1` or `localhost`. Rejects rebind attacks with `400 Bad Request`.

6. **Defense-in-Depth Security Headers**:
   - `Content-Security-Policy: default-src 'self' 'unsafe-inline' data:; connect-src 'self'; frame-ancestors 'none';`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `Cache-Control: no-store`

---

## 🚀 Quick Start

### 1. Launch the Desktop GUI Application
```bash
go run .
# Or build and launch binary:
make build
./rentbill
```

When started on desktop, RentBill automatically opens its native GUI application window:
```
======================================================
    🏠  RentBill v1.0.0 - Local Pure Go GUI App
======================================================
  • Application:   Local Native Desktop Window
  • GUI Engine:    chromium (Native App Mode)
  • Static Port:   8080 (http://127.0.0.1:8080)
  • LAN Sharing:   🔒 Disabled (Local Desktop Loopback Only)
  • Tip:           Run with '-share' to enable mobile phone access
  • Security:      Zero-Trust Token Auth (Anti-CSRF / Anti-Rebinding)
  • Database:      data/rentbill.db (Pure Go SQLite)
======================================================
  💡 Tip: Close the RentBill desktop window to exit.
======================================================
```

### 2. Run as Headless Server (Local or Wi-Fi Sharing)

You can run RentBill in headless server mode directly in your terminal:

```bash
# Local machine only (127.0.0.1:8080)
./rentbill.sh server
# or: make server

# With Wi-Fi mobile phone sharing enabled
./rentbill.sh server --share
# or: make share

# On a custom port
./rentbill.sh server --share --port 8085
```

---

### 3. Run as Background System Service (Auto-Start on Boot)

Install RentBill as an auto-starting systemd user service that keeps running in the background and restarts automatically on reboot:

```bash
# Install & start service with Wi-Fi mobile sharing enabled
./rentbill.sh install --share

# Check status or follow logs
./rentbill.sh status
./rentbill.sh logs
```

---

## ⚙️ CLI Flags & Environment Variables

| Flag | Default | Description |
|---|---|---|
| `-share`, `-lan` | `false` | Share RentBill over local network (Wi-Fi access for mobile phones on static port 8080) |
| `-port <port>` | `8080` | Static HTTP port to listen on across all modes |
| `-host <host>` | `127.0.0.1` | Host address to bind to (`0.0.0.0` when `-share` is enabled) |
| `-token <secret>` | `auto-generated` | Custom security token for API access |
| `-server`, `-headless`, `-no-gui` | `false` | Run as headless background server (without desktop GUI window) |
| `-allow-remote` | `false` | Allow non-localhost connections (alias for `-share`) |
| `-db-path <path>` | `~/.local/share/rentbill/rentbill.db` (or `./data/rentbill.db` if present) | Path to SQLite database file |
| `-reset-pin` | `false` | Emergency reset and disable 4-digit security PIN |
| `-version`, `-v` | `false` | Print version and architecture info |
| `-help`, `-h` | `false` | Display help and flag descriptions |

---

## 🛠️ Cross-Compilation (Pure Go, Zero C Toolchain Required)

```bash
# Linux AMD64 static binary
make linux

# Linux ARM64 (Raspberry Pi, Cloud ARM)
make linux-arm64

# Windows AMD64 standalone executable (rentbill.exe)
make windows

# macOS Apple Silicon (M1/M2/M3/M4)
make mac

# macOS Intel
make mac-intel

# Build all targets
make all
```

---

## 🐧 Linux CLI Manager (`rentbill.sh`)

Manage RentBill easily on Linux using the unified CLI script (`./rentbill.sh`).
It automatically detects and installs Go toolchains if needed, manages dependencies, runs foreground servers, and configures background `systemd` user services.

```bash
# Compile binary (auto-installs Go compiler & project dependencies if missing)
./rentbill.sh build
# or: make build

# Setup Go toolchain and verify module dependencies only
./rentbill.sh setup
# or: make setup

# Run headless server in foreground (supports --share and --port)
./rentbill.sh server --share --port 8080
# or: make share

# Install and start auto-starting background systemd service with Wi-Fi sharing
./rentbill.sh install --share
# or: make install-share

# Install background service for local loopback only (127.0.0.1)
./rentbill.sh install
# or: make install

# Install Linux desktop application shortcut (app launcher menu)
./rentbill.sh desktop --share
# or: make desktop

# Check background service status
./rentbill.sh status

# Follow live service logs
./rentbill.sh logs

# Rebuild binary and restart background service
./rentbill.sh update --share

# Stop, disable, and remove background service
./rentbill.sh remove
```

> **Note:** Commands accept both clean verbs (`build`, `install`, `server`, etc.) and standard flag syntax (`--build`, `--install`, `--server-install`, `--server`). Flags like `--share` (`-s`) and `--port <num>` (`-p`) can be passed in any position.

### Standard Linux File Locations (XDG Specification)
* **Binary**: `~/.local/bin/rentbill`
* **Database**: `~/.local/share/rentbill/rentbill.db`
* **Desktop Launcher**: `~/.local/share/applications/rentbill.desktop`
* **Icons**: `~/.local/share/icons/hicolor/scalable/apps/rentbill.svg`
* **Systemd Service**: `~/.config/systemd/user/rentbill.service`

---

## 🧪 Testing & Verification

```bash
# Run all unit tests including security middleware tests
make test

# Verify Go formatting and vet checks
make check
```
