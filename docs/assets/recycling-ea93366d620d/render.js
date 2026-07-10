import { addIsoDays, getExceptionsForDate, groupHouseholdCollectionsByMonth, isoDateToUtc } from "./calendar-core.js";

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const replaceTokens = (template, values) =>
  Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    template
  );

export const formatCalendarDate = (isoDate, translation, options = {}) =>
  new Intl.DateTimeFormat(translation.intlLocale, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: options.year === false ? undefined : "numeric",
    weekday: options.weekday ? "long" : undefined
  }).format(isoDateToUtc(isoDate));

export const localizeRecyclingTranslation = (translation, calendar, locale) => {
  const documents = calendar.source.documents;
  const translatedDocument =
    locale === calendar.source.authoritativeLocale
      ? Object.entries(documents).find(([, document]) => !document.authoritative)?.[1]
      : documents[locale];
  const values = {
    year: calendar.year,
    validStart: formatCalendarDate(calendar.validFrom, translation, { weekday: false }),
    validEnd: formatCalendarDate(calendar.validTo, translation, { weekday: false }),
    translatedStart: formatCalendarDate(
      translatedDocument?.validFrom ?? calendar.validFrom,
      translation,
      { weekday: false }
    ),
    translatedEnd: formatCalendarDate(
      translatedDocument?.validTo ?? calendar.validTo,
      translation,
      { weekday: false }
    )
  };
  const visit = (value) => {
    if (typeof value === "string") return replaceTokens(value, values);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]));
    }
    return value;
  };
  return visit(translation);
};

export const formatWeekday = (isoDate, translation) =>
  new Intl.DateTimeFormat(translation.intlLocale, {
    timeZone: "UTC",
    weekday: "long"
  }).format(isoDateToUtc(isoDate));

export const formatMonth = (monthKey, translation) =>
  new Intl.DateTimeFormat(translation.intlLocale, {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  }).format(isoDateToUtc(`${monthKey}-01`));

export const formatCategoryList = (categoryIds, translation) =>
  new Intl.ListFormat(translation.intlLocale, { style: "long", type: "conjunction" }).format(
    categoryIds.map((categoryId) => translation.categories[categoryId].shortName)
  );

const iconPaths = {
  paper: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9.5 12h5M9.5 15h5"/>',
  glass: '<path d="M6 4h4v3l-1 2v10H5V9L4 7V4z"/><path d="M14 7h5v12h-5zM14 11h5"/>',
  plastic: '<path d="M10 3h4v3l2 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/><path d="M8 11h8M10 3h4"/>',
  organic: '<path d="M12 20c-5-2-7-5-7-9 4 0 7 2 7 6 0-5 2-8 7-9 0 6-2 10-7 12Z"/><path d="M12 17c1-5 3-7 6-8"/>',
  residual: '<path d="M6 7h12l-1 14H7zM5 7h14M9 7V4h6v3M10 11v6M14 11v6"/>'
};

