# 🏠 RentBill - Single Binary Mobile Web App

RentBill is a modern, mobile-first rental management and billing web app packaged into a **single, portable Go binary**.

It includes a built-in embedded frontend (Pure HTML, CSS, Vanilla JS), an embedded SQLite database (no CGO or external database required), automatic Wi-Fi / LAN IP detection for immediate access on mobile phones, WhatsApp bill sharing, and printable PDF receipts.

---

## ✨ Features

- **Single Executable**: No Node.js, Python, or database server installation required.
- **Mobile-First Experience**: Designed like a native iOS/Android app with bottom navigation bar, card lists, quick action sheets, and PWA capabilities.
- **Tenants & Property Management**: Add units, track base rent, advance deposits, and tenant contact info.
- **Rent & Utility Calculations**:
  - Electricity meter reading calculator: `(Current Reading - Previous Reading) * Rate`.
  - Itemized breakdown: Base rent, electricity, water, maintenance, adjustments.
- **WhatsApp Bill Sharing**: One-tap pre-formatted bill breakdown ready to send directly to your tenant's WhatsApp.
- **Receipt & PDF Invoices**: Clean, printable invoices formatted with `@media print`.
- **Payment Tracking**: Record Cash, UPI, and Bank payments with balance and overdue status tracking.
- **Import & Export Database**: One-click complete database export (.json) and instant restore across devices.

---

## 🚀 Running the App

### 1. Run the Binary
```bash
./rentbill
```

When started, it outputs:
```
======================================================
    🏠  RentBill Mobile Web Server Started!          
======================================================
  • Local PC:     http://localhost:8080
  • Mobile Wi-Fi: http://192.168.1.15:8080
  (Open the Mobile Wi-Fi link on your phone browser)
======================================================
```

### 2. Linux Service Management (`rentbill.sh`)
Manage the app on Linux using the single unified script:

```bash
# Build binary from source
./rentbill.sh --build

# Install & start as an auto-starting background systemd service (no sudo needed)
./rentbill.sh --install

# Rebuild and restart the running background service after code changes
./rentbill.sh --update

# Stop and remove the background service (preserves database)
./rentbill.sh --remove

# Check background status
./rentbill.sh --status

# Follow live service logs
./rentbill.sh --logs
```

### 3. Open on Your Phone
Make sure your phone is connected to the same Wi-Fi network as your PC, then open the **Mobile Wi-Fi** URL in Safari, Chrome, or any mobile browser!

---

## 🛠️ Building & Cross-Compilation

To compile for other operating systems without installing additional tools:

```bash
# Build for Linux
make build

# Build standalone Windows executable (rentbill.exe)
make windows

# Build macOS binary
make mac
```

---

## 📁 File Structure

```
rentbill/
├── main.go               # Main entry point & embedded web server
├── Makefile              # Build & cross-compilation shortcuts
├── rentbill.sh           # Unified Linux systemd service manager CLI
├── internal/
│   ├── api/              # REST API handlers, routing & middleware
│   └── database/         # SQLite schema, queries, calculations & data models
└── public/               # Pure HTML, CSS, and Vanilla JS (Embedded directly into binary)
    ├── index.html        # Single-page mobile app shell
    ├── manifest.json     # PWA manifest
    ├── css/
    │   ├── style.css     # Mobile-first CSS design tokens
    │   └── print.css     # Clean invoice print stylesheet
    ├── fonts/            # Self-hosted WOFF2 fonts (offline-ready)
    └── js/
        ├── api.js        # Backend API client
        ├── app.js        # Core view coordinator & state orchestrator
        ├── share.js      # WhatsApp bill formatter & UPI QR generator
        └── modules/      # Modular ES modules (auth, bills, tenants, ui, etc.)
```
