import { zoneBHouseholdCalendar2026 } from "./calendar-2026.js";
import {
  addIsoDays,
  createCalendarIndex,
  findNextHouseholdCollection,
  getCalendarDay,
  isValidIsoDate
} from "./calendar-core.js";

// Add each new official calendar here after its source has been transcribed and
// validated. The page and navigation consume this registry without repeating a
// previous year's pattern.
export const recyclingCalendars = Object.freeze([zoneBHouseholdCalendar2026]);

export const findCalendarForDate = (isoDate) =>
  recyclingCalendars.find(
    (calendar) => isoDate >= calendar.validFrom && isoDate <= calendar.validTo
  ) ?? null;

export const findNearestRegisteredCalendar = (isoDate) => {
  const exact = findCalendarForDate(isoDate);
  if (exact) return exact;
  if (isoDate < recyclingCalendars[0].validFrom) return recyclingCalendars[0];
  if (isoDate > recyclingCalendars.at(-1).validTo) return recyclingCalendars.at(-1);

  const nextIndex = recyclingCalendars.findIndex((calendar) => calendar.validFrom > isoDate);
  if (nextIndex <= 0) return recyclingCalendars[0];
  const previous = recyclingCalendars[nextIndex - 1];
  const next = recyclingCalendars[nextIndex];
  const targetTime = Date.parse(`${isoDate}T00:00:00Z`);
  const previousDistance = targetTime - Date.parse(`${previous.validTo}T00:00:00Z`);
  const nextDistance = Date.parse(`${next.validFrom}T00:00:00Z`) - targetTime;
  return previousDistance <= nextDistance ? previous : next;
};

export const getRegisteredCalendarDay = (isoDate) => {
  const calendar = findCalendarForDate(isoDate);
  if (!calendar) {
    return { date: isoDate, status: "unavailable", categories: [], noteIds: [], commercialOnly: [] };
  }
  return getCalendarDay(calendar, isoDate, createCalendarIndex(calendar));
};

export const getRegisteredDateWindow = (anchor, length = 14) => {
  if (!isValidIsoDate(anchor)) throw new TypeError(`Invalid window anchor: ${anchor}`);
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Window length must be positive");
  return Array.from({ length }, (_, offset) => getRegisteredCalendarDay(addIsoDays(anchor, offset)));
};

export const findNextRegisteredCollection = (fromDate) => {
  if (!isValidIsoDate(fromDate)) return null;
  for (const calendar of recyclingCalendars) {
    if (calendar.validTo < fromDate) continue;
    const result = findNextHouseholdCollection(calendar, fromDate);
    if (result) return { ...result, calendarId: calendar.id };
  }
  return null;
};

export const recyclingCoverage = Object.freeze({
  validFrom: recyclingCalendars[0].validFrom,
  validTo: recyclingCalendars.at(-1).validTo
});

export const getRegisteredNavigationState = (anchor) => ({
  canGoBack: anchor > recyclingCoverage.validFrom,
  canGoForward: anchor < recyclingCoverage.validTo
});

export const registeredNavigationTarget = (anchor, numberOfDays) => {
  if (!Number.isInteger(numberOfDays) || numberOfDays === 0) return anchor;
  if (anchor < recyclingCoverage.validFrom) {
    return numberOfDays > 0 ? recyclingCoverage.validFrom : anchor;
  }
  if (anchor > recyclingCoverage.validTo) {
    return numberOfDays < 0 ? recyclingCoverage.validTo : anchor;
  }

  const candidate = addIsoDays(anchor, numberOfDays);
  if (candidate < recyclingCoverage.validFrom) return recyclingCoverage.validFrom;
  if (candidate > recyclingCoverage.validTo) return recyclingCoverage.validTo;
  return candidate;
};

export const registeredAvailableWindowAnchor = (anchor, length = 14) => {
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Window length must be positive");
  const calendar = findNearestRegisteredCalendar(anchor);
  if (anchor < calendar.validFrom) return calendar.validFrom;
  if (anchor > calendar.validTo || addIsoDays(anchor, length - 1) > calendar.validTo) {
    const latestFullWindow = addIsoDays(calendar.validTo, -(length - 1));
    return latestFullWindow < calendar.validFrom ? calendar.validFrom : latestFullWindow;
  }
  return anchor;
};
