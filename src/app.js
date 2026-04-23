const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.14 }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("is-visible"));
}

const supportedLocales = ["en", "it", "es", "de", "pt", "fr"];
const savedLocaleKey = "villa-laura-locale";

document.querySelectorAll("[data-locale-switch]").forEach((link) => {
  link.addEventListener("click", () => {
    const locale = link.getAttribute("data-locale-switch");
    if (locale && supportedLocales.includes(locale)) {
      window.localStorage.setItem(savedLocaleKey, locale);
    }
  });
});

const page = document.body.dataset.page;
const locale = document.body.dataset.locale || "en";

if (page === "home" && locale === "en") {
  const savedLocale = window.localStorage.getItem(savedLocaleKey);
  const preferredLanguages = [...(navigator.languages || []), navigator.language].filter(Boolean);

  if (!savedLocale) {
    const matched = preferredLanguages
      .map((entry) => entry.toLowerCase().split("-")[0])
      .find((entry) => supportedLocales.includes(entry) && entry !== "en");

    if (matched && (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html"))) {
      window.location.replace(`${matched}/`);
    }
  }
}
