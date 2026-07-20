import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const booking = {
  id: "synthetic-booking", externalUid: "", source: "Manual", title: "Synthetic Stay", bookingReference: "TEST-001",
  checkIn: "2026-08-01", checkOut: "2026-08-05", status: "active", origin: "manual", guests: 2,
  revenueCents: 100000, revenueReceivedCents: 80000, revenueReceivedDate: "2026-08-02", riccardoMinutes: 120,
  hourlyRateCents: 1200, laundryRateCents: 1000, commissionBps: 2000, purchasesDescription: "Synthetic supplies",
  purchasesCents: 2000, otherReimbursableCents: 0, notes: "Synthetic fixture", manualDateOverride: false, needsReview: false,
  createdAt: "2026-07-01T10:00:00.000Z", createdBy: "owner@example.test", updatedAt: "2026-07-01T10:00:00.000Z",
  updatedBy: "owner@example.test", version: 1, propertyExpensesCents: 5000, allocatedPaymentsCents: 10000,
  calculations: { nights: 4, hoursCostCents: 2400, laundryCostCents: 2000, reimbursableExtrasCents: 6400, commissionCents: 20000, riccardoAccruedCents: 26400, allocatedPaymentsCents: 10000, outstandingCents: 16400, operatingProfitCents: 73600, netProfitCents: 68600, profitPerNightCents: 17150 }
};

const summary = { revenueCents: 100000, revenueReceivedCents: 80000, riccardoAccruedCents: 26400, riccardoPaidCents: 10000, riccardoOutstandingCents: 16400, propertyExpensesCents: 5000, operatingProfitCents: 68600, cashPositionCents: 70000, profitMarginBps: 6860, occupiedNights: 4 };
const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, ...summary, ...(index === 7 ? {} : { revenueCents: 0, revenueReceivedCents: 0, riccardoAccruedCents: 0, riccardoPaidCents: 0, riccardoOutstandingCents: 0, propertyExpensesCents: 0, operatingProfitCents: 0, cashPositionCents: 0, profitMarginBps: null, occupiedNights: 0 }) }));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/finance/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/session") ? { authenticated: true, role: "owner", canManageSettings: true }
      : pathname.endsWith("/dashboard") ? { summary, monthly: months, lastSync: { status: "completed", completedAt: "2026-07-01T10:00:00.000Z" } }
      : pathname.endsWith("/bookings") ? { bookings: [booking] }
      : pathname.endsWith("/expenses") ? { expenses: [] }
      : pathname.endsWith("/payments") ? { payments: [] }
      : pathname.endsWith("/categories") ? { categories: [{ id: "other", name: "Other", active: true, sortOrder: 999 }] }
      : pathname.endsWith("/settings") ? { settings: { hourlyRateCents: 1200, laundryRateCents: 1000, commissionBps: 2000, currency: "EUR", reportingMonth: 1 }, readOnly: false }
      : pathname.endsWith("/audit") ? { events: [] }
      : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
});

test("finance dashboard renders and stays responsive", async ({ page }) => {
  await page.goto("/admin/finances/");
  await expect(page.getByRole("heading", { name: "Finance overview" })).toBeVisible();
  await expect(page.getByText("Booking Revenue", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic Stay", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Riccardo payment ledger" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.locator(".finance-chart")).toHaveAttribute("tabindex", "0");
  await expect(page.locator("#reports .finance-table-wrap")).toHaveAttribute("tabindex", "0");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
});
