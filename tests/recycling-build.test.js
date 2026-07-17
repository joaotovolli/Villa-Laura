import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { zoneBHouseholdCalendar2026 as calendar } from "../src/recycling/calendar-2026.js";
import { addIsoDays, RECYCLING_LOCALES } from "../src/recycling/calendar-core.js";
import { getRegisteredDateWindow } from "../src/recycling/calendars.js";
import { recyclingTranslations } from "../src/recycling/i18n.js";
import {
  escapeHtml,
  formatCalendarDate,
  formatWeekday,
  formatMonth,
  localizeRecyclingTranslation,
  previousEveningDate,
  renderCalendarDay
} from "../src/recycling/render.js";

const root = process.cwd();
const dist = path.join(root, "dist");
const routeSegments = (locale) => (locale === "en" ? ["recycling"] : [locale, "recycling"]);
const routeFile = (locale) => path.join(dist, ...routeSegments(locale), "index.html");
const read = (file) => readFileSync(file, "utf8");
const expectedPdfHashes = {
  it: "2f686753683b94429e7267342983710e6b5f5a50edc931a92d48c8fead3f9758",
  en: "cfc2a42889527664126b598d0014eb6c183ddd11c37b37353c8addb877e8be8f",
  es: "ebba879ccc451f19c4bf4017715972d62d9e76d06da987f2852f8aa1f49d0c95",
  fr: "004faff26e6cbd2c69eb089a53510518cb50ed5f58430ff82fa671aa3680f030",
  nl: "45a151410cf77ec43f35691d41ac6010903892704a3c0171acc3d707bbcd6676",
  de: "baed6321b746062d2f9072692df81d0e916b3a2d8ef9dd31ccc6b4c5595b7721",
  pt: "e93db3aace55e8a1fdad05c844d052ffd661b0f0e3571b6e098740d59b75ef11"
};

