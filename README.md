# RentBill Pro — Local-First Property & Rental Management System

**RentBill Pro** is a modern, high-performance rental and property management system built with a **Local-First, Offline-First** architecture. Engineered with a **Go** backend and embedded **SQLite (WAL mode)**, it delivers instantaneous 0ms local operations, background cloud sync to **Supabase**, and an accounting domain decoupled from the user interface.

---

## Key Highlights

- ⚡ **Local-First & Instant:** All queries and updates run directly against local SQLite (`outputs/data/rentbill.db`) with Write-Ahead Logging (WAL). Zero internet latency.
- 🔄 **Offline-First Cloud Sync:** Background worker automatically pushes outbox transactions to Supabase and pulls remote changes with Last-Write-Wins (LWW) conflict resolution.
- 🔓 **Direct Admin Access (Auth-Free):** No login screens, password prompts, or session gates. Launches directly into the full administrator workspace.
- 🧮 **Server-Side Go Accounting:** All financial math (electricity, water, late fees, discounts, net receivable, ledger reconciliation) is computed in integer paise (`1 INR = 100 paise`) in Go to prevent IEEE-754 floating-point errors.
- 🏠 **Complete Property Suite:** Manage properties, units, tenants, meter baselines/resets, invoices, payments, maintenance orders, expenses, and documents.
- 📱 **Cross-Platform Single Binary:** Standalone Go server executable serves the static frontend and REST endpoints.
- 🌐 **Bilingual:** Full native support for English and Tamil (தமிழ்).

---

## Project Structure

```
rentbills/
├── main.go                          # Wails desktop app entrypoint & asset embedder
├── app.go                           # Wails lifecycle, dynamic DB path & internal API proxy
├── wails.json                       # Wails project & build configuration
├── backend/
│   ├── cmd/server/main.go           # Headless Go HTTP server (serves frontend, REST API)
│   └── pkg/
│       ├── accounting/              # Pure Go integer paise calculation engine
│       ├── api/                     # REST API endpoints (/api/accounting, /api/data, /api/sync)
│       ├── db/                      # Pure-Go SQLite WAL database & sync_outbox
│       └── sync/                    # Supabase background sync worker
│
├── frontend/
│   ├── index.html                   # Master application entrypoint
│   ├── main.js                      # Application lifecycle & event coordinator
│   ├── library/
│   │   └── lucide.min.js            # Vendored offline icons library
│   ├── ui/
│   │   ├── css/                     # Stylesheets (app.css, base, components, layout, modules)
│   │   ├── i18n/                    # Localization dictionaries (en.json, ta.json)
│   │   └── layout/                  # Modular HTML templates (header, mobile-nav, modals, pages)
│   └── functions/
│       ├── core/                    # Core libraries (db, format, config, state, theme, ui)
│       └── modules/                 # UI controllers (bills, dashboard, properties, payments, etc.)
│
├── build/bin/
│   └── rentbill-pro                 # Compiled lightweight cross-platform desktop binary
│
├── manuals/
│   ├── USER_MANUAL.md               # User guide for rental management & billing
│   ├── ARCHITECTURE.md              # System design & technical architecture
│   └── ACCOUNTING_SPEC.md           # Mathematical rules & ledger specification
│
└── package.json                     # Development scripts & test runner
```

---

## Quick Start

### Option 1: Run the Pre-Compiled Go Server (Recommended)

Simply launch the executable from the `outputs/` directory:

```bash
.\outputs\builds\rentbill-server.exe
```

Open your browser at **`http://localhost:8080`**.

### Option 2: Run via NPM

```bash
# Install development dependencies (if running tests)
npm install

# Start the Go server in development mode
npm run dev
```

---

## Cloud Sync Configuration (Optional)

RentBill Pro is fully functional standalone offline. If you want multi-device cloud synchronization via Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Run your Supabase database schema migrations.
3. Open RentBill Pro and navigate to **Settings** → **Configure Supabase**.
4. Enter your **Supabase Project URL** and **Publishable / Anon Key**.
5. Save settings. The Go sync worker will automatically stream pending changes from `sync_outbox` to the cloud.

---

## Developer Commands & Testing

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Go local-first server on port 8080 |
| `npm run check` | Run Node syntax checks across all frontend modules |
| `npm test` | Run the complete Node test suite (64 tests) |
| `npm run test:go` | Run all Go backend unit tests (`accounting`, `api`, `db`, `sync`) |
| `npm run go:build` | Compile the Go server to `outputs/builds/rentbill-server.exe` |

---

## Documentation Manuals

Detailed documentation is available in the [`manuals/`](manuals/) directory:

- 📖 [**User Manual**](manuals/USER_MANUAL.md) — Complete operational guide for managing properties, recording meter readings, generating WhatsApp receipts, and tracking payments.
- 🏗️ [**Architecture Guide**](manuals/ARCHITECTURE.md) — Detailed explanation of the Go backend, SQLite WAL storage, sync engine, and frontend organization.
- 📐 [**Accounting Specification**](manuals/ACCOUNTING_SPEC.md) — Exact mathematical formulas, bill calculation lifecycle, integer paise arithmetic, and ledger double-entry reconciliation.

---

## License

MIT License — free for personal and commercial property management.
