import { randomId } from "../checkin/security.js";
import { DEFAULT_FINANCE_SETTINGS, calculateBooking, calculateSummary } from "./core.js";
import {
  MAX_ACTIVE_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
  MAX_FINANCE_CLASS_A_PER_MONTH,
  MAX_FINANCE_CLASS_B_PER_MONTH
} from "./attachments.js";

const nowIso = () => new Date().toISOString();
const bool = (value) => Boolean(Number(value));
const rowsOf = (result) => result?.results || [];

const bookingRow = (row) => {
  if (!row) return null;
  const booking = {
    id: row.id,
    externalUid: row.external_uid || "",
    source: row.source,
    title: row.title,
    bookingReference: row.booking_reference,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    origin: row.origin,
    guests: row.guests,
    revenueCents: row.revenue_cents,
    revenueReceivedCents: row.revenue_received_cents,
    revenueReceivedDate: row.revenue_received_date || "",
    riccardoMinutes: row.riccardo_minutes,
    hourlyRateCents: row.hourly_rate_cents,
    laundryRateCents: row.laundry_rate_cents,
    commissionBps: row.commission_bps,
    purchasesDescription: row.purchases_description,
    purchasesCents: row.purchases_cents,
    otherReimbursableCents: row.other_reimbursable_cents,
    notes: row.notes,
    manualDateOverride: bool(row.manual_date_override),
    needsReview: bool(row.needs_review),
    icalLastSeenAt: row.ical_last_seen_at || "",
    icalRemovedAt: row.ical_removed_at || "",
    voidedAt: row.voided_at || "",
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
    propertyExpensesCents: Number(row.property_expenses_cents || 0),
    allocatedPaymentsCents: Number(row.allocated_payments_cents || 0)
  };
  return { ...booking, calculations: calculateBooking(booking) };
};

const expenseRow = (row) => row && ({
  id: row.id,
  expenseDate: row.expense_date,
  categoryId: row.category_id,
  categoryName: row.category_name || "",
  description: row.description,
  supplier: row.supplier,
  amountCents: row.amount_cents,
  currency: row.currency,
  incurredStatus: row.incurred_status,
  paymentStatus: row.payment_status,
  paymentDate: row.payment_date || "",
  paymentMethod: row.payment_method,
  paidBy: row.paid_by,
  bookingId: row.booking_id || "",
  reimbursableToRiccardo: bool(row.reimbursable_to_riccardo),
  notes: row.notes,
  allocatedPaymentsCents: Number(row.allocated_payments_cents || 0),
  riccardoPaymentStatus: !bool(row.reimbursable_to_riccardo) ? "not_applicable" : Number(row.allocated_payments_cents || 0) <= 0 ? "unpaid" : Number(row.allocated_payments_cents || 0) < row.amount_cents ? "partially_paid" : "paid",
  voidedAt: row.voided_at || "",
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  version: row.version,
  attachmentCount: Number(row.attachment_count || 0),
  hasEvidence: Number(row.attachment_count || 0) > 0
});

const paymentRow = (row) => row && ({
  id: row.id,
  paymentDate: row.payment_date,
  amountCents: row.amount_cents,
  paymentMethod: row.payment_method,
  reference: row.reference,
  notes: row.notes,
  allocatedCents: Number(row.allocated_cents || 0),
  unallocatedCents: row.amount_cents - Number(row.allocated_cents || 0),
  voidedAt: row.voided_at || "",
  createdAt: row.created_at,
  createdBy: row.created_by,
  attachmentCount: Number(row.attachment_count || 0),
  hasEvidence: Number(row.attachment_count || 0) > 0
});

const attachmentRow = (row) => row && ({
  id: row.id,
  parentType: row.parent_type,
  parentId: row.parent_type === "expense" ? row.expense_id : row.payment_id,
  objectKey: row.object_key,
  originalFilename: row.original_filename,
  displayFilename: row.display_filename,
  mimeType: row.mime_type,
  extension: row.file_extension,
  sizeBytes: row.size_bytes,
  checksum: row.sha256,
  description: row.description,
  status: row.status,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at || "",
  deletedBy: row.deleted_by || ""
});

const settingsRow = (row) => row ? ({
  hourlyRateCents: row.hourly_rate_cents,
  laundryRateCents: row.laundry_rate_cents,
  commissionBps: row.commission_bps,
  currency: row.currency,
  reportingMonth: row.reporting_month,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
}) : { ...DEFAULT_FINANCE_SETTINGS };

