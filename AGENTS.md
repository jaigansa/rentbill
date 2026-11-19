# RentBill — Agent Instructions (Full App Reference)

RentBill is a **Pure Go** desktop/local-server rental & billing management application. It serves an embedded single-page HTML/JS frontend over HTTP with SQLite storage (`modernc.org/sqlite`, `CGO_ENABLED=0`). Module: `rentbill` (Go 1.25+).

Use this file as the authoritative reference before making any change.

---

## 1. Project Layout

```
main.go              # CLI entry, HTTP server, DB init, GUI launcher
internal/api/        # HTTP handlers, routes, security middleware, server struct
internal/database/   # SQLite schema, models, queries per domain
internal/gui/        # Desktop window launcher (Chromium app mode / default browser)
public/              # Embedded frontend (index.html, css, js, fonts, icons)
  index.html         # Single-page SPA (tabs: dashboard, tenants, properties + modals)
  css/style.css      # All styles
  js/api.js          # API client (fetchWithAuth + per-resource functions)
  js/app.js          # Core App orchestrator (state, init, batch bills, CSV export)
  js/modules/*.js    # auth, ui, utils, properties, tenants, bills, settlement, reminders, theme
scripts/             # build.sh, test.sh
rentbill.sh          # Linux install/run/status/logs/uninstall wrapper (bash)
Makefile             # build/test/check/cross-compile targets
go.mod / go.sum      # Go module (sqlite stack marked indirect)
```

### Runtime modes (`main.go`)
- **GUI desktop (default):** binds `127.0.0.1:8080`, opens a Chromium app window via `gui.LaunchWindow`, falls back to default browser.
- **Headless server (`-server`):** no GUI window; just the HTTP server.
- **LAN sharing (`-share` / `-allow-remote`):** binds `0.0.0.0` so phones on Wi-Fi can reach it.
- **Security token (`-token`):** enforces `X-RentBill-Token` / cookie on all `/api/` endpoints except `/api/health`.
- **4-digit PIN:** per-endpoint `AuthMiddleware`; session cookie `rentbill_session`.

### Commands
```
make build          # CGO_ENABLED=0 go build -o rentbill .
make run            # go run .
make test           # go test -v ./...
make check          # go vet ./... + gofmt -l . (must be empty)
make clean          # remove binaries
./rentbill.sh install --share   # Linux systemd user service + desktop launcher
```

---

## 2. Backend — Go Source Reference

### `main.go`
Owns the process lifecycle:
- CLI flags via `flag` package (`-port`, `-host`, `-share`, `-lan`, `-token`, `-db-path`, `-server`, `-reset-pin`, `-version`).
- `getDefaultDBPath()` — XDG data dir with fallbacks (`data/rentbill.db`, `RENTBILL_DB_PATH`).
- `tryConnectRunningInstance(port)` — detects an already-running RentBill on the port (GUI reconnects to it instead of starting a second server).
- `generateSecurityToken()` — **REMOVED** (was unused). Do not re-add unless wired to a caller.
- `getLocalIPs()` — enumerates non-loopback IPv4 for LAN URL display.
- Starts `http.Server` with `ReadTimeout`/`WriteTimeout` 15s, graceful shutdown on `SIGINT`/`SIGTERM` or GUI window close.

### `internal/api/server.go`
- `Server` struct: `db`, `LocalAppToken`, `AllowRemote`, `StaticPort`, `LANURLs`, `IsLANShared`.
- `NewServer(db)`, `SetLocalAppToken`, `SetAllowRemote`, `SetNetworkInfo`.
- JSON helpers: `sendJSON(w, status, data)`, `sendError(w, status, msg)`.

### `internal/api/routes.go` — Full endpoint catalog

Public (no auth):
- `GET /api/health` — `{"status":"ok","app":"rentbill"}`

Protected (`server.AuthMiddleware` wraps when PIN enabled):
- `GET /api/dashboard` — `HandleDashboard`
- `GET /api/properties` / `POST /api/properties` — `HandleProperties`
- `GET /api/properties/{id}` / `PUT` / `DELETE` — `HandlePropertyDetail`
- `GET /api/properties/{id}/expenses` — `HandlePropertyExpenses`
- `GET /api/expenses` / `POST /api/expenses` — `HandleExpenses`
- `GET /api/expenses/{id}` / `PUT` / `DELETE` — `HandleExpenseDetail`
- `GET /api/tenants` / `POST /api/tenants` — `HandleTenants`
- `GET /api/tenants/{id}` / `PUT` / `DELETE` — `HandleTenantDetail`
- `GET /api/tenants/{id}/last-bill` — `HandleTenantLastBill`
- `GET /api/tenants/{id}/ledger` — `HandleTenantLedger`
- `GET /api/bills` / `POST /api/bills` — `HandleBills`
- `GET /api/bills/{id}` / `PUT` / `DELETE` — `HandleBillDetail`
- `GET /api/bills/batch/preview` — `HandleBatchPreview`
- `POST /api/bills/batch` — `HandleBatchCreateBills`
- `GET /api/bills/{id}/payments` — `HandleBillPayments`
- `GET /api/payments` / `POST /api/payments` — `HandlePayments`
- `GET /api/payments/{id}` / `PUT` / `DELETE` — `HandlePaymentDetail`
- `GET /api/settings` / `POST /api/settings` — `HandleSettings`
- `GET /api/backup/export` — `HandleBackupExport`
- `POST /api/backup/restore` — `HandleBackupRestore`

