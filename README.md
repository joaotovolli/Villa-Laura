# Remote Operations Platform for Short-Term Rental Management

## Overview

This repository contains a lightweight digital operations and guest-support layer for a short-term rental property managed through a hybrid remote and on-site operating model.

The platform is designed to support remote administration from London while giving the local operator and guests a clear, structured reference point for day-to-day use. It is intentionally simple: a static website that centralises practical information, embedded video instructions, support links, and core operational guidance without introducing unnecessary system complexity.

This is not a booking engine. Reservations remain on external booking platforms. The site exists to reduce operational friction around the stay itself.

## Problem / Objective

Remote property management creates predictable operational issues:

- guest questions repeat across stays
- key instructions are easily buried in chat threads
- local coordination can become informal and inconsistent
- support depends too heavily on ad hoc messaging

The objective of this project is to provide a low-maintenance digital support layer that improves structured information delivery for guests and reduces avoidable operational noise for the remote owner and local co-host.

## Operational Model

- Remote owner: oversees the digital layer, content structure, and overall operating model
- Local operator / co-host: handles on-site execution and can use the site as a consistent reference point
- Guests: access self-service guidance for the most common questions and in-stay tasks

The site is designed to sit between booking platforms and day-to-day operations, not replace either of them.

## Key Features

- Mobile-first static guest-support website
- Dedicated guide page for each video instruction
- Embedded YouTube walkthroughs for common in-stay tasks
- Structured house information and operational guidance
- Clear support and booking-platform calls to action
- Multilingual interface support
- Simple content update model driven by a single configuration file
- Image optimisation during build for lightweight delivery
- Secure digital check-in MVP at `/checkin`
- Private admin MVP at `/admin` with Airbnb iCal import and Cloudflare Pages Functions backend

## Technology

- Static site architecture
- JavaScript with a Node-based build step
- Vanilla CSS and minimal client-side JavaScript
- `sharp` for image processing and optimisation
- Cloudflare Pages as the primary hosting target
- GitHub for version control and repository management
- GitHub Actions workflow available for GitHub Pages deployment

## Design Principles

- Clarity over complexity
- Low-maintenance operation
- Mobile-first usability
- Structured self-service support
- Simple editing model for future updates
- Alignment between digital tooling and real-world operating constraints

## My Role

I defined the scope, structured the content model, implemented the static site, and aligned the digital layer with the practical needs of remote management, local operational support, and guest usability.

This included information architecture, build pipeline implementation, content structuring, multilingual support, image handling, deployment setup, and repository hygiene.

## What This Project Demonstrates

- Translating an operational problem into a practical digital solution
- End-to-end ownership across scope, implementation, deployment, and maintenance
- Systems thinking under real-world constraints
- Designing for non-technical end users without overengineering
- Balancing simplicity, maintainability, and user clarity

## Local Development

Requirements:

- Node.js 18+

Run locally:

```bash
npm install
npm run build
npm run preview
```

Primary editable files:

- `site.config.json` for content, links, video metadata, and gallery source selection
- `assets/source/` for curated original images
- `src/styles.css` for styling
- `src/app.js` for lightweight client-side behaviour
- `scripts/build.mjs` for static site generation

## Deployment

Primary deployment target:

- Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`

The repository also includes a GitHub Actions workflow for GitHub Pages deployment:

- [deploy-github-pages.yml](.github/workflows/deploy-github-pages.yml)

The build process generates:

- `dist/` as the production output
- `docs/` as a GitHub Pages-compatible mirror

## Security / Repository Hygiene

- Credentials, local notes, and private operational reference files are excluded from version control
- Sensitive operational details are not stored in the repository
- Public repository content is limited to source code, build configuration, and safe static assets
- Guest data, uploaded identity documents, private iCal URLs, and local check-in data must never be committed
- Run `npm run security:scan` before opening a pull request
- Check-in architecture and operations are documented in [docs/checkin_mvp.md](docs/checkin_mvp.md), [docs/security_privacy.md](docs/security_privacy.md), and [docs/cloudflare_setup.md](docs/cloudflare_setup.md)

## Possible Future Enhancements

- More structured operational content beyond core guest guidance
- Expanded guide-page content and richer troubleshooting notes
- Additional multilingual refinement
- Lightweight analytics for content usage patterns
- Further reduction of repeated support flows through better self-service pathways
