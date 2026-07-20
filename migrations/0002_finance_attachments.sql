PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_attachments (
  id TEXT PRIMARY KEY,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('expense', 'payment')),
  expense_id TEXT REFERENCES finance_expenses(id),
  payment_id TEXT REFERENCES finance_payments(id),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  display_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_extension TEXT NOT NULL CHECK (file_extension IN ('pdf', 'jpg', 'jpeg', 'png', 'webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'upload_failed', 'delete_pending', 'delete_failed', 'deleted', 'quarantined')),
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  CHECK (
    (parent_type = 'expense' AND expense_id IS NOT NULL AND payment_id IS NULL) OR
    (parent_type = 'payment' AND payment_id IS NOT NULL AND expense_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS finance_attachments_expense_idx ON finance_attachments(expense_id, status, uploaded_at);
CREATE INDEX IF NOT EXISTS finance_attachments_payment_idx ON finance_attachments(payment_id, status, uploaded_at);
CREATE INDEX IF NOT EXISTS finance_attachments_status_idx ON finance_attachments(status, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS finance_attachments_expense_checksum_idx
  ON finance_attachments(expense_id, sha256)
  WHERE expense_id IS NOT NULL AND status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined');
CREATE UNIQUE INDEX IF NOT EXISTS finance_attachments_payment_checksum_idx
  ON finance_attachments(payment_id, sha256)
  WHERE payment_id IS NOT NULL AND status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined');

CREATE TABLE IF NOT EXISTS finance_attachment_usage (
  period TEXT PRIMARY KEY CHECK (length(period) = 7),
  class_a_operations INTEGER NOT NULL DEFAULT 0 CHECK (class_a_operations >= 0),
  class_b_operations INTEGER NOT NULL DEFAULT 0 CHECK (class_b_operations >= 0),
  updated_at TEXT NOT NULL
);
