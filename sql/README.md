# 🗄️ SQL Database Scripts

These scripts build, upgrade, and manage the RentBill Pro **Supabase** database.
Designed for simple, direct, error-free operation in the Supabase SQL Editor.

```
sql/
├── initial.sql    → Fresh Installation: Master schema, tables, triggers, and security
├── fix.sql        → Safe Upgrade: Idempotent migration for existing databases
└── delete.sql     → Full Teardown: Drops all tables, triggers, and deletes all auth users
```

---

## ⚡ Which script should I run?

| File | Operation | When to use | What it does |
|---|---|---|---|
| [`initial.sql`](initial.sql) | **Fresh Setup** | Setting up a new Supabase project or starting from scratch | Builds all 11 tables, indexes, constraints, trigger functions, RLS policies, and admin auth helpers. |
| [`fix.sql`](fix.sql) | **Upgrade / Fix** | You already have data and want latest features & fixes | Adds newly introduced columns (`eb_reset_at`, `water_reset_at`, `initial_eb_reading`, etc.), updates RLS policies, locks down admin security, and cleans obsolete functions. **Preserves all existing data.** |
| [`delete.sql`](delete.sql) | **Full Teardown** | Complete wipe to start completely over | Drops all tables, views, triggers, functions, storage objects, and **fully deletes all auth users & identities**. |

---

## 🚀 Step-by-Step Instructions

### 1. Fresh Project Setup
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste the entire content of [`sql/initial.sql`](initial.sql) and click **Run**.
3. Go to **Authentication** → **Users** → **Add User** (Create user with your email & password) to create your Landlord Admin login!

### 2. Updating an Existing Database
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste [`sql/fix.sql`](fix.sql) and click **Run**.
3. Your database schema is instantly updated without altering any of your tenant, property, or billing records.

### 3. Full Reset & Wipe
1. Open Supabase Dashboard → **SQL Editor**.
2. Copy and paste [`sql/delete.sql`](delete.sql) and click **Run**.
3. ⚠️ **Warning:** This drops all tables and permanently deletes all auth users.
4. Run [`sql/initial.sql`](initial.sql) afterwards to rebuild a clean schema.

