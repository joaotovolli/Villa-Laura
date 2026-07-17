import {
  dateInTimeZone,
  isValidIsoDate
} from "./calendar-core.js";
import {
  findCalendarForDate,
  findNearestRegisteredCalendar,
  findNextRegisteredCollection,
  getRegisteredNavigationState,
  getRegisteredDateWindow,
  recyclingCalendars,
  recyclingCoverage,
  registeredAvailableWindowAnchor,
  registeredNavigationTarget
} from "./calendars.js";
import { recyclingTranslations } from "./i18n.js";
import {
  formatCalendarDate,
  formatCategoryList,
  localizeRecyclingTranslation,
  previousEveningDate,
  renderCalendarWindow,
  replaceTokens
} from "./render.js";

const root = document.querySelector("[data-recycling-app]");

if (root) {
  const locale = root.getAttribute("data-locale") || "en";
  const timeZone = recyclingCalendars[0]?.timeZone ?? "Europe/Rome";
  let today = dateInTimeZone(new Date(), timeZone);
  const pageCalendar =
    findCalendarForDate(today) ?? findNearestRegisteredCalendar(today);
  const translation = localizeRecyclingTranslation(
    recyclingTranslations[locale] ?? recyclingTranslations.en,
    pageCalendar,
    locale
  );
  const list = root.querySelector("[data-calendar-list]");
  const range = root.querySelector("[data-calendar-range]");
  const nextSummary = root.querySelector("[data-next-collection]");
  const nextInstruction = root.querySelector("[data-next-collection-instruction]");
  const coverageMessage = root.querySelector("[data-coverage-message]");
  const coverageText = root.querySelector("[data-coverage-text]");
  const previousButton = root.querySelector("[data-calendar-previous]");
  const todayButton = root.querySelector("[data-calendar-today]");
  const nextButton = root.querySelector("[data-calendar-next]");
  const availableButton = root.querySelector("[data-calendar-available]");
  const savedLocaleKey = "villa-laura-locale";
  const recyclingLocaleKey = "villa-laura-recycling-locale";
  const siteLocales = new Set(["en", "it", "es", "fr", "nl", "de", "pt"]);

  document.querySelectorAll("[data-recycling-locale-switch]").forEach((link) => {
    link.addEventListener("click", () => {
      const selectedLocale = link.getAttribute("data-recycling-locale-switch");
      if (selectedLocale && recyclingTranslations[selectedLocale]) {
        window.localStorage.setItem(recyclingLocaleKey, selectedLocale);
        if (siteLocales.has(selectedLocale)) {
          window.localStorage.setItem(savedLocaleKey, selectedLocale);
        }
      }
      const url = new URL(link.href);
      if (anchor !== today) url.searchParams.set("start", anchor);
      link.href = url.toString();
    });
  });

  const requestedAnchor = new URLSearchParams(window.location.search).get("start");
  let anchor = isValidIsoDate(requestedAnchor) ? requestedAnchor : today;

  const updateUrl = () => {
    const url = new URL(window.location.href);
    if (anchor === today) url.searchParams.delete("start");
    else url.searchParams.set("start", anchor);
    window.history.replaceState({}, "", url);
  };

  const render = () => {
    const days = getRegisteredDateWindow(anchor, 14);
    const nextCollection = findNextRegisteredCollection(today);
    const end = days.at(-1).date;
    const navigation = getRegisteredNavigationState(anchor);

    list.innerHTML = renderCalendarWindow(days, {
      calendar: pageCalendar,
      calendars: recyclingCalendars,
      translation,
      today,
      nextCollectionDate: nextCollection?.date ?? null
    });
    list.removeAttribute("aria-busy");

    range.textContent = replaceTokens(translation.calendar.range, {
      start: formatCalendarDate(anchor, translation, { weekday: false }),
      end: formatCalendarDate(end, translation, { weekday: false })
    });

    if (nextCollection) {
      nextSummary.textContent = replaceTokens(translation.calendar.nextCollection, {
        date: formatCalendarDate(nextCollection.date, translation, { weekday: true }),
        categories: formatCategoryList(nextCollection.categories, translation)
      });
      nextInstruction.textContent = replaceTokens(
        translation.calendar.nextCollectionInstruction,
        {
          previousDate: formatCalendarDate(
            previousEveningDate(nextCollection.date),
            translation,
            { weekday: true }
          )
        }
      );
      nextInstruction.hidden = false;
    } else {
      nextSummary.textContent = translation.calendar.noFutureCollection;
      nextInstruction.textContent = "";
      nextInstruction.hidden = true;
    }

    const includesUnavailableDates = days.some((day) => day.status === "unavailable");
    coverageMessage.hidden = !includesUnavailableDates;
    if (includesUnavailableDates) {
      coverageText.textContent = `${translation.calendar.outsideCoverage} ${replaceTokens(
        translation.calendar.availableRange,
        {
          start: formatCalendarDate(recyclingCoverage.validFrom, translation, { weekday: false }),
          end: formatCalendarDate(recyclingCoverage.validTo, translation, { weekday: false })
        }
      )}`;
    }

    previousButton.disabled = !navigation.canGoBack;
    nextButton.disabled = !navigation.canGoForward;
    todayButton.disabled = anchor === today;
    availableButton.disabled = false;
    updateUrl();
  };

  previousButton.addEventListener("click", () => {
    anchor = registeredNavigationTarget(anchor, -7);
    render();
  });

  nextButton.addEventListener("click", () => {
    anchor = registeredNavigationTarget(anchor, 7);
    render();
  });

  todayButton.addEventListener("click", () => {
    today = dateInTimeZone(new Date(), timeZone);
    anchor = today;
    render();
  });

  availableButton.addEventListener("click", () => {
    anchor = registeredAvailableWindowAnchor(anchor, 14);
    render();
  });

  render();
}
