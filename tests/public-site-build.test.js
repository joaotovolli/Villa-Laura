import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const dist = path.join(root, "dist");
const locales = ["en", "it", "es", "fr", "nl", "de", "pt"];
const guideSlugs = [
  "how-to-use-tv",
  "how-to-use-oven",
  "how-to-use-kitchen-hood",
  "how-to-use-washing-machine",
  "how-to-use-dishwasher",
  "how-to-use-microwave",
  "how-to-use-cooktop",
  "how-to-use-air-conditioning",
  "how-to-use-doors-and-locks",
  "how-to-use-keys",
  "how-to-use-workstation"
];

const read = (...segments) => readFileSync(path.join(dist, ...segments), "utf8");
const homeSegments = (locale) => (locale === "en" ? [] : [locale]);
const guideSegments = (locale, slug) => {
  if (locale === "en") return [slug];
  if (locale === "nl") return [locale, "guides", slug];
  return [locale, slug];
};
const pageHtml = (segments) => read(...segments, "index.html");
const canonicalFrom = (html) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];

test("build generates complete Dutch public routes with Dutch copy", () => {
  const home = pageHtml(["nl"]);
  assert.match(home, /<html lang="nl">/);
  assert.match(home, /Alles wat gasten nodig hebben/);
  assert.match(home, /Bibliotheek met handleidingen/);
  assert.match(home, /Huisinformatie/);
  assert.match(home, /Afvalkalender/);
  assert.doesNotMatch(home, /Everything guests need|Quick actions|Open guide|Helpful notes/);

  for (const slug of guideSlugs) {
    const html = pageHtml(guideSegments("nl", slug));
    assert.match(html, /<html lang="nl">/);
    assert.match(html, /Nuttige tips/);
    assert.match(html, /Terug naar de handleidingen/);
    assert.match(html, /data-video-facade/);
    assert.doesNotMatch(html, /Helpful notes|Back to guide library|Need help with this guide/);
    assert.equal(
      canonicalFrom(html),
      `https://villa-laura.it/nl/guides/${slug}/`
    );
  }
});

test("language switching and alternate metadata preserve equivalent pages", () => {
  const englishGuide = pageHtml(["how-to-use-tv"]);
  const dutchGuide = pageHtml(["nl", "guides", "how-to-use-tv"]);
  assert.match(
    englishGuide,
    /hreflang="nl" href="https:\/\/villa-laura\.it\/nl\/guides\/how-to-use-tv\/"/
  );
  assert.match(
    dutchGuide,
    /hreflang="en" href="https:\/\/villa-laura\.it\/how-to-use-tv\/"/
  );
  assert.match(englishGuide, /data-locale-switch="nl"/);
  assert.match(dutchGuide, /data-locale-switch="en"/);

  for (const locale of locales) {
    const home = pageHtml(homeSegments(locale));
    assert.match(home, /hreflang="nl" href="https:\/\/villa-laura\.it\/nl\/"/);
    assert.equal((home.match(/data-locale-switch=/g) ?? []).length, 7);
  }
});

test("top navigation links every public locale to its recycling route", () => {
  for (const locale of locales) {
    const expectedPath = locale === "en" ? "/recycling/" : `/${locale}/recycling/`;
    for (const segments of [homeSegments(locale), guideSegments(locale, "how-to-use-tv")]) {
      const html = pageHtml(segments);
      const href = html.match(/<a class="nav__recycling" href="([^"]+)"/)?.[1];
      assert.equal(typeof href, "string");
      assert.equal(new URL(href, canonicalFrom(html)).pathname, expectedPath);
      assert.match(html, /<nav class="nav" aria-label="[^"]+">/);
    }
  }

  assert.match(pageHtml(["nl", "recycling"]), /<a class="nav__recycling" href="#calendar">/);
});

test("all video cards and guide pages use local valid thumbnail assets", () => {
  for (const slug of guideSlugs) {
    for (const extension of ["jpg", "webp"]) {
      const file = path.join(dist, "assets", `video-${slug}.${extension}`);
      assert.equal(existsSync(file), true, file);
      assert.equal(statSync(file).size > 10_000, true, file);
    }
  }

  for (const locale of locales) {
    const home = pageHtml(homeSegments(locale));
    assert.equal(home.includes("i.ytimg.com"), false);
    assert.equal((home.match(/class="guide-card__image"/g) ?? []).length, guideSlugs.length);
    for (const slug of guideSlugs) {
      assert.match(home, new RegExp(`assets/video-${slug}\\.jpg`));
      const guide = pageHtml(guideSegments(locale, slug));
      assert.match(guide, new RegExp(`assets/video-${slug}\\.jpg`));
      assert.match(guide, /class="video-facade__trigger"[^>]+aria-label="[^"]+"/);
    }
  }
});

test("icons are inline, decorative, and accompanied by accessible text", () => {
  for (const locale of locales) {
    const html = pageHtml(homeSegments(locale));
    const icons = html.match(/<svg class="icon[^"]*"[^>]*>/g) ?? [];
    assert.equal(icons.length > 20, true);
    assert.equal(icons.every((entry) => entry.includes('aria-hidden="true"')), true);
    assert.equal(icons.every((entry) => entry.includes('focusable="false"')), true);
    assert.match(html, /<a class="nav__recycling"[^>]*>[\s\S]*?<span>[^<]+<\/span><\/a>/);
  }
});

test("sitemap contains the Dutch homepage, guides, and recycling calendar", () => {
  const sitemap = read("sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/villa-laura\.it\/nl\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/villa-laura\.it\/nl\/recycling\/<\/loc>/);
  for (const slug of guideSlugs) {
    assert.match(
      sitemap,
      new RegExp(`<loc>https://villa-laura\\.it/nl/guides/${slug}/</loc>`)
    );
  }
});
