# 🗄️ SQL Database Scripts (No Auth & No Role / Local-First Edition)

These scripts build, upgrade, and manage the RentBill Pro **Supabase** database.
Designed for simple, direct, error-free operation in the Supabase SQL Editor with **direct public access (no auth, no roles, no login gating)**, fully compatible with the Go offline-first sync engine.

```
sql/
├── initial.sql    → Fresh Installation: Master schema, tables, financial triggers, open access policies
├── fix.sql        → Safe Upgrade: Migrates existing databases to remove auth/role constraints and open access
└── delete.sql     → Full Teardown: Drops all tables, triggers, and resets public schema
```

---

## ⚡ Which script should I run?

| File | Operation | When to use | What it does |
|---|---|---|---|
| [`initial.sql`](initial.sql) | **Fresh Setup** | Setting up a new Supabase project or starting from scratch | Builds all 11 tables, indexes, constraints, trigger functions, and open RLS policies (`anon, authenticated`). No `auth.users` dependency or role checks. |
| [`fix.sql`](fix.sql) | **Upgrade / Fix** | You already have data and want latest features & fixes | Adds newly introduced columns, drops `auth.users` foreign keys/triggers, unlocks public `anon` access, and cleans obsolete functions. **Preserves all existing data.** |
| [`delete.sql`](delete.sql) | **Full Teardown** | Complete wipe to start completely over | Drops all tables, views, triggers, functions, and storage objects. |

---

## 🚀 Step-by-Step Instructions

### 1. Fresh Project Setup
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste the entire content of [`sql/initial.sql`](initial.sql) and click **Run**.
3. Done! The database is now ready for direct access and background sync from the Go server with zero auth/role friction.

### 2. Updating an Existing Database
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste [`sql/fix.sql`](fix.sql) and click **Run**.
3. Your database schema is updated to the auth-free model without altering any of your tenant, property, or billing records.

### 3. Full Reset & Wipe
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste [`sql/delete.sql`](delete.sql) and click **Run**.
3. Run [`sql/initial.sql`](initial.sql) afterwards to rebuild a clean schema.
