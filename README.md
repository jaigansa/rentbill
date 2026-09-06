# RentBill Pro (Serverless Static Edition)

**RentBill Pro** is a modern, lightweight property and rental management application for landlords and property managers. It runs as a **pure static web application** using **Vanilla HTML5, CSS3, and JavaScript**, backed by **Supabase** for database, authentication, real-time updates, and storage.

---

## Table of Contents

- [Features](#features)
- [Technical Architecture](#technical-architecture)
- [Project Structure](#project-structure)
- [Quick Setup Overview](#quick-setup-overview)
- [Step 1: Create a Supabase Project](#step-1-create-a-supabase-project)
- [Step 2: Run Master Database Schema](#step-2-run-master-database-schema)
- [Step 3: Storage Bucket Setup (Payment Proofs)](#step-3-storage-bucket-setup-payment-proofs)
- [Step 4: Configure Supabase Authentication](#step-4-configure-supabase-authentication)
- [Step 5: Connect App to Supabase](#step-5-connect-app-to-supabase)
- [Step 6: Default Logins & Verification](#step-6-default-logins--verification)
- [Database Reset / Maintenance Scripts](#database-reset--maintenance-scripts)
- [Local Development](#local-development)
- [Deployment on Cloudflare Pages](#deployment-on-cloudflare-pages)
- [Authentication & Landlord Login](#authentication--landlord-login)
- [Custom Domain & Free SSL](#custom-domain--free-ssl)
- [Security Checklist & Verification](#security-checklist--verification)

---

## Features

- 🏠 **Property, Unit, Tenant, Owner & Documents management**
- 📄 **Automatic monthly billing** with electricity & water calculations
- 💳 **Payments, partial payments, arrears, credit/advance tracking**
- 🔧 **Maintenance work orders**
- 📊 **Dashboard & financial overviews**
- 🔐 **Landlord architecture with two roles**: `ADMIN` (full access) & `VIEWER` (read-only) backed by Supabase Auth
- 🌐 **Bilingual**: English & Tamil (தமிழ்)
- 📈 **Integer-based (paise) financial math** to prevent floating-point errors
- ☁️ **Supabase-backed** database, auth, realtime & storage

---

## Technical Architecture

- **Frontend**: Clean, lightweight Vanilla HTML5, CSS3, and JavaScript (No build step required).
- **Backend / Database**: [Supabase](https://supabase.com) (PostgreSQL with Row Level Security, Auth & Storage).
- **Hosting**: Can be deployed on GitHub Pages, Vercel, Netlify, Cloudflare Pages, or run locally via any web server.
- **Accounting**: Strict integer-based calculations (paise) to prevent IEEE-754 floating-point inaccuracies.

---

## Project Structure

```
.
├── README.md
├── sql/                     # Database scripts — install / update / delete
│   ├── install/             # Brand-new database: 00_master_schema.sql
│   ├── update/              # Upgrade existing DB, keep data
│   └── delete/              # Clear data / full reset
├── index.html               # Single Page Application entrypoint
├── css/
│   ├── app.css              # Master entry stylesheet
│   ├── variables.css        # Theme variables & design tokens
│   ├── base.css             # Base reset, typography & icon rules
│   ├── layout.css           # Shell layout & header
│   ├── components.css       # Stat cards, tables, badges, buttons, dropdowns
│   ├── modals.css           # Modals, drawer & mobile controls
│   └── print.css            # A4 receipt & invoice print engine
├── i18n/
│   ├── en.json              # English translations
│   └── ta.json              # Tamil translations
└── js/
    ├── core/                # Core config, state, UI, theme, i18n
    ├── modules/             # Domain modules (auth, dashboard, properties, bills, etc.)
    └── main.js              # Application entry point
```

---

## Quick Setup Overview

| Step | Action | Description |
| :--- | :--- | :--- |
| **Step 1** | Create Supabase Project | Create a project at [supabase.com](https://supabase.com) |
| **Step 2** | Run Master SQL Script | Run [`sql/install/00_master_schema.sql`](sql/install/00_master_schema.sql) in SQL Editor |
| **Step 3** | Verify Storage Bucket | Ensure the `proofs` bucket is created & set to Public |
| **Step 4** | Configure Auth Settings | Enable Email Auth provider and disable email confirmation if needed |
| **Step 5** | Connect Web App | Enter Supabase URL & Anon Key into the RentBill Pro web interface |
| **Step 6** | Log In & Test | Sign in as Admin (`admin@rentbill.com` / `Admin@123`) |

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and log in or create a free account.
2. Click **New Project**.
3. Fill in the project details:
   - **Name**: `rentbills-pro` (or your preferred name)
   - **Database Password**: Choose a strong password and save it safely.
   - **Region**: Choose the region closest to your users.
4. Click **Create new project** and wait ~2 minutes for provision completion.

---

## Step 2: Run Master Database Schema

1. Open your Supabase Dashboard.
2. On the left sidebar, click the **SQL Editor** icon (`< />`).
3. Click **New Query**.
4. Open [`sql/install/00_master_schema.sql`](sql/install/00_master_schema.sql) in your code editor, copy the entire content, and paste it into the Supabase SQL Editor.
5. Click **Run** (or press `Ctrl + Enter`).

> [!SUCCESS]
> **What this script automatically sets up:**
> - Core extensions (`uuid-ossp`, `pgcrypto`)
> - User profiles table & auto-trigger `handle_new_user()`
> - Business tables (`properties`, `units`, `renters`, `owners`, `bills`, `payments`, `expenses`, `owner_withdrawals`, `documents`)
> - Automated financial triggers (`calculate_bill_amounts()`, `sync_bill_paid_amount()`)
> - Row Level Security (RLS): every authenticated user can read, but only `ADMIN` can write (INSERT/UPDATE/DELETE)
> - Roles: `ADMIN` (full access) and `VIEWER` (read-only)
> - Auth RPC functions (`resolve_login_email` for username-based sign-in)
> - Default Administrator user (`admin@rentbill.com` / `Admin@123`)

---

## Step 3: Storage Bucket Setup (Payment Proofs)

1. On the left sidebar, navigate to **Storage** → **Buckets**.
2. Verify that the **`proofs`** bucket is present.
3. If missing:
   - Click **New Bucket**.
   - Name: `proofs`.
   - Toggle **Public Bucket** to **ON**.
   - Click **Save**.

---

## Step 4: Configure Supabase Authentication

1. Go to **Authentication** → **Providers** → **Email**:
   - Ensure **Enable Email provider** is turned **ON**.
2. Go to **Authentication** → **URL Configuration**:
   - Set **Site URL** to your web app location (e.g. `http://localhost:8080` or `https://your-domain.com`).
3. **Notify Only (optional)**: Keep **Confirm email** **ON** for conservative account creation, or turn it **OFF** for instant sign-in without confirmation links.

> **Note:** RentBill Pro no longer ships a Resident Tenant Portal. All sign-ups are owner/manager accounts (`ADMIN` or `VIEWER`).

---

## Step 5: Connect App to Supabase

1. In Supabase Dashboard, go to **Project Settings** (gear icon) → **API**.
2. Copy your **Project URL** (e.g. `https://xxxx.supabase.co`) and **Publishable / anon key**.
3. Open **RentBill Pro** in your browser.
4. If prompted on startup (or click **Settings** / **Configure Supabase**):
   - Paste your **Supabase Project URL**.
   - Paste your **Supabase Anon Key**.
   - Click **Save & Connect**.

> **Security note:** Do **not** hardcode real credentials in [`js/core/config.js`](js/core/config.js) — only placeholders (`YOUR_PROJECT_ID` / `YOUR_KEY`) are committed. Supply the real values from your own browser (**Settings → Configure Supabase**, stored in your browser's `localStorage`) or inject them at build/deploy time via environment variables (see [Deployment on Cloudflare Pages](#deployment-on-cloudflare-pages)). The Supabase **anon/publishable key is public by design** — it ships to browsers anyway — so your database must rely on **Row Level Security**, never on hiding the anon key.

---

## Step 6: Default Logins & Verification

### Administrator Login
- **Email**: `admin@rentbill.com`
- **Password**: `Admin@123`

### Adding a Viewer (Read-Only) Account
1. Log in as Administrator.
2. In your **Supabase Dashboard** → **Authentication** → **Users**, create a new user with their email/password.
3. In **SQL Editor**, run:
   ```sql
   UPDATE public.profiles SET role = 'VIEWER' WHERE email = 'the-user@example.com';
   ```
4. The user can log in and view all data but is blocked from every write by the read-only banner, the front-end guard, and **database-level RLS** (only `ADMIN` can INSERT/UPDATE/DELETE).

---

## Database Reset / Maintenance Scripts

| File | Purpose | When to use |
| :--- | :--- | :--- |
| **[`sql/delete/01_clear_all_data.sql`](sql/delete/01_clear_all_data.sql)** | Clear Data | Wipes test properties, bills, tenants, and payments while keeping database tables & Admin login intact |
| **[`sql/delete/02_reset_database.sql`](sql/delete/02_reset_database.sql)** | Full Teardown | Drops all tables, triggers, and RPC functions in `public` schema for a complete fresh database rebuild |

---

## Local Development

Run the application locally using any static web server:

```bash
python3 -m http.server 8080
# or with Node.js:
npx serve .
```

Open `http://localhost:8080` in your browser.

---

## Deployment on Cloudflare Pages

RentBill Pro deploys to **Cloudflare Pages** for **100% Free**, lightning-fast global edge hosting with automatic SSL and continuous deployment, backed by **Supabase Cloud**.

- **Edge CDN & Hosting**: [Cloudflare Pages](https://pages.cloudflare.com) (Free tier, Unlimited Bandwidth, Global Edge CDN, Free DDoS & WAF protection, automated SSL/TLS).
- **Edge Security**: `_headers` injecting strict Content Security Policy (`CSP`), HSTS, anti-clickjacking (`X-Frame-Options: DENY`), and permission policies.
- **Read-Only Isolation**: Row Level Security (RLS) allows any authenticated user to read, but restricts every write (INSERT/UPDATE/DELETE) to `ADMIN`. Landlord bank details, expenses, bills, and tenant profiles can never be modified by a `VIEWER` — enforced at the PostgreSQL engine level.

### Method 1: Git Integration (Recommended)

1. Push your RentBill repository to **GitHub** or **GitLab**:

```bash
git init
git add .
git commit -m "Initial RentBill Pro commit"
git remote add origin https://github.com/YOUR_USERNAME/rentbill.git
git push -u origin main
```

2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and select **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
3. Select your `rentbill` repository.
4. Configure the Build & Deployment settings:
   - **Project Name**: `rentbill` (or any preferred name)
   - **Production Branch**: `main` (or `master`)
   - **Framework Preset**: `None`
   - **Build Command**: *(leave empty — pure static app)*
   - **Build Output Directory**: `/` (or root)
5. Click **Save and Deploy**. Within ~30 seconds, Cloudflare will deploy your application to a global edge address like `https://rentbill.pages.dev`.

### Method 2: Direct CLI Deployment (Instant 1-Command Deploy)

If you don't want to use Git, deploy directly from your computer using Cloudflare Wrangler:

```bash
npx wrangler pages deploy . --project-name=rentbill
```

### Post-Deployment Checklist

Once your Cloudflare URL is live (e.g. `https://rentbill.pages.dev`):

1. **Update Allowed URLs in Supabase**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**.
   - Set **Site URL** to: `https://rentbill.pages.dev` (replace with your actual URL).
   - In **Redirect URLs**, add: `https://rentbill.pages.dev/**`.
   - Click **Save**.

### Security Headers

| File | Purpose |
| :--- | :--- |
| **[`_headers`](_headers)** | Security headers (`X-Frame-Options`, `XSS protection`) & static asset caching |

---

## Authentication & Landlord Login

RentBill Pro uses a clean, secure **Landlord Architecture** with role-based access:

1. **Create Landlord Account**: In your Supabase Dashboard under **Authentication** → **Users**, create your admin account with your email and password. The very first user is auto-promoted to `ADMIN` by the schema.
2. **Log In**: Open the app, enter your email and password, and sign in.
3. **Roles**:
   - `ADMIN` — full access: add/edit/delete properties, units, tenants, bills, payments, expenses, documents, and maintenance.
   - `VIEWER` — read-only: sees everything the admin sees behind a "Viewer Mode" banner, but every write attempt is blocked by the front-end guard and database RLS.
4. **Strict Data Privacy**: All tables and records are protected behind authentication with Row Level Security (RLS). Anonymous access is completely disabled.

---

## Custom Domain & Free SSL (Optional)

1. In Cloudflare Pages, navigate to **Custom Domains** → **Set up a custom domain**.
2. Enter your desired domain (e.g., `rent.yourdomain.com`).
3. If your domain's DNS is managed by Cloudflare, it will configure the CNAME automatically and issue an SSL/TLS certificate in minutes.

---

## Security Checklist & Verification

| Security Control | Implementation | Verification Method |
| :--- | :--- | :--- |
| **Row Level Security (RLS)** | Enabled on all PostgreSQL tables | cURL test without auth returns `401` or empty `[]` |
| **Write Protection** | INSERT/UPDATE/DELETE allowed only via `is_admin()` policy | VIEWER token INSERT/UPDATE/DELETE returns a `permission denied` RLS error |
| **Read Access** | All authenticated users can SELECT | VIEWER can query `/rest/v1/bills` and receive all rows |
| **Landlord Privacy** | `expenses`, `owners.account_number`, `owner_withdrawals` restricted to `ADMIN` writes | VIEWER token write to `/rest/v1/expenses` returns RLS rejection |
| **Content Security Policy** | Configured in `_headers` at Cloudflare Edge | Inspect HTTP response headers for `Content-Security-Policy` |
| **Anti-Clickjacking** | `X-Frame-Options: DENY` | Cannot be embedded in malicious iframes |
| **Transport Security** | `Strict-Transport-Security: max-age=31536000` | Automated HTTPS enforcement across all browsers |
| **Payment Verification** | Payments recorded with proof status, approved by `ADMIN` | VIEWER cannot approve/reject proof records |