export const categoryIcon = (categoryId) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${iconPaths[categoryId] ?? ""}
    </g>
  </svg>`;

export const renderCategoryChip = (categoryId, translation) => `
  <span class="waste-chip waste-chip--${escapeHtml(categoryId)}" data-category="${escapeHtml(categoryId)}">
    <span class="waste-chip__icon">${categoryIcon(categoryId)}</span>
    <span>${escapeHtml(translation.categories[categoryId].shortName)}</span>
  </span>`;

const exceptionNotes = (calendar, isoDate) =>
  getExceptionsForDate(calendar, isoDate).map((exception) => exception.noteId).filter(Boolean);

export const renderCalendarDay = (
  day,
  { calendar, calendars = [calendar], translation, today, nextCollectionDate }
) => {
  const isToday = day.date === today;
  const isTomorrow = day.date === addIsoDays(today, 1);
  const isNextCollection = day.date === nextCollectionDate;
  const sourceCalendar = calendars.find(
    (entry) => day.date >= entry.validFrom && day.date <= entry.validTo
  );
  const holidayNotes = sourceCalendar ? exceptionNotes(sourceCalendar, day.date) : [];
  const visibleNoteIds = [...new Set([...day.noteIds, ...holidayNotes])].filter(
    (noteId) => noteId !== "commercial-summer-extra"
  );
  const badges = [
    isToday ? `<span class="day-badge day-badge--today">${escapeHtml(translation.calendar.todayBadge)}</span>` : "",
    isTomorrow ? `<span class="day-badge">${escapeHtml(translation.calendar.tomorrowBadge)}</span>` : "",
    isNextCollection
      ? `<span class="day-badge day-badge--next">${escapeHtml(translation.calendar.nextCollectionBadge)}</span>`
      : "",
    holidayNotes.length > 0
      ? `<span class="day-badge day-badge--holiday">${escapeHtml(translation.calendar.holidayBadge)}</span>`
      : ""
  ].join("");

  let result = `<p class="collection-day__empty">${escapeHtml(translation.calendar.noCollection)}</p>`;
  if (day.status === "unavailable") {
    result = `<p class="collection-day__empty collection-day__empty--unavailable">${escapeHtml(
      translation.calendar.unavailable
    )}</p>`;
  } else if (day.status === "collection") {
    result = `
      <p class="collection-day__label">${escapeHtml(translation.calendar.collection)}</p>
      <div class="waste-chips">${day.categories
        .map((categoryId) => renderCategoryChip(categoryId, translation))
        .join("")}</div>`;
  }

  return `
    <li class="collection-day collection-day--${escapeHtml(day.status)}${isToday ? " is-today" : ""}${
      isNextCollection ? " is-next" : ""
    }" data-calendar-date="${escapeHtml(day.date)}" data-calendar-status="${escapeHtml(day.status)}"${
      isToday ? ' aria-current="date"' : ""
    }>
      <div class="collection-day__date">
        <time datetime="${escapeHtml(day.date)}">
          <span class="collection-day__weekday">${escapeHtml(formatWeekday(day.date, translation))}</span>
          <strong>${escapeHtml(formatCalendarDate(day.date, translation, { weekday: false }))}</strong>
        </time>
        <div class="day-badges">${badges}</div>
      </div>
      <div class="collection-day__result">
        ${result}
        ${visibleNoteIds
          .map((noteId) => `<p class="collection-day__note">${escapeHtml(translation.notes[noteId])}</p>`)
          .join("")}
      </div>
    </li>`;
};

export const renderCalendarWindow = (days, context) =>
  days.map((day) => renderCalendarDay(day, context)).join("");

const renderGuideSection = (label, items) =>
  items.length > 0
    ? `<div class="recycling-guide__section"><h3>${escapeHtml(label)}</h3><ul>${items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul></div>`
    : "";

export const renderRecyclingGuide = (calendar, translation) =>
  calendar.categoryIds
    .map((categoryId, index) => {
      const category = translation.categories[categoryId];
      return `
        <details class="recycling-guide recycling-guide--${escapeHtml(categoryId)}"${index === 0 ? " open" : ""}>
          <summary>
            <span class="recycling-guide__icon">${categoryIcon(categoryId)}</span>
            <span>${escapeHtml(category.name)}</span>
            <span class="recycling-guide__chevron" aria-hidden="true">+</span>
          </summary>
          <div class="recycling-guide__body">
            ${renderGuideSection(translation.guide.accepted, category.accepted)}
            ${renderGuideSection(translation.guide.preparation, category.preparation)}
            ${renderGuideSection(translation.guide.notIncluded, category.notIncluded)}
            ${category.rule ? `<div class="recycling-guide__rule"><strong>${escapeHtml(translation.guide.localRule)}</strong><p>${escapeHtml(category.rule)}</p></div>` : ""}
          </div>
        </details>`;
    })
    .join("");

export const renderFullHouseholdSchedule = (calendar, translation) =>
  [...groupHouseholdCollectionsByMonth(calendar).entries()]
    .map(
      ([month, records]) => `
        <details class="full-schedule__month">
          <summary>
            <span>${escapeHtml(formatMonth(month, translation))}</span>
            <span class="full-schedule__count">${records.length}</span>
          </summary>
          <ol>
            ${records
              .map((record) => {
                const text = replaceTokens(escapeHtml(translation.fullSchedule.collectionOn), {
                  date: `<time datetime="${escapeHtml(record.date)}">${escapeHtml(
                    formatCalendarDate(record.date, translation, { weekday: true })
                  )}</time>`,
                  categories: `<span>${escapeHtml(formatCategoryList(record.categories, translation))}</span>`
                });
                const hasHolidayChange = record.noteIds.some((noteId) =>
                  ["easter-holiday-change", "holiday-postponement"].includes(noteId)
                );
                return `<li data-full-schedule-date="${escapeHtml(record.date)}">${text}${
                  hasHolidayChange
                    ? ` <span class="full-schedule__holiday">${escapeHtml(translation.calendar.holidayBadge)}</span>`
                    : ""
                }</li>`;
              })
              .join("")}
          </ol>
        </details>`
    )
    .join("");
