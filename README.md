# RentBill — Smart Property & Rent Management

RentBill is a **pure Go**, single-binary desktop/local-server rental and billing manager with an embedded modern UI, SQLite storage, and a 4-digit PIN lock. Zero C toolchain, zero Node.js, zero external database.

---

## Quick Start

```bash
# Run locally (desktop GUI window)
go run .

# Or build first:
make build
./rentbill
```

Then open `http://127.0.0.1:8080`.

### Run as a server (headless or LAN sharing)

```bash
# Local only
./rentbill --server

# Share across Wi-Fi (phones/tablets on same network)
./rentbill --share --port 8080
```

Or use the wrapper script:
```bash
./rentbill.sh install --share   # systemd user service + desktop launcher
./rentbill.sh run               # foreground GUI
./rentbill.sh status
./rentbill.sh logs
```

---

## Build (cross-platform)

```bash
make build          # current platform
make linux          # Linux AMD64
make linux-arm64    # Linux ARM64 (Raspberry Pi)
make windows        # Windows .exe
make mac            # macOS Apple Silicon
make mac-intel      # macOS Intel
make all            # everything
```

---

## CLI Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `-port` | `8080` | HTTP port |
| `-share`, `-lan` | off | Enable Wi-Fi/LAN sharing |
| `-host` | `127.0.0.1` | Bind host |
| `-token` | (auto) | App security token |
| `-server` | off | Headless mode (no GUI) |
| `-reset-pin` | off | Disable forgotten PIN |
| `-db-path` | `~/.local/share/rentbill/rentbill.db` | SQLite DB path |

---

## Security

- Transport security headers (CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`)
- Anti-DNS-rebinding & anti-CSRF on every response
- Token auth on all `/api/*` endpoints (except `/api/health`)
- Optional 4-digit PIN lock with session cookie

---

## Data

Everything lives in one SQLite file (default: `~/.local/share/rentbill/rentbill.db`).

```bash
# Export all data
GET /api/backup/export

# Import backup
POST /api/backup/restore
```

---

## License

MIT © 2026 jaigansa
