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
- **Local Network (Wi-Fi) Mobile Access**: On startup, displays your computer's local Wi-Fi URL so you can open it on your phone instantly.
- **Optional Supabase Cloud Backup**: Settings page allows you to link your Supabase account whenever you want cloud backup.

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

### 2. Open on Your Phone
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
├── internal/
│   ├── api/              # REST API handlers and routing
│   ├── database/         # SQLite schema, queries, and calculations
│   └── sync/             # Optional Supabase cloud backup client
└── public/               # Pure HTML, CSS, and Vanilla JS (Embedded directly into the binary)
    ├── index.html        # Single-page mobile app shell
    ├── manifest.json     # PWA manifest
    ├── css/
    │   ├── style.css     # Mobile-first CSS design tokens
    │   └── print.css     # Clean invoice print stylesheet
    └── js/
        ├── api.js        # Backend API client
        ├── app.js        # View controller and state management
        └── share.js      # WhatsApp bill formatter & print engine
```
