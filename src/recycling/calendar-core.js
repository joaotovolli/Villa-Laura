const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RECYCLING_LOCALES = Object.freeze(["it", "en", "es", "fr", "nl", "de", "pt"]);

export const isValidIsoDate = (value) => {
  const match = ISO_DATE_PATTERN.exec(String(value));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const isoDateToUtc = (isoDate) => {
  if (!isValidIsoDate(isoDate)) throw new TypeError(`Invalid ISO date: ${isoDate}`);
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const utcToIsoDate = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;

export const addIsoDays = (isoDate, numberOfDays) => {
  const date = isoDateToUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + numberOfDays);
  return utcToIsoDate(date);
};

export const compareIsoDates = (left, right) => left.localeCompare(right);

export const eachIsoDate = (from, to) => {
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) return [];
  const dates = [];
  for (let current = from; current <= to; current = addIsoDays(current, 1)) dates.push(current);
  return dates;
};

export const dateInTimeZone = (instant = new Date(), timeZone = "Europe/Rome") => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const isWithinCalendar = (calendar, isoDate) =>
  isValidIsoDate(isoDate) && isoDate >= calendar.validFrom && isoDate <= calendar.validTo;

export const createCalendarIndex = (calendar) =>
  new Map(calendar.records.map((record) => [record.date, record]));

export const getCalendarDay = (calendar, isoDate, index = createCalendarIndex(calendar)) => {
  if (!isWithinCalendar(calendar, isoDate)) {
    return { date: isoDate, status: "unavailable", categories: [], noteIds: [], commercialOnly: [] };
  }

  const record = index.get(isoDate);
  if (!record || record.household.length === 0) {
    return {
      date: isoDate,
      status: "none",
      categories: [],
      noteIds: record?.noteIds ?? [],
      commercialOnly: record?.commercialOnly ?? []
    };
  }

  return {
    date: isoDate,
    status: "collection",
    categories: [...record.household],
    noteIds: [...record.noteIds],
    commercialOnly: [...record.commercialOnly]
  };
};

export const getDateWindow = (calendar, anchor, length = 14) => {
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Window length must be positive");
  const index = createCalendarIndex(calendar);
  return Array.from({ length }, (_, offset) =>
    getCalendarDay(calendar, addIsoDays(anchor, offset), index)
  );
};

export const findNextHouseholdCollection = (calendar, fromDate) => {
  if (!isValidIsoDate(fromDate) || fromDate > calendar.validTo) return null;
  const start = fromDate < calendar.validFrom ? calendar.validFrom : fromDate;
  const record = calendar.records.find(
    (entry) => entry.date >= start && entry.household.length > 0
  );
  return record ? { date: record.date, categories: [...record.household] } : null;
};

export const getExceptionsForDate = (calendar, isoDate) =>
  calendar.exceptions.filter(
    (exception) =>
      exception.date === isoDate ||
      exception.postponedTo === isoDate ||
      exception.affectedDates?.includes(isoDate)
  );

export const navigationTarget = (calendar, anchor, numberOfDays) => {
  if (!Number.isInteger(numberOfDays) || numberOfDays === 0) return anchor;
  if (anchor < calendar.validFrom) return numberOfDays > 0 ? calendar.validFrom : anchor;
  if (anchor > calendar.validTo) return numberOfDays < 0 ? calendar.validTo : anchor;

  const candidate = addIsoDays(anchor, numberOfDays);
  if (candidate < calendar.validFrom) return calendar.validFrom;
  if (candidate > calendar.validTo) return calendar.validTo;
  return candidate;
};

export const getNavigationState = (calendar, anchor) => ({
  canGoBack: anchor > calendar.validFrom,
  canGoForward: anchor < calendar.validTo
});

export const groupHouseholdCollectionsByMonth = (calendar) => {
  const groups = new Map();
  for (const record of calendar.records) {
    if (record.household.length === 0) continue;
    const month = record.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push({
      date: record.date,
      categories: [...record.household],
      noteIds: [...record.noteIds]
    });
  }
  return groups;
};

const duplicateValues = (values) =>
  values.filter((value, index) => values.indexOf(value) !== index);

