# Security And Privacy

## Data Collected

The check-in form collects only operational and accommodation-registration data: arrival and departure dates, number of guests, main guest email and phone, required guest identity fields, and private document uploads for review.

## Data Not Collected

The MVP does not collect payment data, unnecessary identity attributes, automated WhatsApp credentials, Airbnb account credentials, or public document URLs.

## Secret Handling

Required secrets are configured as environment variables or Cloudflare secrets:

- `AIRBNB_ICAL_URL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CHECKIN_TOKEN_SECRET`
- `ALLOWED_ADMIN_EMAILS`
- `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` for strict Cloudflare Access JWT validation when available

No real keys, private URLs, guest data, or document files belong in GitHub.

## Controls

- `/admin` and `/checkin` are marked `noindex`.
- `robots.txt` disallows `/admin` and `/checkin`.
- Admin sessions use signed HttpOnly SameSite cookies.
- Production cookies are Secure.
- Cloudflare Access is the preferred outer authentication layer.
- In production, Cloudflare Access is the primary admin authentication layer; the password fallback is only for local development.
- Uploads validate extension, MIME type, and size.
- Uploaded documents are stored outside public directories.
- Audit events avoid secrets, document numbers, and full identity details.

## Retention

Documents should be deleted after registration processing and any legally required retention period. The admin workflow keeps metadata after deletion and records `documents_deleted_at`.

## Rotation

Rotate `ADMIN_SESSION_SECRET`, `CHECKIN_TOKEN_SECRET`, `ADMIN_PASSWORD`, and `AIRBNB_ICAL_URL` through Cloudflare secrets or environment configuration. After rotating session secrets, active admin sessions are invalidated.
