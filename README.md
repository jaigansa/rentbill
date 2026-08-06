# Rent Bill Pro 🏠

A professional, high-contrast modern property management system designed for landlords and property managers. Track tenants, calculate fixed or metered water charges, generate itemized bulk invoices with 1-click batch billing, manage owner payouts, track 11-month lease expiries, verify tenant payment screenshot proofs, and provide a dedicated read-only tenant portal.

---

## ⚡ Single-File Standalone Architecture

RentBill Pro compiles into **one single standalone executable file** (`rentbill.exe` on Windows or `rentbill` on Linux). 

- **Embedded UI**: All HTML, JavaScript, CSS, fonts, and icons are embedded directly into the Go binary at compile time via `//go:embed`.
- **Zero External Dependencies**: Move or deploy the single binary anywhere—no separate `ui/` directory required at runtime!

---

## 🚀 Core Features

- **📖 Interactive New User Onboarding Tour**: 5-step guided setup wizard for first-time property managers with 1-click shortcuts to configure receiving accounts, register units, generate batch bills, approve payment proofs, and manage lease renewals.
- **💧 Dual Water Charge Calculation**:
  - **Fixed Rate (FLAT)**: Fixed monthly maintenance fee (e.g., ₹200/mo).
  - **Water Meter Rate (METER)**: Metered calculation based on $(\text{Current Water Reading} - \text{Previous Water Reading}) \times \text{Water Unit Price}$.
- **⚡ 1-Click Batch Monthly Billing & Direct Admin Pay**: Generate monthly bills for all active units simultaneously in a single interactive batch grid or generate & mark paid directly in 1 click.
- **🚀 Dispatch Center & Unified Sharing**: Centralized dispatch hub for viewing document previews, sending via WhatsApp, sending email invoices, printing/saving PDF receipts, and copying text summaries.
- **⚡ High-Performance SQLite WAL Engine**: Optimized SQLite database running in Write-Ahead Logging (WAL) mode with connection pooling, 5000ms busy timeout, and composite index tuning.
- **🏢 Property & Master Units Management**: Manage property details and maintain a master list of units/rooms with unit-specific Rental Agreement Terms & House Rules.
- **👥 Co-Tenants / Roommates Tracking**: Register primary tenants along with co-tenants and roommates displayed directly on tenant profile cards.
- **💧 Dual Water Charge Calculation**:
  - **Fixed Rate (FLAT)**: Fixed monthly maintenance fee (e.g., ₹200/mo).
  - **Water Meter Rate (METER)**: Metered calculation based on $(\text{Current Water Reading} - \text{Previous Water Reading}) \times \text{Water Unit Price}$.
- **📄 11-Month Lease Agreement Expiry & 1-Click Renewal**: Automated monitoring of rental agreements expiring within 30 days with a 1-click **Renew (+11 Mos)** extension button.
- **📲 Tenant Payment Proof Upload & UTR Verification**: Tenants can upload UPI payment screenshots and UTR transaction numbers directly from their portal.
- **📱 Mobile-First Touch Ergonomics**:
  - **Mobile Bottom-Sheet Modals**: Modals automatically transform into smooth slide-up bottom sheets (`border-radius: 24px 24px 0 0`) on mobile screens ($<768\text{px}$).
  - **Touch Target Optimization**: All buttons, inputs, dropdowns, and navigation elements guarantee $\ge 44\text{px}$ touch targets.
  - **Glassmorphism Bottom Bar**: Tactile mobile navigation with active tab glows and safe-area inset padding.
- **Real-Time Live Sync**: Built-in Server-Sent Events (SSE) for instant real-time synchronization across desktop and mobile screens.

---

## 🛠 Prerequisites

- **Go (Golang)**: Version 1.20 or higher.
- **Git**: For cloning the repository.

---

## 📥 Building & Running

We provide unified multi-command CLI scripts for Windows (`win.bat`) and Linux/macOS (`linux.sh`):

### 🪟 On Windows (`win.bat`)

| Command | Action |
| :--- | :--- |
| `.\win.bat` or `.\win.bat build` | Builds standalone `rentbill.exe` |
| `.\win.bat install` | Creates folders, sets up `config.json`, and builds binary |
| `.\win.bat run` | Launches the application server |
| `.\win.bat pack` | Packages binary & docs into `rentbill_windows.zip` |

---

### 🐧 On Linux / macOS (`linux.sh`)

| Command | Action |
| :--- | :--- |
| `./linux.sh` or `./linux.sh build` | Builds standalone `./rentbill` binary |
| `./linux.sh install` | Creates folders, sets up `config.json`, and builds binary |
| `./linux.sh run` | Launches the application server |
| `./linux.sh pack` | Creates compressed release archive `rentbill_deploy.tar.gz` |

