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
const expense = { id: "synthetic-expense", expenseDate: "2026-08-02", categoryId: "other", categoryName: "Other", description: "Synthetic utility cost", supplier: "Synthetic supplier", amountCents: 5000, currency: "EUR", incurredStatus: "incurred", paymentStatus: "paid", paymentDate: "2026-08-02", paymentMethod: "card", paidBy: "owner", bookingId: "", reimbursableToRiccardo: false, notes: "", allocatedPaymentsCents: 0, voidedAt: "", createdAt: "2026-07-01T10:00:00.000Z", createdBy: "owner@example.test", updatedAt: "2026-07-01T10:00:00.000Z", updatedBy: "owner@example.test", version: 1, attachmentCount: 1, hasEvidence: true };
const payment = { id: "synthetic-payment", paymentDate: "2026-08-03", amountCents: 10000, paymentMethod: "transfer", reference: "Synthetic reference", notes: "", allocatedCents: 10000, unallocatedCents: 0, createdAt: "2026-07-01T10:00:00.000Z", createdBy: "owner@example.test", attachmentCount: 1, hasEvidence: true };
const attachment = { id: "synthetic-attachment", parentType: "expense", parentId: expense.id, filename: "synthetic-receipt.pdf", mimeType: "application/pdf", extension: "pdf", sizeBytes: 128, checksum: "a".repeat(64), description: "Synthetic evidence", status: "active", uploadedBy: "owner@example.test", uploadedAt: "2026-07-01T10:00:00.000Z", updatedAt: "2026-07-01T10:00:00.000Z" };

test.beforeEach(async ({ page }) => {
  await page.route("**/api/finance/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/session") ? { authenticated: true, role: "owner", canManageSettings: true }
      : pathname.endsWith("/dashboard") ? { summary, monthly: months, lastSync: { status: "completed", completedAt: "2026-07-01T10:00:00.000Z" } }
      : pathname.endsWith("/bookings") ? { bookings: [booking] }
      : pathname.endsWith("/expenses") ? { expenses: [expense] }
      : pathname.endsWith("/payments") ? { payments: [payment] }
      : pathname.endsWith("/attachments") ? { attachments: [{ ...attachment, parentType: pathname.includes("/payments/") ? "payment" : "expense", parentId: pathname.includes("/payments/") ? payment.id : expense.id }] }
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

test("expense and payment evidence controls are accessible on mobile and desktop", async ({ page }) => {
  await page.goto("/admin/finances/");
  const expenseRecord = page.locator(".finance-record").filter({ hasText: "Synthetic utility cost" });
  await expenseRecord.locator("summary").click();
  await expect(expenseRecord.getByRole("heading", { name: /Receipts and evidence/ })).toBeVisible();
  await expenseRecord.getByRole("button", { name: "Load attachments" }).click();
  await expect(expenseRecord.getByText("synthetic-receipt.pdf")).toBeVisible();
  const preview = expenseRecord.getByRole("link", { name: "Preview or open" });
  await expect(preview).toHaveAttribute("href", /parentType=expense/);
  await expect(preview).not.toHaveAttribute("href", /finance\/evidence/);
  const input = expenseRecord.locator("input[type=file]");
  await input.setInputFiles({ name: "new-synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });
  await expect(expenseRecord.getByText(/new-synthetic\.pdf/)).toBeVisible();
  await expenseRecord.getByRole("button", { name: "Remove new-synthetic.pdf" }).click();
  await expect(input).toHaveValue("");
  const paymentRow = page.locator("#payments tbody tr").filter({ hasText: "Synthetic reference" });
  await paymentRow.locator("summary").click();
  await expect(paymentRow.getByRole("heading", { name: /Receipts and evidence/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
