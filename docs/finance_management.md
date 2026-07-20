# Finance Management

## Architecture

The protected finance application is available at `/admin/finances/`. Its API is under `/api/finance/*` and uses a dedicated Cloudflare D1 binding named `VILLA_LAURA_FINANCE`. Guest check-in records and private documents remain isolated in the existing private R2 bucket; finance collaborators never use the check-in document APIs.

Finance values use integer euro cents. Percentages use basis points, and Riccardo hours use integer minutes. Each booking stores its own hourly, laundry, and commission rate snapshots. Payments and allocations are separate from accrued expenses so a payment affects cash and the payable without reducing operating profit twice.

All finance responses and admin HTML use private `no-store` caching. Finance mutations require same-origin requests, validate all editable fields on the server, and write an audit event. Records are voided rather than deleted.

## D1 Setup And Migrations

Create a private D1 database through the Cloudflare dashboard or Wrangler, without committing its database identifier. Bind it to the Pages project as `VILLA_LAURA_FINANCE` in both Preview and Production settings.

Apply migrations before deploying code that uses them:

```bash
npx --yes wrangler@3.114.15 d1 execute <private-database-name> --remote --file migrations/0001_finance.sql
```

For local migration testing:

```bash
npm run finance:migrate:local
```

This command generates an isolated temporary local binding, runs the migration twice, and cleans up. The migration creates settings, extensible expense categories, bookings, expenses, payments, allocations, sync metadata, and audit events. It uses only additive `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `INSERT OR IGNORE` operations.

Start Pages locally with the D1 binding:

```bash
npm run build
npx --yes wrangler@3.114.15 pages dev dist --compatibility-date=2026-05-02 --d1 VILLA_LAURA_FINANCE=local-finance
```

## Cloudflare Access Roles

Keep `/admin*`, `/api/admin*`, and `/api/finance*` behind Cloudflare Access. The application validates the Access JWT when strict Access settings are present and maps authenticated email addresses through private environment configuration:

- `ALLOWED_ADMIN_EMAILS`: owners/main administrators;
- `FINANCE_COLLABORATOR_EMAILS`: finance-only collaborators.

Both values are comma-separated Cloudflare Pages secrets and must never be committed. Add the same people to the corresponding Cloudflare Access allow policy. To add or remove Riccardo later, update `FINANCE_COLLABORATOR_EMAILS` privately and update the Access policy, then redeploy so the Pages environment receives the changed secret.

Owners can use every admin and finance API and manage settings. Finance Collaborators can view and operate finance records and reports. The existing `/api/admin/*` handler separately requires the `owner` role, so collaborators receive `403` for guest submissions, identity documents, R2 objects, and unrelated admin operations.

## iCal Reconciliation

The existing admin iCal import continues to write operational reservations to private R2. When `VILLA_LAURA_FINANCE` is bound, the same sync also:

- upserts genuine reservations by iCal UID;
- excludes calendar blocks;
- snapshots current default rates on first creation;
- preserves all manually entered financial fields, payments, expenses, and notes;
- preserves manually overridden dates and flags a changed iCal date for review;
- reconciles one unambiguous spreadsheet/manual record with matching dates;
- leaves ambiguous matches untouched and audits them;
- marks disappeared events `removed_from_calendar` without deleting history;
- records sync counts, outcome, timestamp, and audit events.

Run the same sync repeatedly to verify idempotency.

## Historical Spreadsheet Import

The importer reads the workbook directly from an external path. The workbook must never be copied into the repository. Dry-run is the default and routine output contains counts, spreadsheet row numbers for exceptions, and formula field names only—never guest names or individual values.

```bash
npm run finance:import -- --file "/external/private/Aluguel Riccardo.xlsx"
```

To reconcile against a migrated D1 database without applying changes:

```bash
npm run finance:import -- --file "/external/private/Aluguel Riccardo.xlsx" --database <private-database-name> --remote
```

After reviewing a clean dry-run, add `--apply`. The importer uses deterministic spreadsheet identifiers, matches an existing booking only when the date range has one candidate, refuses ambiguous imports, validates every legacy formula against application calculations, writes audit/sync events, and submits a single D1 SQL file batch. The temporary SQL file is mode `0600`, lives outside the repository, is not printed, and is removed in a `finally` block.

## Accounting Definitions

- Booking reimbursable extras = hours cost + booking purchases + laundry + other reimbursable amounts.
- Riccardo accrued = booking reimbursable extras + commission + property expenses paid by Riccardo and marked reimbursable.
- Operating profit = booking revenue − booking Riccardo accruals − all incurred property expenses.
- Cash position = booking cash received − owner/other property expenses actually paid − payments actually made to Riccardo.
- Overall Riccardo outstanding = total accrued − total non-voided payments. Booking-level outstanding uses payment allocations.

An unallocated payment still reduces the overall payable and cash, while remaining available for later booking or expense allocation.