---

## 📖 Quick User Guide

### 1. First-Time Setup Wizard
Log in as Admin and click **"📖 User Guide"** in the sidebar. The 5-step interactive wizard guides you through:
1. **Bank & UPI Accounts**: Configure receiving accounts per property/owner.
2. **Register Units & Tenants**: Set rent, move-in date, agreement expiry date, co-tenants, and Water mode (Fixed vs. Metered).
3. **Monthly Batch Billing**: Generate bills for all units with 1 click or generate and mark paid directly.
4. **Payment Proofs & Dispatch Center**: Verify tenant UTR screenshots and send invoices via Dispatch Center (WhatsApp, Email, Print).
5. **Lease Agreement Renewal**: Review expiring agreements and extend validity by 11 months.

### 2. Tenant Portal Access
Tenants log in using their **Unit / Room Number** and **Password** to:
- View itemized monthly bills & total arrears.
- Upload UPI payment screenshots and UTR reference numbers.
- Print official payment receipts and file maintenance tickets.

---

## 🗄️ Database Structure

Rent Bill Pro uses an embedded **SQLite** database (`rentbill.db`) operating in **WAL (Write-Ahead Logging)** mode with foreign key constraints enabled and composite index tuning. Below is the complete relational database schema:

### 1. `renters` (Tenant Information & Lease Profiles)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique tenant identifier |
| `name` | TEXT | Primary renter / tenant full name |
| `co_tenant_names` | TEXT | Co-tenants / roommates full names |
| `room_no` | TEXT | Room / Unit identifier |
| `aadhar_no` | TEXT | Government ID / Aadhar number |
| `mobile_number` | TEXT | Contact phone number |
| `email` | TEXT | Email address |
| `move_in_date` | DATE | Lease start / Move-in date |
| `agreement_expiry_date` | DATE | Lease agreement expiration date |
| `advance_amount` | REAL | Security deposit paid |
| `base_rent` | REAL | Monthly rent amount |
| `maint_charge` | REAL | Regular monthly maintenance charge |
| `water_maint` | REAL | Fixed water charge |
| `eb_unit_price` | REAL | Per unit electricity rate |
| `initial_eb` | REAL | Meter reading at move-in |
| `water_calc_mode` | TEXT | Water calculation type (`FIXED` / `METERED`) |
| `water_unit_price` | REAL | Per unit water charge (metered) |
| `initial_water` | REAL | Water meter reading at move-in |
| `assigned_upi` | TEXT | Custom UPI ID for rent payments |
| `pending_arrears` | REAL | Outstanding balance brought forward |
| `password_hash` | TEXT | Hashed login password for Tenant Portal |
| `is_active` | INTEGER | Active status (`1` = Active, `0` = Vacated) |
| `vacate_date` | DATE | Move-out / Vacate date |
| `exit_balance` | REAL | Final settlement balance upon exit |

---

### 2. `units` (Property Master Directory & Room Inventory)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique unit ID |
| `unit_name` | TEXT UNIQUE | Unit name (e.g. Room 101, Flat 2B) |
| `floor` | TEXT | Floor level / Block |
| `default_rent` | REAL | Default base rent rate |
| `default_maint` | REAL | Default maintenance fee |
| `is_occupied` | INTEGER | Occupancy status (`1` = Occupied, `0` = Vacant) |
| `agreement_terms` | TEXT | Unit-specific agreement terms & house rules |
| `timestamp` | DATETIME | Creation timestamp |

---

### 3. `bills` (Monthly Billing & Payment Proofs)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique invoice/bill ID |
| `renter_id` | INTEGER (FK) | References `renters(id)` |
| `billing_month` | TEXT | Month & Year label (e.g. `August 2026`) |
| `date_generated` | DATE | Date when bill was created |
| `rent_amount` | REAL | Base rent component |
| `maint_amount` | REAL | Maintenance component |
| `water_amount` | REAL | Water charge component |
| `prev_eb_reading` | REAL | Starting EB meter reading |
| `curr_eb_reading` | REAL | Ending EB meter reading |
| `prev_water_reading` | REAL | Starting water meter reading |
| `curr_water_reading` | REAL | Ending water meter reading |
| `others` | REAL | Miscellaneous fees |
| `arrears_included` | REAL | Arrears carried into this bill |
| `total_amount` | REAL | Total bill amount payable |
| `paid_amount` | REAL | Total amount paid so far |
| `discount_amount` | REAL | Concession / Discount applied |
| `write_off_amount` | REAL | Bad debt / Write-off amount |
| `is_paid` | INTEGER | Payment status (`1` = Fully Paid, `0` = Pending) |
| `payment_method` | TEXT | Mode of payment (`UPI`, `Cash`, `Bank Transfer`) |
| `payment_details` | TEXT | UTR / Reference transaction ID |
| `payment_date` | DATE | Date of payment completion |
| `proof_status` | TEXT | Verification status (`NONE`, `PENDING`, `VERIFIED`, `REJECTED`) |
| `proof_ref` | TEXT | Transaction reference from tenant |
| `proof_photo` | TEXT | Path to uploaded screenshot |
| `proof_date` | DATETIME | Timestamp of proof submission |

