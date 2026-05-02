# Secure Digital Check-In MVP

## Architecture

The existing public website remains a static Cloudflare Pages site. The MVP adds `/admin`, `/checkin`, and a Cloudflare Pages Functions backend under `/api/*`.

Storage uses `.local-data/checkins/` for local development and a private R2 bucket through the `VILLA_LAURA_CHECKINS` binding in production.

Airbnb intake uses only the official Airbnb iCal export URL from `AIRBNB_ICAL_URL`. Local fallback can read the private local keys file, but that file is ignored and must never be committed or logged.

## Local Development

```bash
npm install
npm run build
npm test
npm run security:scan
npx wrangler pages dev dist --compatibility-date=2026-05-02
```

Use `.dev.vars` or shell environment for local secrets. Do not commit local secrets or local check-in data.

## MVP Workflow

1. Admin logs in through Cloudflare Access in production.
2. Admin imports Airbnb iCal reservations.
3. Reservations and blocked date ranges are deduplicated by iCal UID.
4. Admin edits missing guest details manually.
5. Admin creates an opaque check-in token and copies the Airbnb message.
6. WhatsApp opens only when a full phone number has been manually entered.
7. Guest submits the secure form and private document uploads.
8. Admin reviews submissions, updates status, and deletes documents after processing.

## Manual In MVP

- WhatsApp messages are never sent automatically.
- Airbnb reservation details beyond iCal data are copied manually by an admin.
- Alloggiati Web and ROSS1000 submission/export remain manual future work.
