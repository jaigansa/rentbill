package db

const Schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE RESTRICT,
    property_uuid TEXT,
    unit_number TEXT NOT NULL,
    unit_name TEXT,
    floor INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'VACANT',
    monthly_rent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    UNIQUE(property_id, unit_number)
);

CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    mobile_number TEXT,
    upi_id TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS renters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    unit_id INTEGER REFERENCES units(id) ON DELETE RESTRICT,
    unit_uuid TEXT,
    owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
    owner_uuid TEXT,
    name TEXT NOT NULL,
    mobile_number TEXT,
    email TEXT,
    aadhar_number TEXT,
    base_rent INTEGER NOT NULL DEFAULT 0,
    advance_amount INTEGER NOT NULL DEFAULT 0,
    pending_arrears INTEGER NOT NULL DEFAULT 0,
    maint_charge INTEGER NOT NULL DEFAULT 0,
    eb_per_unit_price REAL NOT NULL DEFAULT 8.00,
    initial_eb_reading INTEGER NOT NULL DEFAULT 0,
    water_calc_mode TEXT NOT NULL DEFAULT 'FIXED',
    water_fixed_charge INTEGER NOT NULL DEFAULT 150,
    water_per_unit_price REAL NOT NULL DEFAULT 0.00,
    initial_water_reading INTEGER NOT NULL DEFAULT 0,
    eb_reset_at TEXT,
    water_reset_at TEXT,
    agreement_start_date TEXT,
    agreement_expiry_date TEXT,
    vacate_date TEXT,
    exit_reason TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    renter_id INTEGER REFERENCES renters(id) ON DELETE RESTRICT,
    renter_uuid TEXT,
    billing_period TEXT NOT NULL,
    period_start_date TEXT,
    period_end_date TEXT,
    bill_date TEXT DEFAULT (date('now')),
    due_date TEXT,
    rent_amount INTEGER NOT NULL DEFAULT 0,
    maint_amount INTEGER NOT NULL DEFAULT 0,
    prev_eb_reading INTEGER NOT NULL DEFAULT 0,
    curr_eb_reading INTEGER NOT NULL DEFAULT 0,
    eb_units INTEGER NOT NULL DEFAULT 0,
    eb_amount INTEGER NOT NULL DEFAULT 0,
    prev_water_reading INTEGER NOT NULL DEFAULT 0,
    curr_water_reading INTEGER NOT NULL DEFAULT 0,
    water_units INTEGER NOT NULL DEFAULT 0,
    water_amount INTEGER NOT NULL DEFAULT 0,
    arrears_included INTEGER NOT NULL DEFAULT 0,
    late_fee INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    others INTEGER NOT NULL DEFAULT 0,
    gross_amount INTEGER NOT NULL DEFAULT 0,
    net_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    balance_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'UNPAID',
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    is_void INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    UNIQUE(renter_id, billing_period)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
    bill_uuid TEXT,
    renter_id INTEGER REFERENCES renters(id) ON DELETE RESTRICT,
    renter_uuid TEXT,
    payment_date TEXT DEFAULT (datetime('now')),
    amount INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    reference_no TEXT,
    receipt_no TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    property_uuid TEXT,
    category TEXT DEFAULT 'OTHER',
    description TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    expense_date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    property_uuid TEXT,
    unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
    unit_uuid TEXT,
    renter_id INTEGER REFERENCES renters(id) ON DELETE SET NULL,
    renter_uuid TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    estimated_cost INTEGER NOT NULL DEFAULT 0,
    actual_cost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    entity_uuid TEXT,
    file_name TEXT NOT NULL,
    file_data TEXT,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- ============================================================================
-- SYNC ENGINE TABLES: OUTBOX & STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_uuid TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
`