PIN / session (no AuthMiddleware):
- `GET /api/auth/status` — `HandleAuthStatus`
- `POST /api/auth/verify` — `HandleAuthVerify`
- `POST /api/auth/set-pin` — `HandleAuthSetPIN`
- `POST /api/auth/disable-pin` — `HandleAuthDisablePIN`
- `POST /api/auth/logout` — `HandleAuthLogout`

Static:
- `GET /` — embedded `public/` file server; sets `rb_app_token` cookie when `?token=` matches `LocalAppToken`.

Middleware (`SecurityMiddleware` applied to everything):
1. Security headers (CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy).
2. Anti-DNS-rebinding: `isAllowedHost` — localhost/127.0.0.1/::1 always; private IPs only if `AllowRemote`.
3. Anti-CSRF: `Origin` and `Referer` must match allowed host.
4. Token auth: if `LocalAppToken != ""`, require it on `/api/*` except `/api/health` (header `X-RentBill-Token`, cookie `rb_app_token`, or query `token`).

### `internal/api/*_handlers.go`
Each file holds the handlers for one resource. All read `r.PathValue("id")` with a fallback manual parse. Responses use `sendJSON`/`sendError`. Key behaviors:
- `HandleBills` — GET list (optionally `?tenant_id=`), POST create (recalculates units/amounts in `db.CreateBill`).
- `HandleBatchCreateBills` — 1-click monthly roll: carries prev meter readings + arrears, idempotent per month (skips tenants already billed).
- `HandlePropertyExpenses` — note: extracts id by trimming `/expenses` suffix from path (legacy fallback alongside `PathValue`).
- `HandleAuthVerify` — creates session, sets `rentbill_session` cookie (HttpOnly, 30 days).
- `HandleBackupExport` — streams full `BackupData` JSON as attachment.
- `HandleBackupRestore` — clears all tables then restores properties→tenants→bills→payments→expenses→settings in one transaction.

### `internal/database/db.go`
- `InitDB(dataSourceName)` — `sql.Open("sqlite", ...)`, `SetMaxOpenConns(1)` (single connection to avoid SQLite lock collisions), WAL journal, `busy_timeout`, `foreign_keys=ON`, `createTables`.
- `createTables` — schema for `properties`, `tenants`, `bills`, `payments`, `expenses`, `app_settings`, `app_sessions` + dynamic `ALTER TABLE` migrations for existing DBs.

### `internal/database/models.go`
Structs: `Property`, `Expense`, `CoOccupant`, `TenantDocument`, `Tenant`, `Bill`, `Payment`, `LedgerEntry`, `TenantLedger`, `BatchBillEntry`, `BatchBillPreviewItem`, `DashboardAlerts`, `DashboardSummary`. Plus `GenerateBillNumber()`.

### `internal/database/*` — query implementations
| File | Functions |
|------|-----------|
| `bills.go` | `GetLatestBillForTenant`, `CreateBill`, `GetAllBills`, `GetBillsByTenant`, `GetBillByID`, `UpdateBill`, `DeleteBill`, `recalcBillStatusInTx`, `RecordPayment`, `GetPaymentByID`, `GetPaymentsByBillID`, `UpdatePayment`, `DeletePayment`, `GetAllPayments`, `GetBatchBillPreview`, `BatchCreateMonthlyBills` |
| `tenants.go` | `CreateTenant`, `GetAllTenants`, `GetTenantByID`, `UpdateTenant`, `DeleteTenant`, `GetTenantLedger`, `formatBillingMonth` |
| `properties.go` | `CreateProperty`, `GetAllProperties`, `GetPropertyByID`, `UpdateProperty`, `DeleteProperty` |
| `expenses.go` | `CreateExpense`, `GetExpensesByProperty`, `GetExpenseByID`, `UpdateExpense`, `DeleteExpense` |
| `dashboard.go` | `GetDashboardSummary` (financials, overdue bills, unbilled tenants, deposits held) |
| `backup.go` | `BackupData` struct, `GetAllExpenses`, `ExportBackup`, `RestoreBackup` |
| `auth.go` | `hashPIN`, `IsPINEnabled`, `SetPIN`, `VerifyPIN`, `DisablePIN`, `CreateSession`, `ValidateSession`, `RevokeSession`, `RevokeAllSessions` |
| `settings.go` | `SetSetting`, `GetSetting` |

