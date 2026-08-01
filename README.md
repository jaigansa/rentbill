# Rent Bill Pro 🏠

A professional, high-contrast modern property management system designed for landlords and property managers. Track tenants, calculate fixed or metered water charges, generate itemized bulk invoices with 1-click batch billing, manage owner payouts, track 11-month lease expiries, verify tenant payment screenshot proofs, and provide a dedicated read-only tenant portal.

---

## 🚀 Core Features

- **📖 Interactive New User Onboarding Tour**: 5-step guided setup wizard for first-time property managers with 1-click step shortcuts to configure receiving accounts, register units, generate batch bills, approve payment proofs, and manage lease renewals. Accessible anytime via **"📖 User Guide"** in the sidebar and header.
- **💧 Dual Water Charge Calculation**:
  - **Fixed Rate (FLAT)**: Fixed monthly maintenance fee (e.g., ₹200/mo).
  - **Water Meter Rate (METER)**: Metered calculation based on $(\text{Current Water Reading} - \text{Previous Water Reading}) \times \text{Water Unit Price}$.
- **⚡ 1-Click Batch Monthly Billing**: Generate monthly bills for all active units simultaneously in a single interactive batch grid with automated EB and Water meter math.
- **📄 11-Month Lease Agreement Expiry & 1-Click Renewal**: Automated monitoring of rental agreements expiring within 30 days with a 1-click **Renew (+11 Mos)** extension button.
- **📲 Tenant Payment Proof Upload & UTR Verification**: Tenants can upload UPI payment screenshots and UTR transaction numbers directly from their portal. Admin dashboard includes a dedicated **Payment Approvals** queue for 1-click verification.
- **📱 Mobile-First Touch Ergonomics**:
  - **Mobile Bottom-Sheet Modals**: Modals automatically transform into smooth slide-up bottom sheets (`border-radius: 24px 24px 0 0`) on mobile screens ($<768\text{px}$).
  - **Touch Target Optimization**: All buttons, inputs, dropdowns, and navigation elements guarantee $\ge 44\text{px}$ touch targets for easy one-handed operation.
  - **Glassmorphism Bottom Bar**: Tactile mobile navigation with active tab glows and safe-area inset padding for iOS/Android gesture bars.
- **Multi-Property & Unit Directory**: Group and filter overview statistics, active unit lists, and billing records by building/property owner.
- **WhatsApp & Email Invoicing**: Send high-quality itemized rent invoices and payment receipts via **WhatsApp** and **Email**.
- **Tenant Portal**: Dedicated dashboard for tenants to view outstanding balances, payment ledgers, submit payment proofs, and track maintenance requests.
- **Real-Time Live Sync**: Built-in Server-Sent Events (SSE) for instant real-time synchronization across desktop and mobile screens.

---

## 🛠 Prerequisites

- **Go (Golang)**: Version 1.20 or higher.
- **SQLite3**: Installed on your system.
- **Git**: For cloning the repository.

---

## 📥 Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/rentbill.git
cd rentbill
```

### 2. Install Dependencies
```bash
go mod tidy
```

### 3. Initial Configuration
Copy the example configuration file:
```bash
cp config.example.json config.json
```
*(On Windows, duplicate `config.example.json` and rename it to `config.json`)*  
*Note: The app will automatically initialize with default settings (Master Password: `admin`) if this file is missing.*

### 4. Run & Build the Application

#### **On Windows**
To build and run natively:
```cmd
go run .
```
*(Or use `run.bat` / `install.bat`)*

#### **On Linux / macOS**
To build the binary:
```bash
chmod +x build.sh
./build.sh
```
To install systemd background service:
```bash
chmod +x install.sh
sudo ./install.sh
```

---

## 📖 Quick User Guide

### 1. First-Time Setup Wizard
Log in as Admin and click the **"📖 User Guide"** button in the sidebar footer or top dashboard bar. The 5-step interactive wizard guides you through:
1. **Bank & UPI Accounts**: Configure receiving accounts per property/owner.
2. **Register Units & Tenants**: Set rent, move-in date, agreement expiry date, and Water mode (Fixed vs. Metered).
3. **Monthly Batch Billing**: Generate bills for all units with 1 click.
4. **Payment Proofs & WhatsApp**: Verify tenant UTR screenshots and send 1-click WhatsApp reminders.
5. **Lease Agreement Renewal**: Review expiring agreements and extend validity by 11 months.

### 2. Fixed vs. Water Meter Setup
When registering or editing a tenant:
- Select **FIXED** to charge a flat fee (e.g. ₹200).
- Select **METER** and specify **Water Unit Price** (e.g. ₹15/unit) and **Initial Water Reading**. Monthly bills will calculate $(\text{Curr} - \text{Prev}) \times \text{Rate}$.

### 3. Tenant Portal Access
Tenants log in using their **Unit / Room Number** and **Password** to:
- View itemized monthly bills & total arrears.
- Upload UPI payment screenshots and UTR reference numbers.
- Print official payment receipts and file maintenance tickets.

---

## 📁 Project Structure

- `/api`: Go backend handlers, database migrations, SSE live sync, SQLite client, and authentication.
- `/ui`: Embedded static frontend codebase (HTML, CSS modules, Plus Jakarta Sans typography, JS modules).
- `/backups`: Local database backups.
- `/uploads`: Uploaded payment screenshots, ID proof vault documents, and maintenance photos.
- `rentbill.db`: Active SQLite database file.
- `main.go`: Application entry point.

---

© 2026 Rent Bill Pro - Reliable Property Management Systemle Property Management