const auditStatement = (db, actor, action, entityType, entityId, changedFields = [], metadata = {}) =>
  db.prepare(`INSERT INTO finance_audit_events
    (id, occurred_at, actor, action, entity_type, entity_id, changed_fields, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(randomId(), nowIso(), actor, action, entityType, entityId, JSON.stringify(changedFields), JSON.stringify(metadata));

export class FinanceRepository {
  constructor(db) {
    if (!db?.prepare || !db?.batch) throw new Error("Finance database binding is unavailable");
    this.db = db;
  }

  async getSettings() {
    return settingsRow(await this.db.prepare("SELECT * FROM finance_settings WHERE id = 1").first());
  }

  async updateSettings(input, actor) {
    const timestamp = nowIso();
    const statement = this.db.prepare(`UPDATE finance_settings SET hourly_rate_cents = ?, laundry_rate_cents = ?,
      commission_bps = ?, currency = ?, reporting_month = ?, updated_at = ?, updated_by = ? WHERE id = 1`)
      .bind(input.hourlyRateCents, input.laundryRateCents, input.commissionBps, input.currency, input.reportingMonth, timestamp, actor);
    await this.db.batch([statement, auditStatement(this.db, actor, "settings_updated", "settings", "1", ["hourlyRateCents", "laundryRateCents", "commissionBps", "currency", "reportingMonth"])]);
    return this.getSettings();
  }

  bookingFilter(filters = {}, alias = "b") {
    const clauses = [`${alias}.voided_at IS NULL`];
    const values = [];
    if (filters.from) { clauses.push(`${alias}.check_in >= ?`); values.push(filters.from); }
    if (filters.to) { clauses.push(`${alias}.check_in <= ?`); values.push(filters.to); }
    if (filters.year) { clauses.push(`substr(${alias}.check_in, 1, 4) = ?`); values.push(String(filters.year)); }
    if (filters.month) { clauses.push(`substr(${alias}.check_in, 6, 2) = ?`); values.push(String(filters.month).padStart(2, "0")); }
    if (filters.status) { clauses.push(`${alias}.status = ?`); values.push(filters.status); }
    if (filters.search) {
      clauses.push(`(lower(${alias}.title) LIKE ? OR lower(${alias}.booking_reference) LIKE ? OR lower(${alias}.source) LIKE ?)`);
      const search = `%${String(filters.search).toLowerCase()}%`;
      values.push(search, search, search);
    }
    return { where: clauses.join(" AND "), values };
  }

  async listBookings(filters = {}) {
    const { where, values } = this.bookingFilter(filters);
    const allowedSort = new Map([["checkIn", "b.check_in"], ["revenue", "b.revenue_cents"], ["updatedAt", "b.updated_at"], ["title", "b.title"]]);
    const sort = allowedSort.get(filters.sort) || "b.check_in";
    const direction = filters.direction === "desc" ? "DESC" : "ASC";
    const result = await this.db.prepare(`SELECT b.*,
      COALESCE((SELECT SUM(e.amount_cents) FROM finance_expenses e WHERE e.booking_id = b.id AND e.voided_at IS NULL AND e.incurred_status != 'void'), 0) AS property_expenses_cents,
      COALESCE((SELECT SUM(a.amount_cents) FROM finance_payment_allocations a JOIN finance_payments p ON p.id = a.payment_id WHERE a.booking_id = b.id AND p.voided_at IS NULL), 0) AS allocated_payments_cents
      FROM finance_bookings b WHERE ${where} ORDER BY ${sort} ${direction}, b.id ASC`).bind(...values).all();
    return rowsOf(result).map(bookingRow);
  }

  async getBooking(id) {
    return bookingRow(await this.db.prepare(`SELECT b.*,
      COALESCE((SELECT SUM(e.amount_cents) FROM finance_expenses e WHERE e.booking_id = b.id AND e.voided_at IS NULL AND e.incurred_status != 'void'), 0) AS property_expenses_cents,
      COALESCE((SELECT SUM(a.amount_cents) FROM finance_payment_allocations a JOIN finance_payments p ON p.id = a.payment_id WHERE a.booking_id = b.id AND p.voided_at IS NULL), 0) AS allocated_payments_cents
      FROM finance_bookings b WHERE b.id = ?`).bind(id).first());
  }

  async createBooking(input, actor, { id = randomId(), origin = "manual" } = {}) {
    const settings = await this.getSettings();
    const timestamp = nowIso();
    const values = {
      hourlyRateCents: input.hourlyRateCents ?? settings.hourlyRateCents,
      laundryRateCents: input.laundryRateCents ?? settings.laundryRateCents,
      commissionBps: input.commissionBps ?? settings.commissionBps
    };
    const statement = this.db.prepare(`INSERT INTO finance_bookings
      (id, external_uid, source, title, booking_reference, check_in, check_out, status, origin, guests,
       revenue_cents, revenue_received_cents, revenue_received_date, riccardo_minutes, hourly_rate_cents,
       laundry_rate_cents, commission_bps, purchases_description, purchases_cents, other_reimbursable_cents,
       notes, manual_date_override, needs_review, ical_last_seen_at, created_at, created_by, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.externalUid || null, input.source || "Manual", input.title || "Manual booking", input.bookingReference || "",
        input.checkIn, input.checkOut, input.status || "active", origin, input.guests || 0, input.revenueCents || 0,
        input.revenueReceivedCents || 0, input.revenueReceivedDate || null, input.riccardoMinutes || 0,
        values.hourlyRateCents, values.laundryRateCents, values.commissionBps, input.purchasesDescription || "",
        input.purchasesCents || 0, input.otherReimbursableCents || 0, input.notes || "", input.manualDateOverride ? 1 : 0,
        0, origin === "ical" ? timestamp : null, timestamp, actor, timestamp, actor);
    await this.db.batch([statement, auditStatement(this.db, actor, "created", "booking", id, Object.keys(input), { origin })]);
    return this.getBooking(id);
  }

  async updateBooking(id, input, actor) {
    const existing = await this.getBooking(id);
    if (!existing) return null;
    const timestamp = nowIso();
    const changed = ["title", "bookingReference", "source", "checkIn", "checkOut", "status", "guests", "revenueCents", "revenueReceivedCents", "revenueReceivedDate", "riccardoMinutes", "hourlyRateCents", "laundryRateCents", "commissionBps", "purchasesDescription", "purchasesCents", "otherReimbursableCents", "notes", "manualDateOverride"]
      .filter((field) => input[field] !== undefined && input[field] !== existing[field]);
    const next = { ...existing, ...Object.fromEntries(changed.map((field) => [field, input[field]])) };
    const statement = this.db.prepare(`UPDATE finance_bookings SET title = ?, booking_reference = ?, source = ?, check_in = ?, check_out = ?,
      status = ?, guests = ?, revenue_cents = ?, revenue_received_cents = ?, revenue_received_date = ?, riccardo_minutes = ?,
      hourly_rate_cents = ?, laundry_rate_cents = ?, commission_bps = ?, purchases_description = ?, purchases_cents = ?,
      other_reimbursable_cents = ?, notes = ?, manual_date_override = ?, updated_at = ?, updated_by = ?, version = version + 1
      WHERE id = ? AND version = ?`)
      .bind(next.title, next.bookingReference, next.source, next.checkIn, next.checkOut, next.status, next.guests,
        next.revenueCents, next.revenueReceivedCents, next.revenueReceivedDate || null, next.riccardoMinutes,
        next.hourlyRateCents, next.laundryRateCents, next.commissionBps, next.purchasesDescription, next.purchasesCents,
        next.otherReimbursableCents, next.notes, next.manualDateOverride ? 1 : 0, timestamp, actor, id, input.version ?? existing.version);
    const result = await this.db.batch([statement, auditStatement(this.db, actor, "updated", "booking", id, changed)]);
    if (!result[0]?.meta?.changes) return { conflict: true };
    return this.getBooking(id);
  }

  async voidBooking(id, actor) {
    const timestamp = nowIso();
    const result = await this.db.batch([
      this.db.prepare("UPDATE finance_bookings SET voided_at = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND voided_at IS NULL").bind(timestamp, timestamp, actor, id),
      auditStatement(this.db, actor, "voided", "booking", id, ["voidedAt"])
    ]);
    return Boolean(result[0]?.meta?.changes);
  }

  async listCategories() {
    return rowsOf(await this.db.prepare("SELECT id, name, active, sort_order FROM finance_categories ORDER BY sort_order, name").all())
      .map((row) => ({ id: row.id, name: row.name, active: bool(row.active), sortOrder: row.sort_order }));
  }

  async createCategory(input, actor) {
    const id = input.id || String(input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || randomId();
    const timestamp = nowIso();
    await this.db.batch([
      this.db.prepare("INSERT INTO finance_categories (id, name, active, sort_order, created_at, created_by) VALUES (?, ?, 1, ?, ?, ?)").bind(id, input.name, input.sortOrder || 500, timestamp, actor),
      auditStatement(this.db, actor, "created", "category", id, ["name", "sortOrder"])
    ]);
    return { id, name: input.name, active: true, sortOrder: input.sortOrder || 500 };
  }

  async listExpenses(filters = {}) {
    const clauses = ["e.voided_at IS NULL"];
    const values = [];
    if (filters.from) { clauses.push("e.expense_date >= ?"); values.push(filters.from); }
    if (filters.to) { clauses.push("e.expense_date <= ?"); values.push(filters.to); }
    if (filters.year) { clauses.push("substr(e.expense_date, 1, 4) = ?"); values.push(String(filters.year)); }
    if (filters.month) { clauses.push("substr(e.expense_date, 6, 2) = ?"); values.push(String(filters.month).padStart(2, "0")); }
    if (filters.bookingId) { clauses.push("e.booking_id = ?"); values.push(filters.bookingId); }
    const result = await this.db.prepare(`SELECT e.*, c.name AS category_name,
      COALESCE((SELECT COUNT(*) FROM finance_attachments fa WHERE fa.expense_id = e.id AND fa.status = 'active'), 0) AS attachment_count,
      COALESCE((SELECT SUM(a.amount_cents) FROM finance_payment_allocations a JOIN finance_payments p ON p.id = a.payment_id WHERE a.expense_id = e.id AND p.voided_at IS NULL), 0) AS allocated_payments_cents
      FROM finance_expenses e JOIN finance_categories c ON c.id = e.category_id
      WHERE ${clauses.join(" AND ")} ORDER BY e.expense_date DESC, e.created_at DESC`).bind(...values).all();
    return rowsOf(result).map(expenseRow);
  }

  async getExpense(id) {
    return expenseRow(await this.db.prepare(`SELECT e.*, c.name AS category_name,
      COALESCE((SELECT COUNT(*) FROM finance_attachments fa WHERE fa.expense_id = e.id AND fa.status = 'active'), 0) AS attachment_count,
      COALESCE((SELECT SUM(a.amount_cents) FROM finance_payment_allocations a JOIN finance_payments p ON p.id = a.payment_id WHERE a.expense_id = e.id AND p.voided_at IS NULL), 0) AS allocated_payments_cents
      FROM finance_expenses e JOIN finance_categories c ON c.id = e.category_id WHERE e.id = ?`).bind(id).first());
  }

  async createExpense(input, actor) {
    const id = randomId();
    const timestamp = nowIso();
    const statement = this.db.prepare(`INSERT INTO finance_expenses
      (id, expense_date, category_id, description, supplier, amount_cents, currency, incurred_status, payment_status,
       payment_date, payment_method, paid_by, booking_id, reimbursable_to_riccardo, notes, created_at, created_by, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.expenseDate, input.categoryId, input.description, input.supplier || "", input.amountCents,
        input.currency || "EUR", input.incurredStatus || "incurred", input.paymentStatus || "unpaid", input.paymentDate || null,
        input.paymentMethod || "", input.paidBy || "owner", input.bookingId || null, input.reimbursableToRiccardo ? 1 : 0,
        input.notes || "", timestamp, actor, timestamp, actor);
    await this.db.batch([statement, auditStatement(this.db, actor, "created", "expense", id, Object.keys(input))]);
    return this.getExpense(id);
  }

  async updateExpense(id, input, actor) {
    const existing = await this.getExpense(id);
    if (!existing) return null;
    const changed = ["expenseDate", "categoryId", "description", "supplier", "amountCents", "currency", "incurredStatus", "paymentStatus", "paymentDate", "paymentMethod", "paidBy", "bookingId", "reimbursableToRiccardo", "notes"]
      .filter((field) => input[field] !== undefined && input[field] !== existing[field]);
    const next = { ...existing, ...Object.fromEntries(changed.map((field) => [field, input[field]])) };
    const timestamp = nowIso();
    const result = await this.db.batch([
      this.db.prepare(`UPDATE finance_expenses SET expense_date = ?, category_id = ?, description = ?, supplier = ?, amount_cents = ?, currency = ?, incurred_status = ?, payment_status = ?, payment_date = ?, payment_method = ?, paid_by = ?, booking_id = ?, reimbursable_to_riccardo = ?, notes = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND version = ?`)
        .bind(next.expenseDate, next.categoryId, next.description, next.supplier, next.amountCents, next.currency, next.incurredStatus, next.paymentStatus, next.paymentDate || null, next.paymentMethod, next.paidBy, next.bookingId || null, next.reimbursableToRiccardo ? 1 : 0, next.notes, timestamp, actor, id, input.version ?? existing.version),
      auditStatement(this.db, actor, "updated", "expense", id, changed)
    ]);
    if (!result[0]?.meta?.changes) return { conflict: true };
    return this.getExpense(id);
  }

  async voidExpense(id, actor) {
    const timestamp = nowIso();
    const result = await this.db.batch([
      this.db.prepare("UPDATE finance_expenses SET voided_at = ?, incurred_status = 'void', updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND voided_at IS NULL").bind(timestamp, timestamp, actor, id),
      auditStatement(this.db, actor, "voided", "expense", id, ["voidedAt", "incurredStatus"])
    ]);
    return Boolean(result[0]?.meta?.changes);
  }

  async listPayments(filters = {}) {
    const clauses = ["p.voided_at IS NULL"];
    const values = [];
    if (filters.from) { clauses.push("p.payment_date >= ?"); values.push(filters.from); }
    if (filters.to) { clauses.push("p.payment_date <= ?"); values.push(filters.to); }
    if (filters.year) { clauses.push("substr(p.payment_date, 1, 4) = ?"); values.push(String(filters.year)); }
    if (filters.month) { clauses.push("substr(p.payment_date, 6, 2) = ?"); values.push(String(filters.month).padStart(2, "0")); }
    const result = await this.db.prepare(`SELECT p.*, COALESCE(SUM(a.amount_cents), 0) AS allocated_cents,
      COALESCE((SELECT COUNT(*) FROM finance_attachments fa WHERE fa.payment_id = p.id AND fa.status = 'active'), 0) AS attachment_count
      FROM finance_payments p LEFT JOIN finance_payment_allocations a ON a.payment_id = p.id
      WHERE ${clauses.join(" AND ")} GROUP BY p.id ORDER BY p.payment_date DESC, p.created_at DESC`).bind(...values).all();
    return rowsOf(result).map(paymentRow);
  }

  async getPayment(id) {
    return paymentRow(await this.db.prepare(`SELECT p.*, COALESCE(SUM(a.amount_cents), 0) AS allocated_cents,
      COALESCE((SELECT COUNT(*) FROM finance_attachments fa WHERE fa.payment_id = p.id AND fa.status = 'active'), 0) AS attachment_count
      FROM finance_payments p LEFT JOIN finance_payment_allocations a ON a.payment_id = p.id
      WHERE p.id = ? GROUP BY p.id`).bind(id).first());
  }

  async listAllocations(paymentId = "") {
    const statement = paymentId
      ? this.db.prepare("SELECT * FROM finance_payment_allocations WHERE payment_id = ? ORDER BY created_at").bind(paymentId)
      : this.db.prepare("SELECT * FROM finance_payment_allocations ORDER BY created_at");
    return rowsOf(await statement.all()).map((row) => ({ id: row.id, paymentId: row.payment_id, bookingId: row.booking_id || "", expenseId: row.expense_id || "", amountCents: row.amount_cents, createdAt: row.created_at, createdBy: row.created_by }));
  }

  async validateAllocationTargets(allocations) {
    const grouped = new Map();
    for (const allocation of allocations) {
      const key = allocation.bookingId ? `booking:${allocation.bookingId}` : `expense:${allocation.expenseId}`;
      grouped.set(key, (grouped.get(key) || 0) + allocation.amountCents);
    }
    for (const [key, amountCents] of grouped) {
      const [type, id] = key.split(":");
      if (type === "booking") {
        const booking = await this.getBooking(id);
        if (!booking) throw new Error("Allocation booking does not exist");
        if (amountCents > Math.max(0, booking.calculations.outstandingCents)) throw new Error("Allocation exceeds the booking outstanding balance");
      } else {
        const expense = await this.getExpense(id);
        if (!expense || !expense.reimbursableToRiccardo || expense.paidBy !== "riccardo") throw new Error("Allocation expense is not reimbursable to Riccardo");
        if (amountCents > Math.max(0, expense.amountCents - expense.allocatedPaymentsCents)) throw new Error("Allocation exceeds the expense outstanding balance");
      }
    }
  }

  async createPayment(input, actor) {
    const existing = await this.db.prepare("SELECT * FROM finance_payments WHERE idempotency_key = ?").bind(input.idempotencyKey).first();
    if (existing) return { payment: paymentRow({ ...existing, allocated_cents: (await this.listAllocations(existing.id)).reduce((sum, row) => sum + row.amountCents, 0) }), existing: true };
    const allocations = input.allocations || [];
    const allocated = allocations.reduce((sum, entry) => sum + entry.amountCents, 0);
    if (allocated > input.amountCents) throw new Error("Payment allocations exceed the payment amount");
    await this.validateAllocationTargets(allocations);
    const id = randomId();
    const timestamp = nowIso();
    const statements = [
      this.db.prepare(`INSERT INTO finance_payments (id, payment_date, amount_cents, payment_method, reference, notes, idempotency_key, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, input.paymentDate, input.amountCents, input.paymentMethod || "", input.reference || "", input.notes || "", input.idempotencyKey, timestamp, actor)
    ];
    for (const allocation of allocations) {
      statements.push(this.db.prepare(`INSERT INTO finance_payment_allocations (id, payment_id, booking_id, expense_id, amount_cents, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(randomId(), id, allocation.bookingId || null, allocation.expenseId || null, allocation.amountCents, timestamp, actor));
    }
    statements.push(auditStatement(this.db, actor, "payment_created", "payment", id, ["paymentDate", "amountCents", "paymentMethod", "reference"], { allocationCount: allocations.length }));
    await this.db.batch(statements);
    const payment = (await this.listPayments()).find((entry) => entry.id === id);
    return { payment, existing: false };
  }

  async addAllocation(paymentId, input, actor) {
    const payment = (await this.listPayments()).find((entry) => entry.id === paymentId);
    if (!payment) return null;
    if (input.amountCents > payment.unallocatedCents) throw new Error("Allocation exceeds the unallocated payment balance");
    await this.validateAllocationTargets([input]);
    const id = randomId();
    const timestamp = nowIso();
    await this.db.batch([
      this.db.prepare("INSERT INTO finance_payment_allocations (id, payment_id, booking_id, expense_id, amount_cents, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, paymentId, input.bookingId || null, input.expenseId || null, input.amountCents, timestamp, actor),
      auditStatement(this.db, actor, "payment_allocated", "allocation", id, ["paymentId", "bookingId", "expenseId", "amountCents"])
    ]);
    return (await this.listAllocations(paymentId)).find((entry) => entry.id === id);
  }

  async voidPayment(id, actor) {
    const timestamp = nowIso();
    const result = await this.db.batch([
      this.db.prepare("UPDATE finance_payments SET voided_at = ? WHERE id = ? AND voided_at IS NULL").bind(timestamp, id),
      auditStatement(this.db, actor, "voided", "payment", id, ["voidedAt"])
    ]);
    return Boolean(result[0]?.meta?.changes);
  }

  async attachmentParent(parentType, parentId) {
    if (parentType === "expense") return this.getExpense(parentId);
    if (parentType === "payment") return this.getPayment(parentId);
    return null;
  }

  async listAttachments(parentType, parentId) {
    if (!await this.attachmentParent(parentType, parentId)) return null;
    const column = parentType === "expense" ? "expense_id" : "payment_id";
    return rowsOf(await this.db.prepare(`SELECT * FROM finance_attachments WHERE ${column} = ? AND status IN ('active', 'delete_pending', 'delete_failed') ORDER BY uploaded_at DESC`).bind(parentId).all()).map(attachmentRow);
  }

  async getAttachment(id) {
    return attachmentRow(await this.db.prepare("SELECT * FROM finance_attachments WHERE id = ?").bind(id).first());
  }

  async reserveAttachment(input, actor) {
    const parent = await this.attachmentParent(input.parentType, input.parentId);
    if (!parent || parent.voidedAt) return { reason: "parent_not_found" };
    const column = input.parentType === "expense" ? "expense_id" : "payment_id";
    const duplicate = attachmentRow(await this.db.prepare(`SELECT * FROM finance_attachments WHERE ${column} = ? AND sha256 = ? AND status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined') LIMIT 1`).bind(input.parentId, input.checksum).first());
    if (duplicate?.status === "quarantined") return { reason: "quarantined_duplicate" };
    if (duplicate) return { duplicate };
    const timestamp = nowIso();
    const expenseId = input.parentType === "expense" ? input.parentId : null;
    const paymentId = input.parentType === "payment" ? input.parentId : null;
    const statement = this.db.prepare(`INSERT INTO finance_attachments
      (id, parent_type, expense_id, payment_id, object_key, original_filename, display_filename, mime_type,
       file_extension, size_bytes, sha256, description, status, uploaded_by, uploaded_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?
      WHERE (SELECT COUNT(*) FROM finance_attachments WHERE ${column} = ? AND status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined')) < ?
        AND (SELECT COALESCE(SUM(size_bytes), 0) FROM finance_attachments WHERE status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined')) + ? <= ?`)
      .bind(input.id, input.parentType, expenseId, paymentId, input.objectKey, input.originalFilename, input.displayFilename,
        input.mimeType, input.extension, input.sizeBytes, input.checksum, input.description || "", actor, timestamp, timestamp,
        input.parentId, MAX_ATTACHMENTS_PER_RECORD, input.sizeBytes, MAX_ACTIVE_ATTACHMENT_BYTES);
    const result = await statement.run();
    if (!result?.meta?.changes) {
      const count = Number((await this.db.prepare(`SELECT COUNT(*) AS total FROM finance_attachments WHERE ${column} = ? AND status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined')`).bind(input.parentId).first())?.total || 0);
      if (count >= MAX_ATTACHMENTS_PER_RECORD) return { reason: "record_limit" };
      return { reason: "storage_limit" };
    }
    await auditStatement(this.db, actor, "attachment_upload_initiated", "attachment", input.id, ["status"], {
      parentType: input.parentType, parentId: input.parentId, filename: input.displayFilename, sizeBytes: input.sizeBytes, result: "pending"
    }).run();
    return { attachment: await this.getAttachment(input.id) };
  }

  async consumeAttachmentOperation(kind) {
    const isClassA = kind === "class_a";
    const column = isClassA ? "class_a_operations" : "class_b_operations";
    const limit = isClassA ? MAX_FINANCE_CLASS_A_PER_MONTH : MAX_FINANCE_CLASS_B_PER_MONTH;
    const period = nowIso().slice(0, 7);
    const timestamp = nowIso();
    await this.db.prepare("INSERT OR IGNORE INTO finance_attachment_usage (period, class_a_operations, class_b_operations, updated_at) VALUES (?, 0, 0, ?)").bind(period, timestamp).run();
    const result = await this.db.prepare(`UPDATE finance_attachment_usage SET ${column} = ${column} + 1, updated_at = ? WHERE period = ? AND ${column} < ?`).bind(timestamp, period, limit).run();
    return Boolean(result?.meta?.changes);
  }

  async completeAttachmentUpload(id, actor) {
    const timestamp = nowIso();
    const attachment = await this.getAttachment(id);
    if (!attachment) return null;
    const result = await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET status = 'active', updated_at = ? WHERE id = ? AND status = 'pending'").bind(timestamp, id),
      auditStatement(this.db, actor, "attachment_upload_completed", "attachment", id, ["status"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "completed" })
    ]);
    return result[0]?.meta?.changes ? this.getAttachment(id) : null;
  }

  async failAttachmentUpload(id, actor, result = "failed") {
    const attachment = await this.getAttachment(id);
    if (!attachment) return;
    const timestamp = nowIso();
    const status = result === "orphan_cleanup_failed" ? "quarantined" : "upload_failed";
    await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(status, timestamp, id),
      auditStatement(this.db, actor, "attachment_upload_failed", "attachment", id, ["status"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result })
    ]);
  }

  async updateAttachmentDescription(id, description, actor) {
    const attachment = await this.getAttachment(id);
    if (!attachment || attachment.status !== "active") return null;
    const timestamp = nowIso();
    await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET description = ?, updated_at = ? WHERE id = ? AND status = 'active'").bind(description, timestamp, id),
      auditStatement(this.db, actor, "attachment_description_updated", "attachment", id, ["description"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "completed" })
    ]);
    return this.getAttachment(id);
  }

  async auditAttachmentAccess(id, actor, action) {
    const attachment = await this.getAttachment(id);
    if (!attachment) return;
    await auditStatement(this.db, actor, action, "attachment", id, [], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "completed" }).run();
  }

  async beginAttachmentDeletion(id, actor) {
    const attachment = await this.getAttachment(id);
    if (!attachment || !["active", "delete_failed"].includes(attachment.status)) return null;
    const timestamp = nowIso();
    const result = await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET status = 'delete_pending', updated_at = ? WHERE id = ? AND status IN ('active', 'delete_failed')").bind(timestamp, id),
      auditStatement(this.db, actor, "attachment_deletion_initiated", "attachment", id, ["status"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "pending" })
    ]);
    return result[0]?.meta?.changes ? this.getAttachment(id) : null;
  }

  async completeAttachmentDeletion(id, actor) {
    const attachment = await this.getAttachment(id);
    if (!attachment) return null;
    const timestamp = nowIso();
    await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET status = 'deleted', deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND status = 'delete_pending'").bind(timestamp, actor, timestamp, id),
      auditStatement(this.db, actor, "attachment_deleted", "attachment", id, ["status", "deletedAt", "deletedBy"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "completed" })
    ]);
    return this.getAttachment(id);
  }

  async failAttachmentDeletion(id, actor) {
    const attachment = await this.getAttachment(id);
    if (!attachment) return;
    const timestamp = nowIso();
    await this.db.batch([
      this.db.prepare("UPDATE finance_attachments SET status = 'delete_failed', updated_at = ? WHERE id = ? AND status = 'delete_pending'").bind(timestamp, id),
      auditStatement(this.db, actor, "attachment_deletion_failed", "attachment", id, ["status"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "failed" })
    ]);
  }

  async attachmentStorageSummary() {
    const row = await this.db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes FROM finance_attachments WHERE status IN ('pending', 'active', 'delete_pending', 'delete_failed', 'quarantined')").first();
    return { count: Number(row?.count || 0), bytes: Number(row?.bytes || 0), limitBytes: MAX_ACTIVE_ATTACHMENT_BYTES };
  }

  async attachmentConsistencyRows(prefix) {
    return rowsOf(await this.db.prepare(`SELECT a.*,
      CASE WHEN a.parent_type = 'expense' THEN e.id ELSE p.id END AS valid_parent_id
      FROM finance_attachments a
      LEFT JOIN finance_expenses e ON a.expense_id = e.id
      LEFT JOIN finance_payments p ON a.payment_id = p.id
      WHERE a.object_key LIKE ?`).bind(`${prefix}%`).all()).map((row) => ({ ...attachmentRow(row), validParent: Boolean(row.valid_parent_id) }));
  }

  async quarantineMissingAttachments(ids, actor) {
    let repaired = 0;
    for (const id of ids) {
      const attachment = await this.getAttachment(id);
      if (!attachment || !["pending", "active", "delete_pending", "delete_failed"].includes(attachment.status)) continue;
      const timestamp = nowIso();
      const result = await this.db.batch([
        this.db.prepare("UPDATE finance_attachments SET status = 'quarantined', updated_at = ? WHERE id = ? AND status IN ('pending', 'active', 'delete_pending', 'delete_failed')").bind(timestamp, id),
        auditStatement(this.db, actor, "attachment_orphan_repaired", "attachment", id, ["status"], { parentType: attachment.parentType, parentId: attachment.parentId, filename: attachment.displayFilename, result: "quarantined_missing_object" })
      ]);
      if (result[0]?.meta?.changes) repaired += 1;
    }
    return repaired;
  }

  async auditOrphanCleanup(actor, counts) {
    await auditStatement(this.db, actor, "attachment_orphan_cleanup", "attachment_consistency", nowIso().slice(0, 10), [], counts).run();
  }

  async summary(filters = {}) {
    const bookings = await this.listBookings(filters);
    const expenses = await this.listExpenses(filters);
    const payments = await this.listPayments(filters);
    const summary = calculateSummary({ bookings, expenses, payments });
    const periodClauses = (column) => {
      const clauses = [];
      const values = [];
      if (filters.from) { clauses.push(`${column} >= ?`); values.push(filters.from); }
      if (filters.to) { clauses.push(`${column} <= ?`); values.push(filters.to); }
      if (filters.year) { clauses.push(`substr(${column}, 1, 4) = ?`); values.push(String(filters.year)); }
      if (filters.month) { clauses.push(`substr(${column}, 6, 2) = ?`); values.push(String(filters.month).padStart(2, "0")); }
      return { clauses, values };
    };
    if (filters.from || filters.to || filters.year || filters.month) {
      const receivedPeriod = periodClauses("revenue_received_date");
      const expensePaidPeriod = periodClauses("payment_date");
      const received = await this.db.prepare(`SELECT COALESCE(SUM(revenue_received_cents), 0) AS total FROM finance_bookings WHERE voided_at IS NULL AND revenue_received_date IS NOT NULL AND ${receivedPeriod.clauses.join(" AND ")}`).bind(...receivedPeriod.values).first();
      const ownerPaid = await this.db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total FROM finance_expenses WHERE voided_at IS NULL AND incurred_status = 'incurred' AND payment_status = 'paid' AND paid_by != 'riccardo' AND payment_date IS NOT NULL AND ${expensePaidPeriod.clauses.join(" AND ")}`).bind(...expensePaidPeriod.values).first();
      summary.revenueReceivedCents = Number(received?.total || 0);
      summary.cashPositionCents = summary.revenueReceivedCents - Number(ownerPaid?.total || 0) - summary.riccardoPaidCents;
    }
    return summary;
  }

  async monthlyReport(year) {
    const months = [];
    for (let month = 1; month <= 12; month += 1) {
      months.push({ month, ...(await this.summary({ year, month })) });
    }
    return months;
  }

  async listAudit(limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    return rowsOf(await this.db.prepare(`SELECT * FROM finance_audit_events ORDER BY occurred_at DESC LIMIT ${safeLimit}`).all()).map((row) => ({
      id: row.id, occurredAt: row.occurred_at, actor: row.actor, action: row.action, entityType: row.entity_type,
      entityId: row.entity_id, changedFields: JSON.parse(row.changed_fields || "[]"), metadata: JSON.parse(row.metadata || "{}")
    }));
  }

  async lastSync() {
    const row = await this.db.prepare("SELECT * FROM finance_sync_runs ORDER BY started_at DESC LIMIT 1").first();
    return row && { id: row.id, source: row.source, status: row.status, startedAt: row.started_at, completedAt: row.completed_at || "", created: row.created_count, updated: row.updated_count, removed: row.removed_count, ignored: row.ignored_count, ambiguous: row.ambiguous_count, errorCode: row.error_code };
  }

  async syncIcalEvents(events, actor) {
    const startedAt = nowIso();
    const runId = randomId();
    const settings = await this.getSettings();
    const reservations = events.filter((event) => event.type === "reservation");
    const seen = new Set(reservations.map((event) => event.uid));
    let created = 0;
    let updated = 0;
    let removed = 0;
    let ambiguous = 0;
    const statements = [];
    for (const event of reservations) {
      let existing = await this.db.prepare("SELECT * FROM finance_bookings WHERE external_uid = ?").bind(event.uid).first();
      if (!existing) {
        const candidates = rowsOf(await this.db.prepare("SELECT * FROM finance_bookings WHERE external_uid IS NULL AND origin IN ('spreadsheet', 'manual') AND check_in = ? AND check_out = ? AND voided_at IS NULL").bind(event.checkIn, event.checkOut).all());
        if (candidates.length === 1) existing = candidates[0];
        if (candidates.length > 1) {
          ambiguous += 1;
          statements.push(auditStatement(this.db, actor, "ical_ambiguous", "sync", runId, [], { candidateCount: candidates.length }));
          continue;
        }
      }
      if (!existing) {
        const id = randomId();
        statements.push(this.db.prepare(`INSERT INTO finance_bookings
          (id, external_uid, source, title, booking_reference, check_in, check_out, status, origin, hourly_rate_cents,
           laundry_rate_cents, commission_bps, ical_last_seen_at, created_at, created_by, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ical', ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, event.uid, event.source || "Airbnb", event.summary || "Reserved", event.reservationCode || "", event.checkIn,
            event.checkOut, event.status === "cancelled" ? "cancelled" : "active", settings.hourlyRateCents, settings.laundryRateCents,
            settings.commissionBps, startedAt, startedAt, actor, startedAt, actor));
        statements.push(auditStatement(this.db, actor, "ical_created", "booking", id, ["externalUid", "source", "title", "bookingReference", "checkIn", "checkOut", "status"]));
        created += 1;
      } else {
        const conflict = bool(existing.manual_date_override) && (existing.check_in !== event.checkIn || existing.check_out !== event.checkOut);
        statements.push(this.db.prepare(`UPDATE finance_bookings SET external_uid = COALESCE(external_uid, ?), source = ?, title = ?, booking_reference = ?,
          check_in = CASE WHEN manual_date_override = 1 THEN check_in ELSE ? END,
          check_out = CASE WHEN manual_date_override = 1 THEN check_out ELSE ? END,
          status = ?, needs_review = ?, ical_last_seen_at = ?, ical_removed_at = NULL, updated_at = ?, updated_by = ?, version = version + 1
          WHERE id = ?`)
          .bind(event.uid, event.source || existing.source, existing.origin === "ical" ? event.summary || existing.title : existing.title, event.reservationCode || existing.booking_reference,
            event.checkIn, event.checkOut, event.status === "cancelled" ? "cancelled" : "active", conflict ? 1 : 0,
            startedAt, startedAt, actor, existing.id));
        statements.push(auditStatement(this.db, actor, conflict ? "ical_conflict" : "ical_updated", "booking", existing.id, ["source", "title", "bookingReference", "checkIn", "checkOut", "status"], { dateConflict: conflict }));
        updated += 1;
      }
    }
    const imported = rowsOf(await this.db.prepare("SELECT id, external_uid FROM finance_bookings WHERE origin = 'ical' AND voided_at IS NULL AND ical_removed_at IS NULL").all());
    for (const row of imported) {
      if (seen.has(row.external_uid)) continue;
      statements.push(this.db.prepare("UPDATE finance_bookings SET status = 'removed_from_calendar', ical_removed_at = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ?").bind(startedAt, startedAt, actor, row.id));
      statements.push(auditStatement(this.db, actor, "ical_removed", "booking", row.id, ["status", "icalRemovedAt"]));
      removed += 1;
    }
    statements.push(this.db.prepare(`INSERT INTO finance_sync_runs
      (id, source, status, started_at, completed_at, created_count, updated_count, removed_count, ignored_count, ambiguous_count, actor)
      VALUES (?, 'ical', 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(runId, startedAt, nowIso(), created, updated, removed, events.length - reservations.length + ambiguous, ambiguous, actor));
    statements.push(auditStatement(this.db, actor, "ical_reconciliation", "sync", runId, [], { created, updated, removed, ignored: events.length - reservations.length + ambiguous, ambiguous }));
    if (statements.length) await this.db.batch(statements);
    return { runId, created, updated, removed, ignored: events.length - reservations.length + ambiguous, ambiguous };
  }
}

export const __financeRepositoryTest = { bookingRow, expenseRow, paymentRow, settingsRow };
