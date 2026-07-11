import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Dutch language switching preserves the equivalent guide page", async ({ page }) => {
  await page.goto("/how-to-use-tv/");
  await page.locator('[data-locale-switch="nl"]').click();
  await expect(page).toHaveURL(/\/nl\/guides\/how-to-use-tv\/$/);
  await expect(page.locator("h1")).toHaveText("De tv gebruiken");
  await expect(page.locator("body")).toHaveAttribute("data-locale", "nl");
  expect(await page.evaluate(() => localStorage.getItem("villa-laura-locale"))).toBe("nl");

  await page.locator('[data-locale-switch="en"]').click();
  await expect(page).toHaveURL(/\/how-to-use-tv\/$/);
});

test("local video thumbnails load and the guide facade starts the embed", async ({ page }) => {
  const failures = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.goto("/nl/");

  const thumbnails = page.locator(".guide-card__thumb img");
  await expect(thumbnails).toHaveCount(11);
  for (let index = 0; index < 11; index += 1) {
    const thumbnail = thumbnails.nth(index);
    await thumbnail.scrollIntoViewIfNeeded();
    await expect.poll(() => thumbnail.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  }
  expect(
    await thumbnails.evaluateAll((images) =>
      images.every(
        (image) =>
          image.complete &&
          image.naturalWidth > 0 &&
          new URL(image.currentSrc).origin === window.location.origin
      )
    )
  ).toBe(true);

  await page.locator(".guide-card__link").first().click();
  await expect(page).toHaveURL(/\/nl\/guides\/how-to-use-tv\/$/);
  const facadeImage = page.locator(".video-facade__media img");
  await expect(facadeImage).toBeVisible();
  expect(await facadeImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator(".video-facade__trigger").click();
  await expect(page.locator("iframe.video-frame__embed")).toHaveCount(1);
  expect(failures.filter((url) => url.includes("/assets/video-"))).toEqual([]);
});

test("Dutch navigation is accessible and fits mobile and desktop viewports", async ({ page }) => {
  await page.goto("/nl/");
  const navigation = page.locator("nav.nav");
  await expect(navigation).toBeVisible();
  await expect(navigation.locator(".nav__recycling")).toHaveAttribute("href", "../nl/recycling/");
  await expect(navigation.locator(".nav__recycling")).toContainText("Afvalkalender");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))
  ).toEqual([]);
});
