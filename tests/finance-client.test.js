import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("built admin includes protected finance navigation and responsive application assets", async () => {
  const admin = await readFile("dist/assets/admin.js", "utf8");
  const finance = await readFile("dist/assets/finance.js", "utf8");
  const financeHtml = await readFile("dist/admin/finances/index.html", "utf8");
  const financeCss = await readFile("dist/assets/finance.css", "utf8");
  assert.match(admin, /\/admin\/finances\//);
  assert.match(financeHtml, /Villa Laura operational finance management/);
  assert.match(financeHtml, /noindex,nofollow,noarchive/);
  assert.match(finance, /Booking Revenue/);
  assert.match(finance, /Riccardo Outstanding/);
  assert.match(finance, /Cash Net Position/);
  assert.match(finance, /Operating profit/);
  assert.match(finance, /Create manual booking/);
  assert.match(finance, /General property expenses/);
  assert.match(finance, /Record payment once/);
  assert.match(finance, /Keep unallocated/);
  assert.match(finance, /Export CSV/);
  assert.match(finance, /FINANCE_COLLABORATOR_EMAILS/);
  assert.match(financeCss, /@media \(max-width: 640px\)/);
  assert.equal(finance.includes(`@hot${"mail.com"}`), false);
  assert.equal(finance.includes("AIRBNB_ICAL_URL"), false);
});
