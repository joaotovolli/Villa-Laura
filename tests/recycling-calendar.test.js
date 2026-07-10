import assert from "node:assert/strict";
import test from "node:test";
import { zoneBHouseholdCalendar2026 as calendar } from "../src/recycling/calendar-2026.js";
import {
  addIsoDays,
  dateInTimeZone,
  findNextHouseholdCollection,
  getDateWindow,
  getExceptionsForDate,
  getNavigationState,
  isValidIsoDate,
  navigationTarget
} from "../src/recycling/calendar-core.js";
import {
  findCalendarForDate,
  findNearestRegisteredCalendar,
  findNextRegisteredCollection,
  getRegisteredNavigationState,
  getRegisteredDateWindow,
  registeredAvailableWindowAnchor,
  registeredNavigationTarget
} from "../src/recycling/calendars.js";

test("Europe/Rome civil dates do not roll over according to UTC", () => {
  assert.equal(dateInTimeZone(new Date("2026-07-09T21:59:59Z"), "Europe/Rome"), "2026-07-09");
  assert.equal(dateInTimeZone(new Date("2026-07-09T22:00:00Z"), "Europe/Rome"), "2026-07-10");
  assert.equal(dateInTimeZone(new Date("2026-12-31T22:59:59Z"), "Europe/Rome"), "2026-12-31");
  assert.equal(dateInTimeZone(new Date("2026-12-31T23:00:00Z"), "Europe/Rome"), "2027-01-01");
});

test("the initial date window is exactly the anchor plus the following 13 days", () => {
  const days = getDateWindow(calendar, "2026-07-10", 14);
  assert.equal(days.length, 14);
  assert.equal(days[0].date, "2026-07-10");
  assert.equal(days.at(-1).date, "2026-07-23");
  assert.deepEqual(days[0].categories, ["paper", "organic"]);
  assert.equal(days[1].status, "none");
  assert.equal(days[2].status, "none");
  assert.deepEqual(days[3].categories, ["residual", "organic", "glass"]);
});

test("next collection selection uses explicit household records", () => {
  assert.deepEqual(findNextHouseholdCollection(calendar, "2026-07-10"), {
    date: "2026-07-10",
    categories: ["paper", "organic"]
  });
  assert.deepEqual(findNextHouseholdCollection(calendar, "2026-07-11"), {
    date: "2026-07-13",
    categories: ["residual", "organic", "glass"]
  });
  assert.deepEqual(findNextRegisteredCollection("2026-12-31"), null);
  assert.deepEqual(findNextRegisteredCollection("2026-05-01"), {
    date: "2026-05-02",
    categories: ["paper", "organic"],
    calendarId: calendar.id
  });
});

test("week navigation moves seven days and clamps honestly at official boundaries", () => {
  assert.equal(navigationTarget(calendar, "2026-07-10", -7), "2026-07-03");
  assert.equal(navigationTarget(calendar, "2026-07-10", 7), "2026-07-17");
  assert.equal(navigationTarget(calendar, "2026-01-03", -7), "2026-01-01");
  assert.equal(navigationTarget(calendar, "2026-12-29", 7), "2026-12-31");
  assert.equal(navigationTarget(calendar, "2027-01-01", -7), "2026-12-31");
  assert.equal(navigationTarget(calendar, "2025-12-31", 7), "2026-01-01");
  assert.deepEqual(getNavigationState(calendar, "2026-01-01"), {
    canGoBack: false,
    canGoForward: true
  });
  assert.deepEqual(getNavigationState(calendar, "2026-12-31"), {
    canGoBack: true,
    canGoForward: false
  });
  assert.equal(registeredNavigationTarget("2026-07-10", 7), "2026-07-17");
  assert.deepEqual(getRegisteredNavigationState("2027-01-01"), {
    canGoBack: true,
    canGoForward: false
  });
});

test("holiday changes are attached to both the original and adjusted dates", () => {
  assert.equal(getExceptionsForDate(calendar, "2026-04-06")[0].id, "easter-monday-adjustments");
  assert.equal(getExceptionsForDate(calendar, "2026-04-08")[0].id, "easter-monday-adjustments");
  assert.equal(getExceptionsForDate(calendar, "2026-05-01")[0].id, "labour-day-postponement");
  assert.equal(getExceptionsForDate(calendar, "2026-05-02")[0].id, "labour-day-postponement");
  assert.equal(getExceptionsForDate(calendar, "2026-12-25")[0].id, "christmas-day-postponement");
  assert.equal(getExceptionsForDate(calendar, "2026-12-26")[0].id, "christmas-day-postponement");
});

test("2027 is unavailable and the 2026 schedule is never repeated", () => {
  assert.equal(findCalendarForDate("2026-12-31"), calendar);
  assert.equal(findCalendarForDate("2027-01-01"), null);
  const transition = getRegisteredDateWindow("2026-12-31", 2);
  assert.equal(transition[0].status, "none");
  assert.equal(transition[1].date, "2027-01-01");
  assert.equal(transition[1].status, "unavailable");
  assert.equal(getRegisteredDateWindow("2027-01-01", 14).every((day) => day.status === "unavailable"), true);
});

test("dates before the first official day are unavailable without inventing earlier collections", () => {
  assert.equal(findCalendarForDate("2025-12-31"), null);
  assert.equal(findNearestRegisteredCalendar("2025-12-31"), calendar);
  assert.equal(
    getRegisteredDateWindow("2025-12-18", 14).every((day) => day.status === "unavailable"),
    true
  );
  assert.equal(navigationTarget(calendar, "2025-12-01", 7), "2026-01-01");
  assert.equal(registeredAvailableWindowAnchor("2025-12-01", 14), "2026-01-01");
  assert.equal(registeredAvailableWindowAnchor("2027-01-01", 14), "2026-12-18");
  assert.equal(registeredAvailableWindowAnchor("2026-07-10", 14), "2026-07-10");
});

test("civil-date helpers reject impossible dates and handle year transitions", () => {
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("2026-12-31"), true);
  assert.equal(addIsoDays("2026-12-31", 1), "2027-01-01");
});