export const validateCalendarData = (calendar) => {
  const errors = [];
  const allowedCategories = new Set(calendar.categoryIds ?? []);
  const allowedNotes = new Set(calendar.noteIds ?? []);

  if (!Number.isInteger(calendar.year)) errors.push("Calendar year must be an integer");
  if (!isValidIsoDate(calendar.validFrom) || !isValidIsoDate(calendar.validTo)) {
    errors.push("Calendar validity boundaries must be valid ISO dates");
  } else {
    if (calendar.validFrom > calendar.validTo) errors.push("Calendar validity range is reversed");
    if (!calendar.validFrom.startsWith(`${calendar.year}-`)) errors.push("validFrom is outside the calendar year");
    if (!calendar.validTo.startsWith(`${calendar.year}-`)) errors.push("validTo is outside the calendar year");
  }

  if (calendar.zone?.id !== "B" || !calendar.zone?.municipalities?.includes("Tresnuraghes")) {
    errors.push("Calendar must identify Tresnuraghes in Zone B");
  }
  if (calendar.audience !== "household") errors.push("Calendar audience must be household");
  if (duplicateValues(calendar.categoryIds ?? []).length > 0) errors.push("Duplicate category IDs");

  let previousDate = "";
  const seenDates = new Set();
  for (const record of calendar.records ?? []) {
    if (!isValidIsoDate(record.date)) errors.push(`Invalid record date: ${record.date}`);
    if (seenDates.has(record.date)) errors.push(`Duplicate record date: ${record.date}`);
    seenDates.add(record.date);
    if (previousDate && record.date < previousDate) errors.push(`Records are not sorted at ${record.date}`);
    previousDate = record.date;

    if (!record.date.startsWith(`${calendar.year}-`)) errors.push(`Record outside ${calendar.year}: ${record.date}`);
    if (record.date < calendar.validFrom || record.date > calendar.validTo) {
      errors.push(`Record outside validity range: ${record.date}`);
    }

    for (const field of ["household", "commercialOnly"]) {
      const categories = record[field];
      if (!Array.isArray(categories)) {
        errors.push(`${record.date} ${field} categories must be an array`);
        continue;
      }
      if (duplicateValues(categories).length > 0) errors.push(`${record.date} has duplicate ${field} categories`);
      for (const category of categories) {
        if (!allowedCategories.has(category)) errors.push(`${record.date} has unknown category: ${category}`);
      }
    }

    if ((record.household?.length ?? 0) === 0 && (record.commercialOnly?.length ?? 0) === 0) {
      errors.push(`${record.date} has no collection data`);
    }
    for (const noteId of record.noteIds ?? []) {
      if (!allowedNotes.has(noteId)) errors.push(`${record.date} has unknown note: ${noteId}`);
    }
  }

  const seenExceptionIds = new Set();
  const recordIndex = createCalendarIndex(calendar);
  for (const exception of calendar.exceptions ?? []) {
    if (!exception.id || seenExceptionIds.has(exception.id)) {
      errors.push(`Duplicate or missing exception ID: ${exception.id ?? ""}`);
    }
    seenExceptionIds.add(exception.id);
    if (!["holiday-postponement", "holiday-schedule-change"].includes(exception.type)) {
      errors.push(`Exception ${exception.id} has unknown type: ${exception.type}`);
    }
    if (exception.noteId && !allowedNotes.has(exception.noteId)) {
      errors.push(`Exception ${exception.id} has unknown note: ${exception.noteId}`);
    }
    if (!exception.noteId) errors.push(`Exception ${exception.id} is missing a note`);
    if (duplicateValues(exception.affectedDates ?? []).length > 0) {
      errors.push(`Exception ${exception.id} has duplicate affected dates`);
    }
    for (const date of [exception.date, exception.postponedTo, ...(exception.affectedDates ?? [])].filter(Boolean)) {
      if (!isValidIsoDate(date)) errors.push(`Exception ${exception.id} has invalid date: ${date}`);
      else if (date < calendar.validFrom || date > calendar.validTo) {
        errors.push(`Exception ${exception.id} is outside the validity range: ${date}`);
      }
    }
    for (const category of exception.categories ?? []) {
      if (!allowedCategories.has(category)) errors.push(`Exception ${exception.id} has unknown category: ${category}`);
    }
    const targetDates = [exception.postponedTo, ...(exception.affectedDates ?? [])].filter(Boolean);
    for (const targetDate of targetDates) {
      const targetRecord = recordIndex.get(targetDate);
      if (!targetRecord || targetRecord.household.length === 0) {
        errors.push(`Exception ${exception.id} target has no household collection: ${targetDate}`);
      } else if (!targetRecord.noteIds?.includes(exception.noteId)) {
        errors.push(`Exception ${exception.id} note is missing from target: ${targetDate}`);
      }
    }
    if (exception.type === "holiday-postponement") {
      const targetRecord = recordIndex.get(exception.postponedTo);
      if (!exception.postponedTo || !Array.isArray(exception.categories) || exception.categories.length === 0) {
        errors.push(`Exception ${exception.id} is missing postponement details`);
      } else if (targetRecord && targetRecord.household.join("|") !== exception.categories.join("|")) {
        errors.push(`Exception ${exception.id} categories do not match ${exception.postponedTo}`);
      }
    }
  }

  const documents = calendar.source?.documents ?? {};
  for (const locale of RECYCLING_LOCALES) {
    const document = documents[locale];
    if (!document?.path?.endsWith(".pdf")) errors.push(`Missing PDF source document for ${locale}`);
    if (!isValidIsoDate(document?.validFrom) || !isValidIsoDate(document?.validTo)) {
      errors.push(`Invalid source document range for ${locale}`);
    } else if (document.validFrom > document.validTo) {
      errors.push(`Reversed source document range for ${locale}`);
    }
  }
  if (!documents[calendar.source?.authoritativeLocale]?.authoritative) {
    errors.push("Authoritative source document is not identified");
  }

  return errors;
};

