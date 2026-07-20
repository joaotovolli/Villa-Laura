import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onRequest } from "../functions/api/[[path]].js";
import { makeD1 } from "./helpers/d1.js";

const migration = await readFile("migrations/0001_finance.sql", "utf8");
const baseEnv = async () => ({
  APP_ENV: "production",
  ALLOWED_ADMIN_EMAILS: "owner@example.test",
  FINANCE_COLLABORATOR_EMAILS: "finance@example.test",
  VILLA_LAURA_FINANCE: await makeD1(migration)
});

const request = (path, env, { method = "GET", email = "", body, origin = "" } = {}) => {
  const headers = {};
  if (email) headers["cf-access-authenticated-user-email"] = email;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin) { headers.origin = origin; headers["sec-fetch-site"] = "cross-site"; }
  return onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    params: { path: path.split("?")[0].replace(/^\//, "").split("/") }
  });
};

test("finance API rejects unauthenticated users and disables public caching", async () => {
  const env = await baseEnv();
  const denied = await request("/finance/dashboard", env);
  const allowed = await request("/finance/dashboard?year=2026", env, { email: "owner@example.test" });
  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get("cache-control"), /no-store/);
});

test("owner can create finance records and audit events server-side", async () => {
  const env = await baseEnv();
  const created = await request("/finance/bookings", env, {
    method: "POST", email: "owner@example.test",
    body: { title: "Synthetic booking", source: "Manual", checkIn: "2026-08-01", checkOut: "2026-08-05", status: "active", guests: 2, revenueCents: "900.00", revenueReceivedCents: "800.00", revenueReceivedDate: "2026-08-02", riccardoHours: "2.5", purchasesDescription: "Synthetic supplies", purchasesCents: "25.00", otherReimbursableCents: "0.00", notes: "Synthetic only", manualDateOverride: false }
  });
  const body = await created.json();
  const audit = await (await request("/finance/audit", env, { email: "owner@example.test" })).json();
  assert.equal(created.status, 201);
  assert.equal(body.booking.hourlyRateCents, 1200);
  assert.equal(body.booking.riccardoMinutes, 150);
  assert.equal(audit.events.some((event) => event.action === "created" && event.entityType === "booking"), true);
});

test("Finance Collaborator can operate finance but cannot change settings or access unrelated admin APIs", async () => {
  const env = await baseEnv();
  const dashboard = await request("/finance/dashboard", env, { email: "finance@example.test" });
  const expense = await request("/finance/expenses", env, { method: "POST", email: "finance@example.test", body: { expenseDate: "2026-08-02", categoryId: "water", description: "Synthetic water cost", amountCents: "20.00", currency: "EUR", incurredStatus: "incurred", paymentStatus: "paid", paymentDate: "2026-08-02", paymentMethod: "card", paidBy: "owner", reimbursableToRiccardo: false, notes: "" } });
  const settings = await request("/finance/settings", env, { method: "PATCH", email: "finance@example.test", body: { hourlyRateCents: "14.00", laundryRateCents: "10.00", commissionBps: 2000, currency: "EUR", reportingMonth: 1 } });
  const unrelated = await request("/admin/reservations", env, { email: "finance@example.test" });
  assert.equal(dashboard.status, 200);
  assert.equal(expense.status, 201);
  assert.equal(settings.status, 403);
  assert.equal(unrelated.status, 403);
});

test("finance mutations reject cross-origin and invalid financial input", async () => {
  const env = await baseEnv();
  const crossOrigin = await request("/finance/bookings", env, { method: "POST", email: "owner@example.test", origin: "https://malicious.example", body: {} });
  const badMoney = await request("/finance/bookings", env, { method: "POST", email: "owner@example.test", body: { title: "Synthetic", source: "Manual", checkIn: "2026-01-01", checkOut: "2026-01-02", status: "active", guests: 1, revenueCents: "1.001", revenueReceivedCents: "0.00", riccardoHours: "0", purchasesCents: "0", otherReimbursableCents: "0", notes: "" } });
  assert.equal(crossOrigin.status, 403);
  assert.equal(badMoney.status, 400);
});

