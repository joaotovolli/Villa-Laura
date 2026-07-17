import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixedInstant = Date.parse("2026-07-10T10:00:00Z");

const fixCurrentDate = async (page) => {
  await page.addInitScript((timestamp) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length === 0 ? [timestamp] : args));
      }

      static now() {
        return timestamp;
      }
    }
    window.Date = FixedDate;
  }, fixedInstant);
};

test.beforeEach(async ({ page }) => {
  await fixCurrentDate(page);
});

test("shows Rome's current 14-day household schedule and preserves the selected week across languages", async ({ page }) => {
  await page.goto("/recycling/");

  const days = page.locator("[data-calendar-list] > [data-calendar-date]");
  await expect(days).toHaveCount(14);
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-07-10");
  await expect(days.first()).toHaveAttribute("aria-current", "date");
  await expect(days.first()).toContainText("Paper");
  await expect(days.first()).toContainText("Organic");
  await expect(days.first().locator(".collection-day__put-out")).toContainText("Thursday evening");
  await expect(days.nth(1)).toHaveAttribute("data-calendar-date", "2026-07-11");
  await expect(days.nth(1)).toContainText("No household collection");
  await expect(days.nth(1).locator(".collection-day__put-out")).toHaveCount(0);
  await expect(page.locator("[data-next-collection]")).toContainText("Friday 10 July 2026");
  await expect(page.locator("[data-next-collection-instruction]")).toContainText(
    "Thursday 9 July 2026"
  );
  await expect(page.locator("[data-next-collection-instruction]")).toContainText("from 5:00 AM");
  await expect(page.locator(".recycling-hero__notice")).toContainText(
    "Place waste outside the evening before. Collection starts from 5:00 AM."
  );

  await page.locator("[data-calendar-next]").focus();
  await page.keyboard.press("Enter");
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-07-17");
  await expect(page).toHaveURL(/start=2026-07-17/);

  await page.locator('[data-recycling-locale-switch="it"]').click();
  await expect(page).toHaveURL(/\/it\/recycling\/\?start=2026-07-17/);
  await expect(page.locator("body")).toHaveAttribute("data-locale", "it");
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-07-17");
  await expect(page.locator("[data-calendar-previous]")).toContainText("Settimana precedente");
  await expect(page.locator(".recycling-hero__notice")).toContainText("La raccolta inizia dalle 5:00");

  await page.locator("[data-calendar-today]").click();
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-07-10");
  await expect(page).not.toHaveURL(/start=/);
});

test("shows an honest unavailable state in 2027 and can return to the official period", async ({ page }) => {
  await page.goto("/recycling/?start=2027-01-01");

  const days = page.locator("[data-calendar-list] > [data-calendar-date]");
  await expect(days).toHaveCount(14);
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2027-01-01");
  await expect(page.locator('[data-calendar-status="unavailable"]')).toHaveCount(14);
  await expect(page.locator("[data-coverage-message]")).toBeVisible();
  await expect(page.locator("[data-coverage-text]")).toContainText("never repeated automatically");

  await page.locator("[data-calendar-available]").click();
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-12-18");
  await page.locator("[data-calendar-today]").click();
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-07-10");

  await page.goto("/recycling/?start=2025-12-01");
  await page.locator("[data-calendar-available]").click();
  await expect(days.first()).toHaveAttribute("data-calendar-date", "2026-01-01");
});

test("keeps Dutch as both the site and recycling preference", async ({ page }) => {
  await page.goto("/recycling/");
  await page.locator('[data-recycling-locale-switch="nl"]').click();
  await expect(page).toHaveURL(/\/nl\/recycling\//);
  const preferences = await page.evaluate(() => ({
    site: window.localStorage.getItem("villa-laura-locale"),
    recycling: window.localStorage.getItem("villa-laura-recycling-locale")
  }));
  expect(preferences).toEqual({ site: "nl", recycling: "nl" });
});

test("fits the viewport and has no serious or critical automated accessibility findings", async ({ page }) => {
  await page.goto("/de/recycling/");
  await expect(page.locator("h1")).toContainText("Abfallsammlung");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousFindings = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact)
  );
  expect(seriousFindings).toEqual([]);
});

test("keeps a complete usable schedule when JavaScript is disabled", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 360, height: 800 }
  });
  const page = await context.newPage();
  await page.goto("/it/recycling/");

  await expect(page.locator("[data-calendar-list] > [data-calendar-date]")).toHaveCount(14);
  await expect(page.locator("[data-full-schedule-date]")).toHaveCount(157);
  await expect(page.locator(".no-script-note")).toBeVisible();
  await expect(page.locator(".recycling-guide")).toHaveCount(5);
  expect(
    await page.locator("button.calendar-control").evaluateAll((buttons) =>
      buttons.every((button) => button.disabled)
    )
  ).toBe(true);
  await context.close();
});

test("serves the official documents as real PDFs", async ({ request }) => {
  const response = await request.get("/recycling/2026/calendario-rifiuti-zona-b-2026-it.pdf");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).subarray(0, 4).toString("ascii")).toBe("%PDF");
});