const requiredTranslationPaths = [
  "htmlLang",
  "intlLocale",
  "languageName",
  "meta.title",
  "meta.description",
  "header.homeLabel",
  "header.tagline",
  "header.navigationLabel",
  "header.home",
  "header.houseGuide",
  "header.support",
  "header.language",
  "page.kicker",
  "page.title",
  "page.intro",
  "page.zone",
  "page.audience",
  "page.validPeriod",
  "page.householdOnly",
  "calendar.title",
  "calendar.intro",
  "calendar.previousWeek",
  "calendar.today",
  "calendar.nextWeek",
  "calendar.range",
  "calendar.todayBadge",
  "calendar.tomorrowBadge",
  "calendar.nextCollectionBadge",
  "calendar.holidayBadge",
  "calendar.collection",
  "calendar.noCollection",
  "calendar.unavailable",
  "calendar.nextCollection",
  "calendar.noFutureCollection",
  "calendar.outsideCoverage",
  "calendar.viewAvailable",
  "calendar.availableRange",
  "calendar.loading",
  "guide.kicker",
  "guide.title",
  "guide.intro",
  "guide.accepted",
  "guide.preparation",
  "guide.notIncluded",
  "guide.localRule",
  "sources.kicker",
  "sources.title",
  "sources.intro",
  "sources.originalPdf",
  "sources.translatedPdf",
  "sources.translatedLimit",
  "sources.pdfFormat",
  "fullSchedule.kicker",
  "fullSchedule.title",
  "fullSchedule.intro",
  "fullSchedule.noScript",
  "fullSchedule.collectionOn",
  "footer"
];

const requiredTemplateTokens = {
  "meta.title": ["year"],
  "page.intro": ["year"],
  "page.validPeriod": ["validStart", "validEnd"],
  "calendar.range": ["start", "end"],
  "calendar.nextCollection": ["date", "categories"],
  "calendar.outsideCoverage": ["year"],
  "calendar.viewAvailable": ["year"],
  "calendar.availableRange": ["start", "end"],
  "sources.translatedPdf": ["translatedStart", "translatedEnd"],
  "sources.translatedLimit": ["translatedStart", "translatedEnd", "validStart", "validEnd"],
  "fullSchedule.title": ["year"],
  "fullSchedule.collectionOn": ["date", "categories"]
};

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);

export const validateRecyclingTranslations = (calendar, translations, locales = RECYCLING_LOCALES) => {
  const errors = [];
  for (const locale of locales) {
    const translation = translations[locale];
    if (!translation) {
      errors.push(`Missing locale: ${locale}`);
      continue;
    }
    for (const path of requiredTranslationPaths) {
      const value = getPath(translation, path);
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(`${locale} is missing ${path}`);
      }
    }
    if (translation.htmlLang !== locale) errors.push(`${locale} has an invalid htmlLang`);
    try {
      const resolvedLanguage = new Intl.DateTimeFormat(translation.intlLocale)
        .resolvedOptions()
        .locale.split("-")[0]
        .toLowerCase();
      if (resolvedLanguage !== locale) errors.push(`${locale} has an invalid intlLocale`);
    } catch {
      errors.push(`${locale} has an invalid intlLocale`);
    }
    for (const [path, tokens] of Object.entries(requiredTemplateTokens)) {
      const value = getPath(translation, path) ?? "";
      for (const token of tokens) {
        if (!value.includes(`{${token}}`)) errors.push(`${locale} ${path} is missing {${token}}`);
      }
    }
    for (const categoryId of calendar.categoryIds) {
      const category = translation.categories?.[categoryId];
      if (!category?.name) errors.push(`${locale} is missing category ${categoryId}`);
      if (!category?.shortName) errors.push(`${locale} is missing short category ${categoryId}`);
      if (!Array.isArray(category?.accepted) || category.accepted.length === 0) {
        errors.push(`${locale} is missing accepted items for ${categoryId}`);
      }
      for (const field of ["accepted", "preparation", "notIncluded"]) {
        if (!Array.isArray(category?.[field])) {
          errors.push(`${locale} ${categoryId} ${field} must be an array`);
        } else if (category[field].some((item) => typeof item !== "string" || item.trim() === "")) {
          errors.push(`${locale} ${categoryId} has an invalid ${field} item`);
        }
      }
      if (typeof category?.rule !== "string") errors.push(`${locale} ${categoryId} rule must be a string`);
    }
    for (const noteId of calendar.noteIds) {
      if (typeof translation.notes?.[noteId] !== "string" || translation.notes[noteId].trim() === "") {
        errors.push(`${locale} is missing note ${noteId}`);
      }
    }
  }
  return errors;
};
