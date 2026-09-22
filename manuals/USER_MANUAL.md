# RentBill Pro — User Manual

Welcome to **RentBill Pro**, a local-first rental and property management system designed for speed, offline reliability, and automated accounting.

---

## 1. Quick Start & Direct Access

RentBill Pro runs with **Direct Admin Access (Auth-Free)**:
- **No Login Gating:** You do not need to enter an email, password, or sign up to access your property management dashboard.
- **Local-First Database:** The system uses an embedded SQLite database (`outputs/data/rentbill.db`) with Write-Ahead Logging (WAL) enabled. All your actions work offline instantly without internet latency.
- **Starting the App:**
  ```bash
  # Option 1: Run the Go backend server & open in browser
  npm run dev
  # or directly:
  .\outputs\builds\rentbill-server.exe
  ```
  Open `http://localhost:8080` in your web browser.

---

## 2. Managing Properties, Units & Owners

### 2.1 Adding Properties
1. Navigate to **Properties** from the left navigation bar.
2. Click **+ Add Property**.
3. Fill in Property Name, Address, and default billing cycles.
4. Click **Save Property**.

### 2.2 Adding Units
1. Under the property view, click **+ Add Unit**.
2. Specify:
   - **Unit Identifier** (e.g., Flat 101, Shop 2B).
   - **Base Rent Amount** (in INR).
   - **Default Electricity Rate** (per unit/kWh).
   - **Default Water Rate** (per 1,000L or fixed per month).
   - **Initial Meter Readings** (Electricity kWh and Water Units).

### 2.3 Onboarding Tenants
1. In the **Tenants** tab, click **+ Add Tenant**.
2. Select the assigned property and unit.
3. Enter Tenant details: Name, Phone number, Email, Security Deposit, and Lease Start Date.
4. Any starting balance or opening arrears can be configured directly.

---

## 3. Meter Readings & Generating Bills

### 3.1 Recording Current Readings
1. Navigate to **Bills & Invoices**.
2. Click **+ Create Bill**.
3. Select the Tenant & Unit. RentBill Pro automatically pre-fills:
   - Prior electricity and water meter baseline readings.
   - Base rent amount.
   - Any outstanding arrears from past unpaid periods.
4. Input the **Current Electricity Reading** and **Current Water Reading**.
5. The live calculation engine instantly computes:
   - Electricity Units Consumed = `Current Reading - Previous Reading`.
   - Water Units Consumed = `Current Reading - Previous Reading`.
   - Gross Charges, Discounts, and Net Payable.
6. Click **Generate Bill**.

### 3.2 Invoice Delivery
- **WhatsApp Share:** Click the WhatsApp icon next to any bill to send a formatted invoice message directly to the tenant's phone.
- **Print / PDF Receipt:** Click the print button to generate a clean, thermal- or A4-friendly printable invoice.

---

## 4. Recording Payments & Managing Receipts

### 4.1 Collecting Rent Payments
1. Go to **Payments & Receipts** or click **Pay** next to an unpaid bill.
2. Enter the payment amount received, payment date, and method (UPI, Cash, Bank Transfer, Cheque).
3. If partial payment is made, RentBill Pro automatically marks the bill as **PARTIAL** and updates the outstanding arrears.
4. When fully paid, the bill transitions to **PAID**.

### 4.2 Voiding Bills
If a bill was generated in error:
1. Click **Void** on the bill action menu.
2. Enter the reason for voiding.
3. The bill status changes to **VOID** and all receivable entries are removed from ledger calculations.

---

## 5. Offline Sync & Cloud Backup

### 5.1 Local SQLite + Background Cloud Sync
- Every insert, update, or deletion is immediately committed to local SQLite and queued in the `sync_outbox`.
- When an active Supabase cloud configuration is present and the device is connected to the internet, the background sync worker automatically streams changes to the cloud.
- **Sync Status Indicator:** Located at the top right of the navigation bar:
  - 🟢 **SQLite Synced:** Local database matches cloud state.
  - 🟡 **Syncing... / N Pending:** Data is queued or currently synchronizing.
  - ⚪ **Local SQLite (Offline):** Running in standalone offline mode without cloud dependency.
- **Manual Force Sync:** Click the sync pill in the top header at any time to trigger an immediate sync cycle.

---

## 6. Language & Appearance

- **Dark / Light Theme:** Click the Moon/Sun icon in the top header to toggle between sleek dark mode and bright daylight mode.
- **Multilingual Support:** Click the Globe icon to toggle between **English** and **Tamil (தமிழ்)** across all interface labels.
