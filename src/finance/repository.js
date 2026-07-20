import { randomId } from "../checkin/security.js";
import { DEFAULT_FINANCE_SETTINGS, calculateBooking, calculateSummary } from "./core.js";

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
  version: row.version
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
  createdBy: row.created_by
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
      COALESCE((SELECT SUM(a.amount_cents) FROM finance_payment_allocations a JOIN finance_payments p ON p.id = a.payment_id WHERE a.expense_id = e.id AND p.voided_at IS NULL), 0) AS allocated_payments_cents
      FROM finance_expenses e JOIN finance_categories c ON c.id = e.category_id
      WHERE ${clauses.join(" AND ")} ORDER BY e.expense_date DESC, e.created_at DESC`).bind(...values).all();
    return rowsOf(result).map(expenseRow);
  }

  async getExpense(id) {
    return expenseRow(await this.db.prepare(`SELECT e.*, c.name AS category_name,
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
    const result = await this.db.prepare(`SELECT p.*, COALESCE(SUM(a.amount_cents), 0) AS allocated_cents
      FROM finance_payments p LEFT JOIN finance_payment_allocations a ON a.payment_id = p.id
      WHERE ${clauses.join(" AND ")} GROUP BY p.id ORDER BY p.payment_date DESC, p.created_at DESC`).bind(...values).all();
    return rowsOf(result).map(paymentRow);
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
