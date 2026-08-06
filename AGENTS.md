# RentBill Pro - Agent Guide

## Build & Run
```bash
# Windows
.\win.bat build    # Build rentbill.exe
.\win.bat install  # Setup dirs, config.json, build
.\win.bat run      # Run server (port 8080)
.\win.bat pack     # Create release zip

# Linux/macOS
./linux.sh build
./linux.sh install
./linux.sh run
./linux.sh pack
```

## Architecture
- **Single binary** with embedded UI (`//go:embed` in `static.go`)
- Go 1.22 + Gin + SQLite (modernc.org/sqlite, WAL mode)
- Frontend: vanilla JS/CSS in `ui/` (embedded at compile time)
- No external runtime deps — deploy single executable

## Key Files
| File | Purpose |
|------|---------|
| `main.go` | Entry point, routes, middleware |
| `internal/api/handlers.go` | All REST endpoints (~2100 lines) |
| `internal/api/database.go` | SQLite schema, indexes, migrations |
| `internal/api/models.go` | Structs for renters, bills, units, etc. |
| `internal/api/config.go` | Config loading, encryption, bcrypt |
| `internal/api/events.go` | SSE real-time sync |

## Database (SQLite, `rentbill.db`)
- Tables: `renters`, `bills`, `units`, `expenses`, `owner_withdrawals`, `maintenance_tasks`, `documents`, `properties`, `users`, `activity_logs`
- WAL mode, FK enabled, composite indexes
- Key index: `idx_bills_renter_month` on `(renter_id, billing_month)`
- Auto-backup on startup (`StartAutoBackup()`)

## Config (`config.json`)
- Created from `config.example.json` on first `install`
- Default admin PIN: `1234` (bcrypt hash stored in `master_pin_hash`)
- Email password encrypted with AES-GCM using `session_secret`
- `session_secret` must be ≥16 chars (fallback set if not)

## Billing Logic (handlers.go)
- **Monthly cycles only** — `billing_month` stored as "Month Year" (e.g. "August 2026")
- Due date: **5th of following month** (frontend only, `main.js:177`)
- Rent calc: `base_rent + maint + water + EB + others + arrears - discount`
- Water: `FIXED` (flat `water_maint`) or `METERED` (reading diff × `water_unit_price`)
- Arrears: `pending_arrears` on renter, carried into next bill via `arrears_included`

## Common Tasks
| Task | Command / Location |
|------|-------------------|
| Add route | `main.go` → `v1.Group("/api")` + handler in `handlers.go` |
| Modify schema | `database.go` → `InitDB()` migrations + new indexes |
| Change billing formula | `handlers.go` → `CreateBill`/`CreateBatchBills` (~line 892) |
| Add DB query | Use existing patterns in `handlers.go` (check for N+1) |
| Debug DB | `sqlite3 rentbill.db` (WAL mode, check `idx_bills_renter_month`) |

## Known Quirks
- **No backend due date enforcement** — 5th of next month is UI-only
- **No transactions** on `CreateBill`/`DeleteBill` — race condition on `pending_arrears`
- **N+1 queries** in `GetTenantLedger` (correlated subqueries), `CreateBatchBills` (loop SELECT), `GetTrendData` (6×3 queries)
- **Missing indexes**: `billing_month`, `date_generated`, `payment_date`, `(renter_id, is_paid)`
- `billing_month` parsing uses `time.Parse("January 2006", month)` — locale-sensitive
- Tenant moving in on last day of month gets billed for full month

## Testing
- No formal test suite — manual verification via UI
- Run `go build` to verify compiles
- `go mod tidy` before commit

## Deployment
- Binary runs standalone: `./rentbill` (or `rentbill.exe`)
- Needs `./uploads/` and `./backups/` dirs (created by `install`)
- Config at `./config.json`, DB at `./rentbill.db`
- Default port: 8080 (set `server_port` in config)