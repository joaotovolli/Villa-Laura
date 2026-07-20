import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSpreadsheetRecords, spreadsheetSqlValue } from "../src/finance/spreadsheet.js";

const record = (overrides = {}) => ({ importKey: "spreadsheet:synthetic", rowNumber: 5, checkIn: "2025-06-01", checkOut: "2025-06-04", guests: 2, revenueCents: 50000, riccardoMinutes: 120, hourlyRateCents: 1200, laundryRateCents: 1000, commissionBps: 2000, purchasesCents: 0, ...overrides });

test("spreadsheet SQL preserves empty non-null text and escapes quotes", () => {
  assert.equal(spreadsheetSqlValue(""), "''");
  assert.equal(spreadsheetSqlValue("owner's purchase"), "'owner''s purchase'");
  assert.equal(spreadsheetSqlValue(null), "NULL");
});

test("spreadsheet dry-run reports a new record without exposing record contents", () => {
  const result = reconcileSpreadsheetRecords([record()], []);
  assert.equal(result.creates.length, 1);
  assert.equal(result.updates.length, 0);
  assert.equal(result.ambiguous.length, 0);
});

test("spreadsheet reconciliation matches one existing booking by dates", () => {
  const result = reconcileSpreadsheetRecords([record()], [{ id: "booking-1", external_uid: "ical-synthetic", check_in: "2025-06-01", check_out: "2025-06-04" }]);
  assert.equal(result.updates[0].id, "booking-1");
  assert.equal(result.updates[0].reason, "dates");
});

test("repeated spreadsheet import is ignored without duplication", () => {
  const input = record();
  const existing = [{ id: "booking-1", external_uid: input.importKey, check_in: input.checkIn, check_out: input.checkOut, guests: input.guests, revenue_cents: input.revenueCents, riccardo_minutes: input.riccardoMinutes, hourly_rate_cents: input.hourlyRateCents, laundry_rate_cents: input.laundryRateCents, commission_bps: input.commissionBps, purchases_cents: input.purchasesCents }];
  const result = reconcileSpreadsheetRecords([input], existing);
  assert.equal(result.ignored.length, 1);
  assert.equal(result.creates.length, 0);
  assert.equal(result.updates.length, 0);
});

test("ambiguous spreadsheet date matches are never overwritten", () => {
  const existing = [{ id: "one", check_in: "2025-06-01", check_out: "2025-06-04" }, { id: "two", check_in: "2025-06-01", check_out: "2025-06-04" }];
  const result = reconcileSpreadsheetRecords([record()], existing);
  assert.equal(result.ambiguous.length, 1);
  assert.equal(result.creates.length, 0);
  assert.equal(result.updates.length, 0);
});
