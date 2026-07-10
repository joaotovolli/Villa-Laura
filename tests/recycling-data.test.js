import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  COMMERCIAL_ONLY_COLLECTION_COUNT_2026,
  HOUSEHOLD_COLLECTION_COUNT_2026,
  zoneBHouseholdCalendar2026 as calendar
} from "../src/recycling/calendar-2026.js";
import {
  createCalendarIndex,
  eachIsoDate,
  getCalendarDay,
  RECYCLING_LOCALES,
  validateCalendarData,
  validateRecyclingTranslations
} from "../src/recycling/calendar-core.js";
import { recyclingTranslations } from "../src/recycling/i18n.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const index = createCalendarIndex(calendar);
const day = (date) => getCalendarDay(calendar, date, index);

test("official Zone B household data covers every day of 2026 without repeating a pattern", () => {
  assert.equal(calendar.zone.id, "B");
  assert.deepEqual(calendar.zone.municipalities, ["Tresnuraghes", "Sagama", "Montresta"]);
  assert.equal(calendar.audience, "household");
  assert.equal(calendar.timeZone, "Europe/Rome");
  assert.equal(calendar.validFrom, "2026-01-01");
  assert.equal(calendar.validTo, "2026-12-31");
  assert.equal(eachIsoDate(calendar.validFrom, calendar.validTo).length, 365);
  assert.equal(HOUSEHOLD_COLLECTION_COUNT_2026, 157);
  assert.equal(365 - HOUSEHOLD_COLLECTION_COUNT_2026, 208);
  assert.equal(validateCalendarData(calendar).length, 0);

  const canonicalEvents = calendar.records
    .filter((record) => record.household.length > 0)
    .map((record) => `${record.date}|${record.household.join(",")}`)
    .join("\n");
  assert.equal(
    createHash("sha256").update(canonicalEvents).digest("hex"),
    "4bf4bbd4cd95a9109f25ab02e2e13a4bd5134dd1fd48fa8d7af395ae2ac2316b"
  );
});

test("category totals and authoritative dates match the official Italian calendar", () => {
  const totals = Object.fromEntries(calendar.categoryIds.map((category) => [category, 0]));
  for (const record of calendar.records) {
    for (const category of record.household) totals[category] += 1;
  }
  assert.deepEqual(totals, {
    paper: 52,
    glass: 52,
    plastic: 52,
    organic: 156,
    residual: 26
  });

  assert.deepEqual(day("2026-01-02").categories, ["paper", "organic"]);
  assert.deepEqual(day("2026-04-07").categories, ["organic"]);
  assert.deepEqual(day("2026-04-08").categories, ["residual", "glass"]);
  assert.deepEqual(day("2026-04-09").categories, ["plastic", "organic"]);
  assert.equal(day("2026-04-06").status, "none");
  assert.deepEqual(day("2026-05-02").categories, ["paper", "organic"]);
  assert.deepEqual(day("2026-07-13").categories, ["residual", "organic", "glass"]);
  assert.deepEqual(day("2026-10-02").categories, ["paper", "organic"]);
  assert.deepEqual(day("2026-11-02").categories, ["residual", "organic", "glass"]);
  assert.equal(day("2026-12-25").status, "none");
  assert.deepEqual(day("2026-12-26").categories, ["paper", "organic"]);
  assert.equal(day("2026-12-31").status, "none");
  assert.equal(day("2027-01-01").status, "unavailable");
  assert.deepEqual(calendar.exceptions, [
    {
      id: "easter-monday-adjustments",
      date: "2026-04-06",
      type: "holiday-schedule-change",
      noteId: "easter-holiday-change",
      affectedDates: ["2026-04-07", "2026-04-08", "2026-04-09"]
    },
    {
      id: "labour-day-postponement",
      date: "2026-05-01",
      type: "holiday-postponement",
      noteId: "holiday-postponement",
      postponedTo: "2026-05-02",
      categories: ["paper", "organic"]
    },
    {
      id: "christmas-day-postponement",
      date: "2026-12-25",
      type: "holiday-postponement",
      noteId: "holiday-postponement",
      postponedTo: "2026-12-26",
      categories: ["paper", "organic"]
    }
  ]);
});

