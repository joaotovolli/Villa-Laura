# Villa Laura Repository Instructions

This is a public repository for the Villa Laura website. Treat all admin, check-in, and guest-registration work as privacy-first and security-sensitive.

Permanent rules:

- Never commit secrets, credentials, tokens, passwords, private URLs, iCal URLs, API keys, Cloudflare details, or operational private notes.
- Never commit guest personal data, reservation data, check-in submissions, uploaded identity documents, passport details, phone numbers, or real Airbnb records.
- `Doc_Keys_Villa_Laura.txt` is local/private only. It may be read locally only when needed for development fallback, but its contents must never be printed, logged, copied into source, committed, documented, tested, or exposed.
- All sensitive configuration must come from environment variables, Cloudflare secrets, Cloudflare Access, or private local files ignored by Git.
- Admin/check-in work must avoid personal data in URLs, logs, tests, GitHub Actions artifacts, screenshots, and documentation.
- Use only the official Airbnb iCal export URL for reservation intake. Do not use Airbnb scraping or undocumented Airbnb APIs.
- Do not automate WhatsApp API messaging in the MVP. Only manual pre-filled WhatsApp links are allowed.
- Run build, tests, and `npm run security:scan` before opening a pull request.
- Use sanitized fixtures only. Never test with real iCal exports, real guest names, real phone numbers, real reservation URLs, or real documents.
- Keep uploaded documents private. They must never be stored in public directories or exposed through public URLs.
