# Rent Bill Pro 🏠

A professional, high-contrast E-Ink styled property management system designed for landlords and property managers. Track tenants, generate itemized bills, manage owner payouts, handle partial payments, and provide a dedicated read-only tenant portal with ease.

---

## 🚀 Core Features

- **Multi-Property Support**: Group and filter dashboard overview stats, active units lists, and generate billing records by owner/property.
- **Unit Management**: Register and manage tenants with a full unit directory.
- **Smart Billing**: One-click bill generation with automated Electricity (EB) calculations and **Arrears tracking**.
- **Flexible Payments**: 
    - Support for UPI, Cash, and Bank transfers.
    - Advanced adjustments: **Discounts**, **Write-offs**, and **Carry Forwards**.
- **Owner Settlements**: Track income per owner/account and record payouts with detailed **Timelines**.
- **Professional Sharing**: Send high-quality, itemized Invoices and Receipts via **WhatsApp** and **Email**.
- **Tenant Portal (Read-only Access)**: A dedicated, mobile-friendly tenant dashboard to securely view outstanding balance, monthly rent, full payment history ledger, and submit/track maintenance tickets.
- **Data Security**: PIN-protected actions, manual & auto-backups, and a "Safe Restore" mechanism.
- **Audit Ready**: Generate detailed monthly financial reports at the click of a button.

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
*(On Windows, you can duplicate `config.example.json` and rename it to `config.json`)*
*Note: The app will automatically initialize with default settings (Master PIN: `1234`) if this file is missing.*

### 4. Build & Install the Application

#### **On Windows (Command Prompt)**
To install dependencies, setup folders, and build natively:
```cmd
install.bat
```
To run the server:
```cmd
rentbill.exe
```

#### **On Linux / macOS (Bash)**
To build the application binary:
```bash
chmod +x build.sh
./build.sh
```
To install folders, configure paths, and run the service background task automatically (using systemd):
```bash
chmod +x install.sh
sudo ./install.sh
```

---

## 🚀 Production Deployment (Linux)

### 1. Manage the systemd Service
Once `install.sh` has run, you can control the RentBill Pro service using:
```bash
sudo systemctl status rentbill
sudo systemctl restart rentbill
sudo systemctl stop rentbill
```

### 2. Security Recommendations
- **Reverse Proxy**: Use Nginx or Caddy as a reverse proxy to handle SSL (HTTPS) and serve the app on Port 80/443.
- **Firewall**: Ensure only necessary ports (80, 443, 22) are open.
- **Backup Strategy**: Regularly download the `.db` files from the app settings to your local machine.

### 3. Updating the App
1. Pull the latest code: `git pull`
2. Build the app: `./build.sh`
3. Restart the service: `sudo systemctl restart rentbill`

---

## 📖 User Guide

### 1. Getting Started
- **Default PIN**: The default auth PIN is `1234`.
- **Change PIN**: Go to **Settings > Credentials** to configure your secure 4-digit Master PIN.

### 2. Setting Up Receiving Accounts
1. Go to **Settings > Receiving Accounts**.
2. Enter the **Owner Name** (e.g., John Doe).
3. Select **Account Type** (UPI or Bank).
4. Fill in details and click **Add Account Record**.

### 3. Managing Tenants
- **Registration**: Use the **Register** button in the Unit Directory to add a tenant, assigning them to a configured payee/owner.
- **Vacating**: Click on any tenant card to edit details or use "Mark Vacant" to settle the final dues.
- **Archiving**: Deleting a tenant performs a soft-delete, preserving their ledger history for reports.

### 4. Monthly Billing & Payments
- **Billing**: Go to the **Billing** tab, input the current EB reading, and generate the invoice. Arrears are automatically added to the next bill.
- **Payment Collection**: Record payments under **History & Records**.
- **Adjustments**: Support for partial payments via **Discounts** (forgive balance), **Write-offs** (bad debts), or **Carry Forwards** (rolled into arrears).

### 5. Tenant Access Portal
Tenants can access their own secure dashboard:
1. Click **Tenant Access Portal** at the bottom of the sign-in overlay.
2. Login using their **Room Number** and **Registered Mobile Number**.
3. View their payment history, download invoice statements, and file maintenance tickets (Plumbing, Electrical, etc.).

---

## 📁 Project Structure

- `/api`: Backend code (routing, handlers, SQLite helper, SSE, middleware).
- `/ui`: Embedded static frontend codebase (HTML, CSS, JS).
- `/backups`: Local database backups.
- `/uploads`: Uploaded attachments and maintenance images.
- `rentbill.db`: Active SQLite database file.
- `main.go`: Entry point of the server binary.
- `static.go`: Embeds the static frontend assets.

---
© 2026 Rent Bill Pro - Reliable Property Management
