PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
  laundry_rate_cents INTEGER NOT NULL CHECK (laundry_rate_cents >= 0),
  commission_bps INTEGER NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  reporting_month INTEGER NOT NULL DEFAULT 1 CHECK (reporting_month BETWEEN 1 AND 12),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

INSERT OR IGNORE INTO finance_settings
  (id, hourly_rate_cents, laundry_rate_cents, commission_bps, currency, reporting_month, updated_at, updated_by)
VALUES (1, 1200, 1000, 2000, 'EUR', 1, CURRENT_TIMESTAMP, 'migration');

CREATE TABLE IF NOT EXISTS finance_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

INSERT OR IGNORE INTO finance_categories (id, name, sort_order, created_at, created_by) VALUES
  ('electricity', 'Electricity', 10, CURRENT_TIMESTAMP, 'migration'),
  ('water', 'Water', 20, CURRENT_TIMESTAMP, 'migration'),
  ('internet', 'Internet', 30, CURRENT_TIMESTAMP, 'migration'),
  ('insurance', 'Insurance', 40, CURRENT_TIMESTAMP, 'migration'),
  ('maintenance', 'Maintenance', 50, CURRENT_TIMESTAMP, 'migration'),
  ('cleaning-supplies', 'Cleaning Supplies', 60, CURRENT_TIMESTAMP, 'migration'),
  ('garden', 'Garden', 70, CURRENT_TIMESTAMP, 'migration'),
  ('repairs', 'Repairs', 80, CURRENT_TIMESTAMP, 'migration'),
  ('furniture-appliances', 'Furniture and Appliances', 90, CURRENT_TIMESTAMP, 'migration'),
  ('taxes-fees', 'Taxes and Fees', 100, CURRENT_TIMESTAMP, 'migration'),
  ('professional-services', 'Professional Services', 110, CURRENT_TIMESTAMP, 'migration'),
  ('other', 'Other', 999, CURRENT_TIMESTAMP, 'migration');

CREATE TABLE IF NOT EXISTS finance_bookings (
  id TEXT PRIMARY KEY,
  external_uid TEXT UNIQUE,
  source TEXT NOT NULL DEFAULT 'Manual',
  title TEXT NOT NULL DEFAULT '',
  booking_reference TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('ical', 'manual', 'spreadsheet')),
  guests INTEGER NOT NULL DEFAULT 0 CHECK (guests >= 0),
  revenue_cents INTEGER NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  revenue_received_cents INTEGER NOT NULL DEFAULT 0 CHECK (revenue_received_cents >= 0),
  revenue_received_date TEXT,
  riccardo_minutes INTEGER NOT NULL DEFAULT 0 CHECK (riccardo_minutes >= 0),
  hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
  laundry_rate_cents INTEGER NOT NULL CHECK (laundry_rate_cents >= 0),
  commission_bps INTEGER NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  purchases_description TEXT NOT NULL DEFAULT '',
  purchases_cents INTEGER NOT NULL DEFAULT 0 CHECK (purchases_cents >= 0),
  other_reimbursable_cents INTEGER NOT NULL DEFAULT 0 CHECK (other_reimbursable_cents >= 0),
  notes TEXT NOT NULL DEFAULT '',
  manual_date_override INTEGER NOT NULL DEFAULT 0 CHECK (manual_date_override IN (0, 1)),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  ical_last_seen_at TEXT,
  ical_removed_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS finance_bookings_dates_idx ON finance_bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS finance_bookings_status_idx ON finance_bookings(status);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES finance_categories(id),
  description TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  incurred_status TEXT NOT NULL DEFAULT 'incurred' CHECK (incurred_status IN ('planned', 'incurred', 'void')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  payment_date TEXT,
  payment_method TEXT NOT NULL DEFAULT '',
  paid_by TEXT NOT NULL DEFAULT 'owner' CHECK (paid_by IN ('owner', 'riccardo', 'other')),
  booking_id TEXT REFERENCES finance_bookings(id),
  reimbursable_to_riccardo INTEGER NOT NULL DEFAULT 0 CHECK (reimbursable_to_riccardo IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '',
  voided_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (reimbursable_to_riccardo = 0 OR paid_by = 'riccardo')
);

CREATE INDEX IF NOT EXISTS finance_expenses_date_idx ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS finance_expenses_booking_idx ON finance_expenses(booking_id);

CREATE TABLE IF NOT EXISTS finance_payments (
  id TEXT PRIMARY KEY,
  payment_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS finance_payments_date_idx ON finance_payments(payment_date);

CREATE TABLE IF NOT EXISTS finance_payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES finance_payments(id),
  booking_id TEXT REFERENCES finance_bookings(id),
  expense_id TEXT REFERENCES finance_expenses(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  CHECK ((booking_id IS NOT NULL AND expense_id IS NULL) OR (booking_id IS NULL AND expense_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS finance_allocations_payment_idx ON finance_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS finance_allocations_booking_idx ON finance_payment_allocations(booking_id);
CREATE INDEX IF NOT EXISTS finance_allocations_expense_idx ON finance_payment_allocations(expense_id);

CREATE TABLE IF NOT EXISTS finance_sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  ambiguous_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_fields TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS finance_audit_occurred_idx ON finance_audit_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS finance_audit_entity_idx ON finance_audit_events(entity_type, entity_id);