test("all explicitly commercial-only organic collections stay out of the household schedule", () => {
  const commercialRecords = calendar.records.filter((record) => record.commercialOnly.length > 0);
  assert.equal(COMMERCIAL_ONLY_COLLECTION_COUNT_2026, 39);
  assert.equal(commercialRecords.length, 39);
  assert.equal(commercialRecords.every((record) => record.household.length === 0), true);
  assert.equal(commercialRecords.every((record) => record.commercialOnly.join() === "organic"), true);
  assert.deepEqual(calendar.commercialScope.monthsWithPrintedCommercialRows, [6, 7, 8]);
  assert.deepEqual(calendar.commercialScope.explicitCoastalRestriction, {
    months: [7, 8],
    areas: ["Porto Alabe", "Marina di Magomadas"]
  });
  assert.equal(
    createHash("sha256")
      .update(commercialRecords.map((record) => `${record.date}|${record.commercialOnly.join(",")}`).join("\n"))
      .digest("hex"),
    "fc563bb0317a4a04bf53a60db92e814f246a5f780924f0d2aa02d18bf37278f9"
  );
  assert.deepEqual(day("2026-06-02"), {
    date: "2026-06-02",
    status: "none",
    categories: [],
    noteIds: ["commercial-summer-extra"],
    commercialOnly: ["organic"]
  });
  assert.equal(day("2026-07-01").status, "none");
  assert.equal(day("2026-08-15").status, "none");
});

test("calendar validation detects duplicates, invalid dates, unknown categories and out-of-year data", () => {
  const duplicate = clone(calendar);
  duplicate.records.splice(1, 0, clone(duplicate.records[0]));
  assert.equal(validateCalendarData(duplicate).some((error) => error.includes("Duplicate record date")), true);

  const invalidDate = clone(calendar);
  invalidDate.records[0].date = "2026-02-30";
  assert.equal(validateCalendarData(invalidDate).some((error) => error.includes("Invalid record date")), true);

  const outsideYear = clone(calendar);
  outsideYear.records.at(-1).date = "2027-01-01";
  assert.equal(validateCalendarData(outsideYear).some((error) => error.includes("outside 2026")), true);

  const unknownCategory = clone(calendar);
  unknownCategory.records[0].household.push("mixed");
  assert.equal(validateCalendarData(unknownCategory).some((error) => error.includes("unknown category")), true);

  const duplicateCategory = clone(calendar);
  duplicateCategory.records[0].household.push("paper");
  assert.equal(validateCalendarData(duplicateCategory).some((error) => error.includes("duplicate household")), true);

  const duplicateException = clone(calendar);
  duplicateException.exceptions.push(clone(duplicateException.exceptions[0]));
  assert.equal(validateCalendarData(duplicateException).some((error) => error.includes("exception ID")), true);

  const exceptionCategoryDrift = clone(calendar);
  exceptionCategoryDrift.exceptions[1].categories = ["glass"];
  assert.equal(
    validateCalendarData(exceptionCategoryDrift).some((error) => error.includes("categories do not match")),
    true
  );

  const missingExceptionNote = clone(calendar);
  missingExceptionNote.records.find((record) => record.date === "2026-04-08").noteIds = [];
  assert.equal(
    validateCalendarData(missingExceptionNote).some((error) => error.includes("note is missing from target")),
    true
  );
});

test("all seven languages completely translate categories, guidance and data notes", () => {
  assert.deepEqual(Object.keys(recyclingTranslations), RECYCLING_LOCALES);
  assert.deepEqual(validateRecyclingTranslations(calendar, recyclingTranslations), []);

  for (const locale of RECYCLING_LOCALES) {
    assert.deepEqual(Object.keys(recyclingTranslations[locale].categories), calendar.categoryIds);
    assert.equal(calendar.source.documents[locale].path.endsWith(".pdf"), true);
  }

  assert.equal(calendar.source.documents.it.authoritative, true);
  assert.equal(calendar.source.documents.it.validFrom, "2026-01-01");
  assert.equal(calendar.source.documents.en.validFrom, "2026-07-01");

  const incomplete = clone(recyclingTranslations);
  incomplete.de.categories.glass.name = "";
  assert.equal(
    validateRecyclingTranslations(calendar, incomplete).includes("de is missing category glass"),
    true
  );

  const missingIntlLocale = clone(recyclingTranslations);
  delete missingIntlLocale.de.intlLocale;
  assert.equal(
    validateRecyclingTranslations(calendar, missingIntlLocale).some((error) =>
      error.includes("de is missing intlLocale")
    ),
    true
  );

  const missingShortName = clone(recyclingTranslations);
  delete missingShortName.fr.categories.organic.shortName;
  assert.equal(
    validateRecyclingTranslations(calendar, missingShortName).includes(
      "fr is missing short category organic"
    ),
    true
  );
});
