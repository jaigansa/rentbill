# RentBill Pro — Architecture & Folder Structure Specification

## 1. Architectural Overview

RentBill Pro is engineered around a **Local-First, Offline-First** architectural pattern. All database reads and writes execute against a local SQLite database in milliseconds, while a background worker synchronizes mutations with Supabase. Accounting logic is completely separated from the UI and executed in Go integer arithmetic.

```
┌────────────────────────────────────────────────────────┐
│               Frontend Presentation Layer              │
│  (HTML5 + Vanilla CSS + Modular ES6 JS Modules)        │
│                                                        │
│   ui/layout/         ui/css/          ui/i18n/         │
│   (Templates)        (Styling)        (Dictionaries)   │
└──────────────────────────┬─────────────────────────────┘
                           │ JSON RPC / REST
                           ▼
┌────────────────────────────────────────────────────────┐
│            Backend Go Service Layer (Go 1.22+)         │
│                                                        │
│   cmd/server/main.go  ─ Static file & API router       │
│   internal/api/       ─ REST handlers for CRUD & Sync  │
│   internal/accounting ─ 100% Go Financial Domain Engine│
│   internal/db/        ─ SQLite WAL + sync_outbox       │
│   internal/sync/      ─ Goroutine Last-Write-Wins Sync │
└──────────────────────────┬─────────────────────────────┘
                           │ Background Outbox Push/Pull
                           ▼
┌────────────────────────────────────────────────────────┐
│           Remote Supabase (PostgreSQL Cloud)           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

The repository follows a clean, decoupled structure:

```
rentbills/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go              # Go HTTP server, flag parser, router
│   ├── internal/
│   │   ├── accounting/
│   │   │   ├── engine.go            # Pure Go financial calculation domain
│   │   │   └── engine_test.go       # Integer paise arithmetic test suite
│   │   ├── api/
│   │   │   ├── handlers.go          # Endpoints: /api/accounting, /api/data, /api/sync
│   │   │   └── handlers_test.go     # API integration tests
│   │   ├── db/
│   │   │   ├── sqlite.go            # modernc.org/sqlite pure-Go driver & schema
│   │   │   └── sqlite_test.go       # Transaction & outbox tests
│   │   └── sync/
│   │       ├── engine.go            # Goroutine background sync with Supabase
│   │       └── engine_test.go       # Offline & conflict resolution tests
│   ├── go.mod                       # Go module dependencies
│   └── go.sum
│
├── frontend/
│   ├── index.html                   # Master entry HTML shell (no auth gating)
│   ├── main.js                      # Application lifecycle & event coordinator
│   ├── library/
│   │   └── lucide.min.js            # Vendored offline icons library
│   ├── ui/
│   │   ├── css/
│   │   │   ├── app.css              # Master styling bundle
│   │   │   ├── base.css             # Design tokens, variables, resets
│   │   │   ├── components.css       # Cards, buttons, tables, badges
│   │   │   ├── layout.css           # Grid, sidebar, responsive breakpoints
│   │   │   └── modules.css          # Page-specific styling rules
│   │   ├── i18n/
│   │   │   ├── en.json              # English localized strings
│   │   │   └── ta.json              # Tamil (தமிழ்) localized strings
│   │   └── layout/
│   │       ├── header.html          # Top navigation bar & user profile
│   │       ├── mobile-nav.html      # Bottom mobile navigation
│   │       ├── modals.html          # Dynamic dialog modal templates
│   │       └── pages/               # Modular workspace page sections
│   │           ├── bills.html
│   │           ├── dashboard.html
│   │           ├── diagnostics.html
│   │           ├── documents.html
│   │           ├── expenses.html
│   │           ├── maintenance.html
│   │           ├── owners.html
│   │           ├── payments.html
│   │           ├── properties.html
│   │           └── settings.html
│   └── functions/
│       ├── core/
│       │   ├── config.js            # Supabase & LocalFirstClient configuration
│       │   ├── db.js                # Data access abstractions (safeInsert, etc.)
│       │   ├── finance.js           # Lightweight client calculation adapters
│       │   ├── format.js            # Formatting (currency, dates, invoices, CSV)
│       │   ├── i18n.js              # Translation loader & DOM applier
│       │   ├── layout.js            # Async template loader & DOM mounter
│       │   ├── local_client.js      # Local-first client mimicking Supabase API
│       │   ├── state.js             # Client state management
│       │   ├── theme.js             # Dark / Light theme engine
│       │   └── ui.js                # Modal, dropdown, and UI helpers
│       └── modules/
│           ├── auth.js              # Direct Admin authentication gatekeeper
│           ├── backups.js           # JSON backup/restore & settings
│           ├── bills.js             # Billing UI coordinator
│           ├── dashboard.js         # KPI metrics & quick stats
│           ├── diagnostics.js       # System health & network checks
│           ├── documents.js         # Document management & file attachments
│           ├── expenses.js          # Expense tracking & owner withdrawals
│           ├── forms.js             # Form submission handlers
│           ├── maintenance.js       # Maintenance work order tracking
│           ├── navigation.js        # Single-page app routing & tabs
│           ├── owners.js            # Property owners management
│           ├── payments.js          # Payments & receipt generation
│           ├── properties.js        # Properties, units & tenants
│           └── realtime.js          # Supabase realtime listener manager
│
├── outputs/
│   ├── builds/
│   │   └── rentbill-server.exe      # Compiled cross-platform Go executable
│   └── data/
│       └── rentbill.db              # Embedded SQLite WAL database file
│
├── manuals/
│   ├── USER_MANUAL.md               # User guide for property operations
│   ├── ARCHITECTURE.md              # System design & folder structure
│   └── ACCOUNTING_SPEC.md           # Mathematical rules & ledger specification
│
└── package.json                     # Development scripts & test runner
```

---

## 3. Data Flow & Synchronization

1. **User Action:** The user creates or updates a record in the UI.
2. **Local Write:** `LocalFirstClient` issues an HTTP POST/PUT/DELETE to `/api/data/:table`.
3. **Database Transaction:**
   - In Go, `backend/internal/db/sqlite.go` opens an SQLite transaction.
   - The record is written to the target table.
   - An entry is immediately recorded in `sync_outbox` with operation type (`INSERT`, `UPDATE`, `DELETE`) and timestamp.
4. **Background Sync Worker (`backend/internal/sync/engine.go`):**
   - Polls `sync_outbox` periodically or upon manual trigger.
   - Pushes pending mutations to the remote Supabase PostgreSQL instance via PostgREST.
   - Pulls remote records with updated timestamps and updates local SQLite using **Last-Write-Wins (LWW)** conflict resolution.
   - Deletes successfully synced entries from `sync_outbox`.