### `internal/gui/gui.go`
- `IsDesktopAvailable()` — DISPLAY/WAYLAND_DISPLAY on Linux; always true on Windows/macOS.
- `FindBrowserEngine()` — locates Chromium/Chrome/Brave/Edge.
- `LaunchWindow(ctx, url)` — isolated temp user-data-dir, `--app=` mode, 480x850 window.
- `WindowSession.Wait()` / `Close()` — lifecycle + temp dir cleanup.
- `OpenInDefaultBrowser(url)` — `rundll32` / `open` / `xdg-open`.

---

## 3. Database Schema

Tables (created in `createTables`, with migrations for older files):

**properties** — id, name, address, unit_type, default_rent, electricity_rate, water_billing_type (FIXED/METER), water_charge, water_rate, maintenance_charge, created_at

**tenants** — id, name, phone, email, property_id (FK→properties SET NULL), security_deposit, opening_arrear, move_in_date, payment_upi/bank_name/account_no/ifsc, initial_elec_meter, initial_water_meter, preferred_channel (SMS_RCS/WHATSAPP/BOTH), co_occupants (JSON), co_occupant_name/phone, photo, documents (JSON), is_active, created_at

**bills** — id, bill_number (UNIQUE), tenant_id, property_id, billing_month, billing_period_start/end, due_date, base_rent, prev/curr_electricity_meter, electricity_rate/units/amount, water_billing_type, prev/curr_water_meter, water_rate/units/amount, maintenance_amount, other_charges/desc, discount_amount/reason, previous_balance, total_amount, paid_amount, status (PENDING/PARTIAL/PAID/OVERDUE), notes, created_at

**payments** — id, bill_id (FK CASCADE), amount, payment_date, payment_method, reference_no, notes, created_at

**expenses** — id, property_id (FK CASCADE), title, category, amount, expense_date, paid_to, payment_method, notes, created_at

**app_settings** — key (PK), value

**app_sessions** — token (PK), created_at, last_active

Status auto-recalculated on payment record/update/delete via `recalcBillStatusInTx` and in `UpdateBill`.

---

## 4. Frontend Reference

`public/index.html` is a single-file SPA. `window.App` (from `public/js/app.js`) orchestrates; modules are spread into `App`:
`Utils, UI, Auth, Properties, Tenants, Bills, Settlement, Reminders, Theme`.

`public/js/api.js` exports `API` — centralized `fetchWithAuth` that:
- sends `Authorization: Bearer <rentbill_session_token>` from localStorage,
- sends `X-RentBill-Token` from sessionStorage `rb_app_token`,
- uses `credentials: 'same-origin'`,
- on 401 (except auth endpoints) clears session and locks the app.

Tabs/views: `dashboard`, `tenants`, `properties`. Modals: property, tenant, doc-preview, avatar-zoom, vacant-calculation (move-out settlement), ledger, property-expenses, unit-detail, batch-bills, settings.

Key app flows:
- **Batch bills:** `GET /api/bills/batch/preview?month=` → per-tenant meter input roll → `POST /api/bills/batch` with `entries[{tenant_id, curr_electricity_meter, curr_water_meter}]`.
- **Vacant settlement:** credits (deposit + extra) vs debits (arrears, utilities, prorated rent, deductions) → net refund/due → optional bill record.
- **CSV export:** bills, expenses, payments, tenants (client-side `downloadCSV`).
- **PIN lock:** `Auth.lockApp()` shown when 401 or PIN enabled; unlock via `/api/auth/verify`.

Styling: CSS custom properties (`--primary`, `--success`, `--danger`, `--warning`, `--radius-md`, etc.), `data-theme` attribute for dark/light/system. Lucide icons (`data-lucide`) rendered via `refreshIcons()`.

---

## 5. Security Model (do not bypass)

1. **Transport security headers** on every response: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
2. **Anti-DNS-rebinding** — `isAllowedHost(host, allowRemote)`. Host must be localhost/127.0.0.1/::1, or a private/link-local IP if LAN sharing is on. Public IPs/domains rejected with 400.
3. **Anti-CSRF** — `Origin`/`Referer` validated against allowed host; external origins → 403.
4. **Token auth** — when `-token` set, all `/api/*` (except `/api/health`) require `X-RentBill-Token` / `rb_app_token` cookie / `?token=` query → 403 if missing/wrong.
5. **PIN auth** — `AuthMiddleware` gates protected endpoints when `app_pin_enabled=true`; session cookie `rentbill_session` (HttpOnly, 30 days).
6. **Right-click disabled** in frontend (`contextmenu` prevented).