---

### 4. `expenses` (Property Operating Expenses)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique expense ID |
| `category` | TEXT | Expense category (e.g., Repairs, EB Bill, Cleaning) |
| `amount` | REAL | Expense cost |
| `date` | DATE | Expense date |
| `owner_name` | TEXT | Associated property owner |
| `notes` | TEXT | Description or remarks |
| `timestamp` | DATETIME | Entry timestamp |

---

### 5. `owner_withdrawals` (Owner Payouts)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique withdrawal ID |
| `owner_name` | TEXT | Owner name receiving funds |
| `amount` | REAL | Withdrawal amount |
| `date` | DATE | Transaction date |
| `notes` | TEXT | Payment notes |

---

### 6. `maintenance_tasks` (Tenant Maintenance Requests)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique ticket ID |
| `renter_id` | INTEGER (FK) | References `renters(id)` |
| `title` | TEXT | Short issue title |
| `description` | TEXT | Detailed problem description |
| `category` | TEXT | Category (Plumbing, Electrical, General) |
| `priority` | TEXT | Priority level (`Low`, `Medium`, `High`, `Urgent`) |
| `status` | TEXT | Status (`Pending`, `In Progress`, `Resolved`, `Cancelled`) |
| `owner_name` | TEXT | Assigned owner / manager |
| `estimated_cost` | REAL | Cost estimate |
| `actual_cost` | REAL | Final resolution cost |
| `photo_path` | TEXT | Path to attached issue photo |
| `date_reported` | DATE | Date issue was reported |
| `date_resolved` | DATE | Date issue was fixed |

---

### 7. `documents` (Renter Vault & Agreements)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Document ID |
| `renter_id` | INTEGER (FK) | References `renters(id)` |
| `file_name` | TEXT | File display name |
| `file_path` | TEXT | Stored file system path |
| `file_type` | TEXT | Document type (Agreement, ID Proof, Photo) |
| `upload_date` | DATETIME | Upload timestamp |
| `expiry_date` | DATE | Expiration date (if applicable) |

---

### 8. `properties` (Property Master Directory)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY | Unique property ID |
| `name` | TEXT | Property / Building name |
| `address` | TEXT | Physical property address |
| `owner_name` | TEXT | Associated property owner |
| `agreement_terms` | TEXT | Standard lease terms & conditions |
| `timestamp` | DATETIME | Entry creation timestamp |

---

### 9. `activity_logs` & `users` (Audit & Security)
- **`users`**: Stores admin authentication credentials (`username`, `pin_hash`, `email`).
- **`activity_logs`**: System audit trail tracking all actions (`action`, `details`, `amount`, `username`, `timestamp`).

---

## 📁 Project Structure

```
rentbill/
├── internal/                   # Private Go backend package architecture
│   └── api/
│       ├── config.go           # Configuration & encryption
│       ├── database.go         # SQLite WAL setup, indexes, migrations & auto-backups
│       ├── events.go           # Real-time SSE streaming engine
│       ├── handlers.go         # REST API route handlers
│       ├── middleware.go       # Auth & session middleware
│       └── models.go           # Data models & structs
├── ui/                         # Frontend codebase (embedded via static.go)
│   ├── css/style.css           # Consolidated design system
│   ├── fonts/                  # Local typography files
│   ├── js/                     # Consolidated JS script bundles
│   ├── libs/                   # Vendor libraries (Lucide, Chart.js, QRCode)
│   ├── index.html              # Main HTML web application
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── uploads/                    # User uploaded payment proofs & maintenance photos
├── backups/                    # Automated database backups
├── win.bat                     # Windows Unified CLI script
├── linux.sh                    # Linux/macOS Unified CLI script
├── main.go                     # Application entry point
└── static.go                   # Go embed FS definition
```

---

© 2026 Rent Bill Pro - Reliable Property Management System

