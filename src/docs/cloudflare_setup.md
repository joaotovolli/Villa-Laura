# Cloudflare Setup

## Pages

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## R2

Create a private bucket:

```bash
npx wrangler r2 bucket create villa-laura-checkins
```

Bind it to Pages Functions as `VILLA_LAURA_CHECKINS`. The bucket must not be public.

Object layout:

- `checkins/reservations/<reservationUid>.json`
- `checkins/tokens/<token>.json`
- `checkins/submissions/<token>/submission.json`
- `checkins/submissions/<token>/documents/<guestId>/<safeFilename>`
- `checkins/audit/<date>/<eventId>.json`

## Secrets

Set these as Cloudflare Pages secrets or environment variables:

```bash
npx wrangler pages secret put AIRBNB_ICAL_URL
npx wrangler pages secret put ADMIN_PASSWORD
npx wrangler pages secret put ADMIN_SESSION_SECRET
npx wrangler pages secret put CHECKIN_TOKEN_SECRET
npx wrangler pages secret put ALLOWED_ADMIN_EMAILS
```

Set `APP_ENV=production` and `VILLA_LAURA_SITE_URL=https://villa-laura.it`.

## Cloudflare Access

Preferred production setup:

- Protect `/admin*`.
- Protect `/api/admin*`.
- Allow only approved admin emails.
- Use email one-time PIN or another approved Zero Trust identity provider.
- Forward Access identity headers to the Pages Function.

The app can consume `cf-access-authenticated-user-email` and compare it with `ALLOWED_ADMIN_EMAILS`.

## Future Roadmap

- Alloggiati Web export.
- ROSS1000 export.
- Automated retention enforcement.
- Stricter identity verification.
- Improved multilingual check-in UI.