const parseRenderedDays = (html) => {
  const list = html.match(/<ol class="collection-days"[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? "";
  return [...list.matchAll(/<li class="collection-day[^>]*data-calendar-date="([^"]+)" data-calendar-status="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map(
    (match) => ({
      date: match[1],
      status: match[2],
      categories: [...match[3].matchAll(/data-category="([^"]+)"/g)].map((entry) => entry[1])
    })
  );
};

test("build emits complete, canonical recycling pages in all seven languages", () => {
  for (const locale of RECYCLING_LOCALES) {
    const translation = localizeRecyclingTranslation(
      recyclingTranslations[locale],
      calendar,
      locale
    );
    const html = read(routeFile(locale));
    const canonicalPath = locale === "en" ? "/recycling/" : `/${locale}/recycling/`;

    assert.match(html, new RegExp(`<html lang="${locale}">`));
    assert.equal(html.includes(`<title>${translation.meta.title}</title>`), true);
    assert.equal(html.includes(`data-recycling-app data-locale="${locale}"`), true);
    assert.equal(html.includes(`rel="canonical" href="https://villa-laura.it${canonicalPath}"`), true);
    assert.equal(html.includes('hreflang="x-default" href="https://villa-laura.it/recycling/"'), true);
    assert.equal((html.match(/data-recycling-locale-switch=/g) ?? []).length, 7);
    assert.equal(html.includes('aria-current="page"'), true);
    assert.equal(html.includes(translation.calendar.previousWeek), true);
    assert.equal(html.includes(translation.calendar.noCollection), true);
    assert.equal(html.includes(translation.page.collectionTimeNotice), true);
    assert.equal(html.includes(`aria-label="${escapeHtml(translation.page.collectionTimeLabel)}"`), true);
    assert.equal(html.includes("data-next-collection-instruction"), true);
    assert.equal(html.includes(translation.guide.title), true);
    assert.equal(html.includes("recycling-hero__facts"), false);
    assert.equal(html.includes("recycling-fact"), false);
    const calendarHeading = html.match(
      /<div class="calendar-panel__heading">([\s\S]*?)<\/div>\s*<div class="calendar-controls"/
    )?.[1] ?? "";
    assert.equal(calendarHeading.includes("<p>"), false);
    assert.equal(
      html.includes(escapeHtml(formatCalendarDate("2026-07-10", translation, { weekday: true }))),
      true
    );
    assert.equal(html.includes(escapeHtml(formatMonth("2026-07", translation))), true);
    for (const category of calendar.categoryIds) {
      assert.equal(html.includes(escapeHtml(translation.categories[category].name)), true);
    }
    assert.equal(html.includes("undefined"), false);
    assert.equal(html.includes("[object Object]"), false);
    assert.equal(/\{(?:year|validStart|validEnd|translatedStart|translatedEnd)\}/.test(html), false);
    assert.equal(html.includes("<noscript>"), true);
    assert.equal((html.match(/data-full-schedule-date=/g) ?? []).length, 157);
    assert.equal(html.includes('meta name="robots" content="noindex'), false);
  }
});

test("collection reminders are localized and only render for household collection days", () => {
  for (const locale of RECYCLING_LOCALES) {
    const translation = localizeRecyclingTranslation(recyclingTranslations[locale], calendar, locale);
    const collectionDate = "2026-07-13";
    const collectionHtml = renderCalendarDay(
      { date: collectionDate, status: "collection", categories: ["organic"], noteIds: [] },
      { calendar, translation, today: "2026-07-10", nextCollectionDate: collectionDate }
    );
    const expected = translation.calendar.putOutInstruction.replace(
      "{previousWeekday}",
      formatWeekday(previousEveningDate(collectionDate), translation)
    );
    assert.equal(collectionHtml.includes(escapeHtml(expected)), true);

    const emptyHtml = renderCalendarDay(
      { date: "2026-07-12", status: "none", categories: [], noteIds: [] },
      { calendar, translation, today: "2026-07-10", nextCollectionDate: collectionDate }
    );
    assert.equal(emptyHtml.includes("collection-day__put-out"), false);

    if (locale !== "en") {
      assert.equal(read(routeFile(locale)).includes(recyclingTranslations.en.page.collectionTimeNotice), false);
      assert.equal(read(routeFile(locale)).includes(recyclingTranslations.en.calendar.putOutInstruction.split("{")[0]), false);
    }
  }
});

test("pre-rendered 14-day output exactly matches the shared structured household data", () => {
  const html = read(routeFile("en"));
  const rendered = parseRenderedDays(html);
  assert.equal(rendered.length, 14);

  const expected = getRegisteredDateWindow(rendered[0].date, 14).map((day) => ({
    date: day.date,
    status: day.status,
    categories: day.categories
  }));
  assert.deepEqual(rendered, expected);
  assert.equal(rendered.at(-1).date, addIsoDays(rendered[0].date, 13));
});

test("commercial-only dates are absent from the complete household fallback", () => {
  const html = read(routeFile("it"));
  for (const record of calendar.records.filter((entry) => entry.commercialOnly.length > 0)) {
    assert.equal(html.includes(`data-full-schedule-date="${record.date}"`), false);
  }
  assert.equal(html.includes('data-full-schedule-date="2026-04-07"'), true);
  assert.equal(html.includes('data-full-schedule-date="2026-04-08"'), true);
  assert.equal(html.includes('data-full-schedule-date="2026-12-26"'), true);
});

test("homepage links expose the calendar on mobile-visible quick actions", () => {
  assert.equal(read(path.join(dist, "index.html")).includes('support-card--recycling support-card--guides" href="./recycling/"'), true);
  for (const locale of ["it", "es", "fr", "de", "pt"]) {
    const html = read(path.join(dist, locale, "index.html"));
    assert.equal(html.includes(`support-card--recycling support-card--guides" href="../${locale}/recycling/"`), true);
  }
});

test("published PDF references exist, retain PDF signatures and use the documented coverage", () => {
  for (const locale of RECYCLING_LOCALES) {
    const document = calendar.source.documents[locale];
    const file = path.join(dist, document.path.slice(1));
    const buffer = readFileSync(file);
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "%PDF");
    assert.equal(statSync(file).size > 500_000, true);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), expectedPdfHashes[locale]);
    assert.equal(read(routeFile(locale)).includes(document.path.split("/").at(-1)), true);
  }
  assert.equal(calendar.source.documents.it.validFrom, "2026-01-01");
  assert.equal(calendar.source.documents.en.validFrom, "2026-07-01");
});

test("sitemap indexes public pages and does not index protected or token-gated routes", () => {
  const sitemap = read(path.join(dist, "sitemap.xml"));
  for (const locale of RECYCLING_LOCALES) {
    const route = locale === "en" ? "/recycling/" : `/${locale}/recycling/`;
    assert.equal(sitemap.includes(`<loc>https://villa-laura.it${route}</loc>`), true);
  }
  assert.equal(sitemap.includes("/admin/"), false);
  assert.equal(sitemap.includes("/checkin/"), false);
  assert.equal(read(path.join(dist, "robots.txt")).includes("https://villa-laura.it/sitemap.xml"), true);
});
