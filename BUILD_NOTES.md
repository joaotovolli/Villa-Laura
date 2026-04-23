# Build Notes

## Assumptions Made

- The site should be single-page and English-first
- The site is for guest support, not reservations or payments
- WhatsApp is the preferred support channel during stays
- Airbnb remains the booking destination
- Cloudflare Pages is the intended deployment target when deployment access is available
- A compact, high-quality gallery is better than using every local photo

## Resources Found

Extracted from the local key document without copying any secrets into the repo:

- Site name: `Villa Laura`
- Airbnb link: `https://airbnb.co.uk/h/villa-laura-sardinia`
- WhatsApp: `+39 351 4830318`
- YouTube channel: `https://www.youtube.com/@Villa-Laura`
- 11 YouTube guide videos with titles and descriptions
- Local house photos in `/mnt/c/codex/Villa_Laura/Airbnb/Pics`

## What I Completed

- Normalised the repo locally onto a standard `main` working branch
- Built a polished static first version of the site
- Added a structured content file for easy editing
- Embedded all available YouTube guide videos
- Added WhatsApp, Airbnb, and YouTube calls to action
- Curated four public-safe photos and set up image optimisation during build
- Added a Cloudflare Pages friendly static output and headers file
- Added repository safety rules in `.gitignore`
- Wrote a README with update and deployment instructions

## What Could Not Be Completed Automatically

- Full Cloudflare Pages deployment from this terminal environment
- Cloudflare account verification through CLI tooling
- Automatic HEIC conversion from the local photo folder because no HEIC conversion tools were installed
- Final public-domain cutover testing

## Deployment Constraints

- Current environment has Node 18, which was enough for this project build
- Current environment did not have Cloudflare API credentials available for non-interactive deployment
- Earlier readiness checks showed `https://villa-laura.it` returning Cloudflare `525`, which suggests the current live setup is tied to an unhealthy origin; Cloudflare Pages would avoid that complexity

## Exact Final Deployment Steps

### GitHub

1. Push the finished `main` branch to GitHub
2. Set `main` as the default branch in GitHub
3. Delete the old temporary `access-check-20260423` branch after `main` is live

### Cloudflare Pages

1. Create a new Pages project connected to `joaotovolli/Villa-Laura`
2. Select the production branch: `main`
3. Set build command to `npm run build`
4. Set build output directory to `dist`
5. Add the custom domain `villa-laura.it`
6. Add `www.villa-laura.it` only if desired
7. Confirm DNS records point to Pages rather than a separate origin
8. Once Pages is serving correctly, the previous `525` origin issue should no longer matter

## Notes For Future Iteration

- Add more written house information only if it improves guest clarity
- Curate and convert selected HEIC images later if stronger gallery coverage is needed
- If multilingual support is desired, the content structure can be extended without changing the basic architecture
