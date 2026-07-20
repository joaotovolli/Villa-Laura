import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FinanceRepository } from "../src/finance/repository.js";
import { makeD1 } from "./helpers/d1.js";

const migration = `${await readFile("migrations/0001_finance.sql", "utf8")}\n${await readFile("migrations/0002_finance_attachments.sql", "utf8")}`;
const actor = "owner@example.test";
const input = (overrides = {}) => ({ title: "Synthetic Stay", source: "Manual", checkIn: "2026-08-01", checkOut: "2026-08-05", status: "active", guests: 2, revenueCents: 100000, revenueReceivedCents: 100000, riccardoMinutes: 120, purchasesCents: 0, otherReimbursableCents: 0, ...overrides });

test("migration is safe to execute repeatedly and retains default categories", async () => {
  const d1 = await makeD1(migration);
  d1.database.run(migration);
  const repo = new FinanceRepository(d1);
  assert.equal((await repo.getSettings()).hourlyRateCents, 1200);
  assert.equal((await repo.listCategories()).length, 12);
});

test("booking rate snapshots survive later default changes", async () => {
  const repo = new FinanceRepository(await makeD1(migration));
  const first = await repo.createBooking(input(), actor);
  await repo.updateSettings({ hourlyRateCents: 1500, laundryRateCents: 1100, commissionBps: 1800, currency: "EUR", reportingMonth: 1 }, actor);
  const historical = await repo.getBooking(first.id);
  const second = await repo.createBooking(input({ title: "Second Synthetic", checkIn: "2026-09-01", checkOut: "2026-09-03" }), actor);
  assert.equal(historical.hourlyRateCents, 1200);
  assert.equal(historical.commissionBps, 2000);
  assert.equal(second.hourlyRateCents, 1500);
  assert.equal(second.commissionBps, 1800);
});

test("partial payments, multiple payments, multiple targets, and unallocated balances are calculated", async () => {
  const repo = new FinanceRepository(await makeD1(migration));
  const one = await repo.createBooking(input(), actor);
  const two = await repo.createBooking(input({ title: "Second", checkIn: "2026-08-10", checkOut: "2026-08-12", revenueCents: 50000 }), actor);
  const firstPayment = await repo.createPayment({ paymentDate: "2026-08-06", amountCents: 30000, paymentMethod: "transfer", reference: "synthetic-1", notes: "", idempotencyKey: "payment-1", allocations: [{ bookingId: one.id, expenseId: "", amountCents: 10000 }, { bookingId: two.id, expenseId: "", amountCents: 5000 }] }, actor);
  assert.equal(firstPayment.payment.allocatedCents, 15000);
  assert.equal(firstPayment.payment.unallocatedCents, 15000);
  const repeated = await repo.createPayment({ paymentDate: "2026-08-06", amountCents: 30000, idempotencyKey: "payment-1", allocations: [] }, actor);
  assert.equal(repeated.existing, true);
  assert.equal((await repo.listPayments()).length, 1);
  await repo.addAllocation(firstPayment.payment.id, { bookingId: one.id, expenseId: "", amountCents: 5000 }, actor);
  await repo.createPayment({ paymentDate: "2026-08-07", amountCents: 5000, paymentMethod: "cash", reference: "synthetic-2", notes: "", idempotencyKey: "payment-2", allocations: [{ bookingId: one.id, expenseId: "", amountCents: 5000 }] }, actor);
  const updatedOne = await repo.getBooking(one.id);
  assert.equal(updatedOne.allocatedPaymentsCents, 20000);
  assert.equal((await repo.listAllocations()).length, 4);
});

test("reimbursable expense allocations do not double count operating costs", async () => {
  const repo = new FinanceRepository(await makeD1(migration));
  await repo.createBooking(input(), actor);
  const expense = await repo.createExpense({ expenseDate: "2026-08-02", categoryId: "repairs", description: "Synthetic repair", supplier: "Test supplier", amountCents: 10000, currency: "EUR", incurredStatus: "incurred", paymentStatus: "paid", paymentDate: "2026-08-02", paymentMethod: "cash", paidBy: "riccardo", bookingId: "", reimbursableToRiccardo: true, notes: "" }, actor);
  const before = await repo.summary({ year: 2026, month: 8 });
  await repo.createPayment({ paymentDate: "2026-08-03", amountCents: 10000, paymentMethod: "transfer", reference: "expense reimbursement", notes: "", idempotencyKey: "expense-payment", allocations: [{ bookingId: "", expenseId: expense.id, amountCents: 10000 }] }, actor);
  const after = await repo.summary({ year: 2026, month: 8 });
  assert.equal(after.operatingProfitCents, before.operatingProfitCents);
  assert.equal(after.riccardoOutstandingCents, before.riccardoOutstandingCents - 10000);
});

test("iCal finance sync is idempotent, filters blocks, preserves manual fields, and audits removed events", async () => {
  const repo = new FinanceRepository(await makeD1(migration));
  const events = [
    { uid: "synthetic-ical-1", type: "reservation", summary: "Reserved", source: "Airbnb", reservationCode: "SYNTH1", checkIn: "2026-10-01", checkOut: "2026-10-05", status: "imported" },
    { uid: "synthetic-block", type: "blocked", summary: "Not available", source: "Airbnb", checkIn: "2026-10-06", checkOut: "2026-10-07", status: "blocked" }
  ];
  const first = await repo.syncIcalEvents(events, actor);
  const second = await repo.syncIcalEvents(events, actor);
  assert.equal(first.created, 1);
  assert.equal(first.ignored, 1);
  assert.equal(second.created, 0);
  assert.equal((await repo.listBookings()).length, 1);
  const imported = (await repo.listBookings())[0];
  await repo.updateBooking(imported.id, { version: imported.version, revenueCents: 12345, notes: "Manual synthetic finance", manualDateOverride: true }, actor);
  await repo.syncIcalEvents([{ ...events[0], checkIn: "2026-10-02", checkOut: "2026-10-06" }], actor);
  const preserved = await repo.getBooking(imported.id);
  assert.equal(preserved.revenueCents, 12345);
  assert.equal(preserved.notes, "Manual synthetic finance");
  assert.equal(preserved.checkIn, "2026-10-01");
  assert.equal(preserved.needsReview, true);
  const removed = await repo.syncIcalEvents([], actor);
  assert.equal(removed.removed, 1);
  assert.equal((await repo.getBooking(imported.id)).status, "removed_from_calendar");
  assert.equal((await repo.listAudit()).some((event) => event.action === "ical_removed"), true);
});