Rule: any new `/api/` route must be registered in `RegisterRoutes` and wrapped with `server.AuthMiddleware(...)` if it touches data. Never register a route outside `SecurityMiddleware`.

---

## 6. Build / Test / Lint Conventions

```
go build ./...          # compile all packages
go vet ./...            # static analysis (must pass)
gofmt -l .              # must print nothing (all files formatted)
go test ./...           # run all tests (internal/api, internal/database)
```

- `CGO_ENABLED=0` always (pure Go static binary, no C toolchain).
- `go.mod` dependencies are `// indirect` (transitive sqlite stack). Do not add direct dependencies unless actually imported in source.
- **No unused code.** `go build`/`go vet` catch unused imports/variables but NOT unused functions/types/files. Audit before finishing: grep for the symbol; if only its own definition matches, remove it (this is why `src/main.rs` and `generateSecurityToken()` were deleted).
- Tests live next to code: `internal/api/api_test.go`, `internal/database/db_test.go`. New DB/API features should add test coverage using `setupTestDB` / `setupTestServer` helpers.
- GUI package (`internal/gui`) has no tests; changes there are verified by `go build`/`go vet`.

---

## 7. How to Add a New Feature (Backend + Frontend)

### Adding a new API resource (example: "invoices")
1. **DB layer:** add query funcs in `internal/database/invoices.go` (methods on `*DB`). Add model struct in `models.go` if needed.
2. **Handler:** add `HandleInvoices` (and detail variant) in `internal/api/invoice_handlers.go`, methods on `*Server`, using `sendJSON`/`sendError`, `r.PathValue("id")`.
3. **Route:** register in `routes.go` `RegisterRoutes`, wrapped with `server.AuthMiddleware(...)`:
   ```go
   mux.HandleFunc("/api/invoices", server.AuthMiddleware(server.HandleInvoices))
   mux.HandleFunc("/api/invoices/{id}", server.AuthMiddleware(server.HandleInvoiceDetail))
   ```
4. **Frontend client:** add `async getInvoices()`, `createInvoice(data)`, etc. to `public/js/api.js` using `API.fetchWithAuth`.
5. **Frontend UI:** add tab/section or modal in `public/index.html`, bind in `app.js` `bindForms()`, spread module into `App`, call `API.*` and re-render lists via `refreshAll()`.
6. **Tests:** add cases to `api_test.go` / `db_test.go` using `setupTestServer` / `setupTestDB`.
7. **Verify:** `make check` && `make test`.

### Adding a new DB column
- Add to `CREATE TABLE` in `db.go` `createTables` schema.
- Add an `ALTER TABLE ... ADD COLUMN` migration entry so existing DB files get it.
- Add field to the model struct in `models.go` with `json` tag.
- Update scan targets in all query funcs that read the table.

---

## 8. Common Tasks

| Task | How |
|------|-----|
| Run server locally | `make run` (GUI) or `make server` (headless, port 8080) |
| Run with LAN sharing | `make share` or `./rentbill.sh run --share` |
| Install as systemd service | `./rentbill.sh install --share` |
| Build static binary | `make build` (or cross: `make linux-arm64`, `make windows`, `make mac`) |
| Run full test+lint | `make check && make test` |
| Reset forgotten PIN | `./rentbill -reset-pin` (disables PIN) |
| Change DB path | `RENTBILL_DB_PATH=/path/to/db.sqlite ./rentbill` or `-db-path` |
| Export all data | `GET /api/backup/export` → JSON; import via `POST /api/backup/restore` |
| Add cross-platform binary | add to `Makefile` `all` target if a new platform needed |

---

## 9. Rules (from cleanup history — enforce these)

1. **Never commit unused code.** If `grep` shows a function/type/file is only referenced by its own definition, delete it. (Removed: `src/main.rs`, `generateSecurityToken()`.)
2. **No Rust/Cargo.** This is Go-only. `scripts/build.sh`/`scripts/test.sh` check for `Cargo.toml`/`package.json` as fallbacks but they are not used. Do not add Rust files.
3. **`gofmt -l .` must be empty.** Run `gofmt -w` on edited Go files.
4. **Every `/api/` route behind `SecurityMiddleware` + `AuthMiddleware`** (except `/api/health` and auth endpoints).
5. **Tests must pass** (`make test`) before considering a change done.

---

## 10. When in Doubt

Run `make check` and `make test`. If they pass, the code is formatted, vetted, tested, and the new symbol is referenced somewhere, the change is consistent with repo conventions.