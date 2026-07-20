import assert from "node:assert/strict";
import test from "node:test";
import { calculateBooking, calculateSummary, centsFromDecimal, minutesFromHours, nightsBetween } from "../src/finance/core.js";

const booking = (overrides = {}) => ({
  checkIn: "2026-03-27", checkOut: "2026-03-30", guests: 4, revenueCents: 100000, revenueReceivedCents: 80000,
  riccardoMinutes: 450, hourlyRateCents: 1200, laundryRateCents: 1000, commissionBps: 2000,
  purchasesCents: 3550, otherReimbursableCents: 1250, propertyExpensesCents: 7000, allocatedPaymentsCents: 10000,
  ...overrides
});

test("nights calculation uses civil dates", () => assert.equal(nightsBetween("2026-07-01", "2026-07-08"), 7));

test("Europe/Rome DST boundaries do not create off-by-one nights", () => {
  const original = process.env.TZ;
  process.env.TZ = "Europe/Rome";
  try {
    assert.equal(nightsBetween("2026-03-27", "2026-03-30"), 3);
    assert.equal(nightsBetween("2026-10-24", "2026-10-27"), 3);
  } finally {
    process.env.TZ = original;
  }
});

test("booking calculations cover hours, laundry, commission, accrual, profit, and profit per night", () => {
  const result = calculateBooking(booking());
  assert.equal(result.hoursCostCents, 9000);
  assert.equal(result.laundryCostCents, 4000);
  assert.equal(result.reimbursableExtrasCents, 17800);
  assert.equal(result.commissionCents, 20000);
  assert.equal(result.riccardoAccruedCents, 37800);
  assert.equal(result.operatingProfitCents, 62200);
  assert.equal(result.netProfitCents, 55200);
  assert.equal(result.profitPerNightCents, 18400);
  assert.equal(result.outstandingCents, 27800);
});

test("monetary parsing and hourly rounding avoid floating point persistence", () => {
  assert.equal(centsFromDecimal("12.34"), 1234);
  assert.equal(centsFromDecimal("0.01"), 1);
  assert.equal(minutesFromHours("1.25"), 75);
  assert.equal(calculateBooking(booking({ riccardoMinutes: 1, hourlyRateCents: 100, guests: 0 })).hoursCostCents, 2);
  assert.throws(() => centsFromDecimal("12.345"));
});

test("owner-paid property expenses reduce profit and cash without increasing Riccardo payable", () => {
  const summary = calculateSummary({
    bookings: [booking({ propertyExpensesCents: 0, allocatedPaymentsCents: 0 })],
    expenses: [{ amountCents: 10000, incurredStatus: "incurred", paymentStatus: "paid", paidBy: "owner", reimbursableToRiccardo: false }],
    payments: []
  });
  assert.equal(summary.propertyExpensesCents, 10000);
  assert.equal(summary.riccardoAccruedCents, 37800);
  assert.equal(summary.operatingProfitCents, 52200);
  assert.equal(summary.cashPositionCents, 70000);
});

test("Riccardo-paid reimbursable property expense is counted once and increases payable", () => {
  const summary = calculateSummary({
    bookings: [booking({ propertyExpensesCents: 0, allocatedPaymentsCents: 0 })],
    expenses: [{ amountCents: 10000, incurredStatus: "incurred", paymentStatus: "paid", paidBy: "riccardo", reimbursableToRiccardo: true }],
    payments: []
  });
  assert.equal(summary.propertyExpensesCents, 10000);
  assert.equal(summary.riccardoAccruedCents, 47800);
  assert.equal(summary.operatingProfitCents, 52200);
  assert.equal(summary.cashPositionCents, 80000);
});

test("operating profit and cash position remain distinct after a Riccardo payment", () => {
  const base = { bookings: [booking({ propertyExpensesCents: 0, allocatedPaymentsCents: 0 })], expenses: [], payments: [] };
  const before = calculateSummary(base);
  const after = calculateSummary({ ...base, payments: [{ amountCents: 15000 }] });
  assert.equal(after.operatingProfitCents, before.operatingProfitCents);
  assert.equal(after.cashPositionCents, before.cashPositionCents - 15000);
  assert.equal(after.riccardoOutstandingCents, before.riccardoOutstandingCents - 15000);
});
