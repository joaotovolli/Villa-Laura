# Tresnuraghes Recycling Calendar

## Public Routes

- English: `/recycling/`
- Italian: `/it/recycling/`
- Spanish: `/es/recycling/`
- French: `/fr/recycling/`
- Dutch: `/nl/recycling/`
- German: `/de/recycling/`
- Portuguese: `/pt/recycling/`

These are static public routes. They do not overlap the Cloudflare Access scopes documented for `/admin*` and `/api/admin*`.

## Official Source And Coverage

The authoritative source is the Italian `Ecocalendario dell'Unione dei comuni della Planargia` for Zone B, which explicitly includes Tresnuraghes, Sagama, and Montresta. Its two pages cover 1 January through 31 December 2026.

The supplied English, Spanish, French, Dutch, German, and Portuguese reference documents cover July through December only. Their category terminology and recycling guidance are used for the translated pages, while every collection date for the complete year comes from the Italian original.

The source archive itself is local and ignored by Git. Public, clearly named PDF references are copied under `public/recycling/2026/`; the runtime schedule does not read dates from PDFs or images.

## Structured Data Rules

`src/recycling/calendar-2026.js` contains one explicit record for every printed household or commercial-only collection date. A supported date without a household record means the official row has no household collection. The UI never extrapolates a weekly pattern.

The data keeps additional organic collections labelled for commercial premises in `commercialOnly`. Household rendering reads only `household`, so these rows cannot appear as Villa Laura collections.

Holiday changes are explicit. In particular, the model preserves the split Easter schedule on 7–9 April and the paper/organic postponements to 2 May and 26 December.

The source's prose says residual collection starts on “Monday 13 January”, but 13 January 2026 is a Tuesday and the dated grid starts on Monday 12 January. The implementation follows the dated rows and does not expose the inconsistent prose date.

## Date Handling

The browser derives the current civil date with `Intl.DateTimeFormat` and the `Europe/Rome` timezone. Calendar keys stay in `YYYY-MM-DD` form and date arithmetic uses UTC getters only, avoiding accidental UTC/local-midnight changes.

The initial view contains exactly 14 dates: today through today plus 13 days. Navigation moves by seven days, with a Today action and honest unavailable states outside registered calendar coverage. No 2026 pattern is repeated in 2027.

## Adding A New Official Year

1. Verify the new original document row by row and record its valid range, zone, audience, exceptions, and commercial-only rows.
2. Add a year-specific data module alongside `calendar-2026.js`.
3. Register it in `src/recycling/calendars.js`; do not modify the page renderer to repeat an old pattern.
4. Add every required language translation and public reference document metadata.
5. Extend the data, boundary, timezone, rendering, and document-link tests with source-specific dates.
6. Run `npm ci`, `npm run check`, `npm run test:e2e`, `npm run build`, and `npm audit --omit=dev --audit-level=high`.

## Validation

The automated tests detect duplicate or invalid dates, records outside the declared year/range, unknown or repeated categories, missing category/guide/note translations, commercial-only leakage, inconsistent rendered fallback dates, broken PDF outputs, Rome timezone rollover errors, navigation boundaries, and unsupported 2027 dates.

Playwright runs the calendar at mobile and desktop viewports with a fixed clock. It also checks week/language navigation, no horizontal overflow, JavaScript-disabled fallback, PDF delivery, and serious or critical accessibility findings.
