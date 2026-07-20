import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import readXlsxFile from "read-excel-file/node";
import { calculateBooking } from "../src/finance/core.js";
import { reconcileSpreadsheetRecords } from "../src/finance/spreadsheet.js";

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};
const has = (name) => args.includes(name);
const spreadsheetPath = valueFor("--file");
const database = valueFor("--database");
const apply = has("--apply");
const remote = has("--remote");

if (!spreadsheetPath) {
  console.error("Usage: npm run finance:import -- --file <external.xlsx> [--database <private-d1-name> --remote] [--apply]");
  process.exit(2);
}
if (apply && !database) {
  console.error("Applying an import requires --database. Dry-run is the default.");
  process.exit(2);
}

const civilDate = (value, field, rowNumber) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`Invalid ${field} at spreadsheet row ${rowNumber}`);
};

const addDays = (date, days) => {
  const timestamp = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(timestamp).toISOString().slice(0, 10);
};

const cents = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid monetary cell");
  return Math.round(value * 100);
};

const minutes = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Invalid hours cell");
  return Math.round(value * 60);
};

const normalized = (value) => String(value || "").normalize("NFKD").replace(/[^a-z0-9]/gi, "").toLowerCase();
const importKeyFor = (record) => `spreadsheet:${createHash("sha256").update(`${record.checkIn}|${record.checkOut}|${normalized(record.title)}`).digest("hex").slice(0, 32)}`;
const sqlValue = (value) => value === null || value === undefined || value === "" ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

const readExisting = () => {
  if (!database) return [];
  const command = ["--yes", "wrangler@3.114.15", "d1", "execute", database, remote ? "--remote" : "--local", "--json", "--command",
    "SELECT id, external_uid, title, check_in, check_out, origin, guests, revenue_cents, riccardo_minutes, hourly_rate_cents, laundry_rate_cents, commission_bps, purchases_cents FROM finance_bookings WHERE voided_at IS NULL"];
  const result = spawnSync("npx", command, { encoding: "utf8", maxBuffer: 20_000_000, env: process.env });
  if (result.status !== 0) throw new Error("Unable to read finance bookings from D1; verify private Wrangler authentication, database name, and migrations");
  const parsed = JSON.parse(result.stdout || "[]");
  const resultSets = Array.isArray(parsed) ? parsed : [parsed];
  return resultSets.flatMap((entry) => entry?.results || entry?.result?.results || []);
};

const rows = await readXlsxFile(spreadsheetPath, { sheet: 1 });
if (rows.length < 5) throw new Error("Spreadsheet does not contain the expected finance rows");
const hourlyRateCents = cents(rows[0]?.[1]);
const laundryRateCents = cents(rows[1]?.[1]);
const commissionBps = 2000;
if (hourlyRateCents <= 0 || laundryRateCents <= 0) throw new Error("Spreadsheet default rate cells are missing or invalid");

const records = [];
const validationMismatches = [];
for (let index = 4; index < rows.length; index += 1) {
  const row = rows[index] || [];
  if (!row[0] && !row[2]) continue;
  const rowNumber = index + 1;
  const title = String(row[0] || "Historical booking").trim();
  const guests = Number(row[1] || 0);
  const checkIn = civilDate(row[2], "booking date", rowNumber);
  const legacyNights = Number(row[3] || 0);
  if (!Number.isInteger(guests) || guests < 0 || !Number.isInteger(legacyNights) || legacyNights < 0) throw new Error(`Invalid guest or night count at spreadsheet row ${rowNumber}`);
  const checkOut = addDays(checkIn, legacyNights);
  const booking = {
    title, checkIn, checkOut, guests, revenueCents: cents(row[4]), riccardoMinutes: minutes(row[5]),
    hourlyRateCents, laundryRateCents, commissionBps, purchasesDescription: String(row[7] || "").trim(),
    purchasesCents: cents(row[8]), otherReimbursableCents: 0, propertyExpensesCents: 0, allocatedPaymentsCents: 0
  };
  const calculated = calculateBooking(booking);
  const comparisons = [
    ["hours cost", calculated.hoursCostCents, row[6]], ["laundry", calculated.laundryCostCents, row[9]],
    ["reimbursable extras", calculated.reimbursableExtrasCents, row[10]], ["commission", calculated.commissionCents, row[11]],
    ["Riccardo accrued", calculated.riccardoAccruedCents, row[12]], ["operating profit", calculated.operatingProfitCents, row[13]],
    ["profit per night", calculated.profitPerNightCents, row[14]]
  ];
  for (const [field, expected, actual] of comparisons) {
    if (actual === null || actual === undefined || actual === "") continue;
    if (Math.abs(Number(expected || 0) - cents(actual)) > 1) validationMismatches.push({ row: rowNumber, field });
  }
  records.push({ ...booking, importKey: importKeyFor(booking), rowNumber });
}

const existing = readExisting();
const { creates, updates, ignored, ambiguous } = reconcileSpreadsheetRecords(records, existing);

const report = {
  mode: apply ? "apply" : "dry-run",
  recordsRead: records.length,
  wouldCreate: creates.length,
  wouldUpdate: updates.length,
  ignored: ignored.length,
  ambiguous: ambiguous.length,
  calculationMismatches: validationMismatches.length,
  rateSnapshot: { hourlyRateCents, laundryRateCents, commissionBps },
  safeDetails: {
    ambiguousRows: ambiguous.map((entry) => ({ row: entry.row, candidateCount: entry.candidateCount })),
    calculationMismatches: validationMismatches
  }
};

if (!apply) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(validationMismatches.length ? 1 : 0);
}
if (ambiguous.length || validationMismatches.length) {
  console.log(JSON.stringify(report, null, 2));
  console.error("Import not applied because ambiguous matches or calculation mismatches require review.");
  process.exit(1);
}

const timestamp = new Date().toISOString();
const actor = "spreadsheet-import";
const statements = [];
for (const record of creates) {
  const id = randomUUID();
  statements.push(`INSERT INTO finance_bookings (id, external_uid, source, title, booking_reference, check_in, check_out, status, origin, guests, revenue_cents, revenue_received_cents, riccardo_minutes, hourly_rate_cents, laundry_rate_cents, commission_bps, purchases_description, purchases_cents, other_reimbursable_cents, notes, created_at, created_by, updated_at, updated_by) VALUES (${sqlValue(id)}, ${sqlValue(record.importKey)}, 'Historical spreadsheet', ${sqlValue(record.title)}, '', ${sqlValue(record.checkIn)}, ${sqlValue(record.checkOut)}, 'completed', 'spreadsheet', ${record.guests}, ${record.revenueCents}, 0, ${record.riccardoMinutes}, ${record.hourlyRateCents}, ${record.laundryRateCents}, ${record.commissionBps}, ${sqlValue(record.purchasesDescription)}, ${record.purchasesCents}, 0, '', ${sqlValue(timestamp)}, ${sqlValue(actor)}, ${sqlValue(timestamp)}, ${sqlValue(actor)});`);
  statements.push(`INSERT INTO finance_audit_events (id, occurred_at, actor, action, entity_type, entity_id, changed_fields, metadata) VALUES (${sqlValue(randomUUID())}, ${sqlValue(timestamp)}, ${sqlValue(actor)}, 'spreadsheet_created', 'booking', ${sqlValue(id)}, '["historicalFinancialValues"]', '{"source":"local_xlsx"}');`);
}
for (const { record, id } of updates) {
  statements.push(`UPDATE finance_bookings SET guests = ${record.guests}, revenue_cents = ${record.revenueCents}, riccardo_minutes = ${record.riccardoMinutes}, hourly_rate_cents = ${record.hourlyRateCents}, laundry_rate_cents = ${record.laundryRateCents}, commission_bps = ${record.commissionBps}, purchases_description = ${sqlValue(record.purchasesDescription)}, purchases_cents = ${record.purchasesCents}, external_uid = COALESCE(external_uid, ${sqlValue(record.importKey)}), updated_at = ${sqlValue(timestamp)}, updated_by = ${sqlValue(actor)}, version = version + 1 WHERE id = ${sqlValue(id)};`);
  statements.push(`INSERT INTO finance_audit_events (id, occurred_at, actor, action, entity_type, entity_id, changed_fields, metadata) VALUES (${sqlValue(randomUUID())}, ${sqlValue(timestamp)}, ${sqlValue(actor)}, 'spreadsheet_reconciled', 'booking', ${sqlValue(id)}, '["historicalFinancialValues"]', '{"source":"local_xlsx"}');`);
}
const runId = randomUUID();
statements.push(`INSERT INTO finance_sync_runs (id, source, status, started_at, completed_at, created_count, updated_count, removed_count, ignored_count, ambiguous_count, actor) VALUES (${sqlValue(runId)}, 'spreadsheet', 'completed', ${sqlValue(timestamp)}, ${sqlValue(timestamp)}, ${creates.length}, ${updates.length}, 0, ${ignored.length}, 0, ${sqlValue(actor)});`);
statements.push(`INSERT INTO finance_audit_events (id, occurred_at, actor, action, entity_type, entity_id, changed_fields, metadata) VALUES (${sqlValue(randomUUID())}, ${sqlValue(timestamp)}, ${sqlValue(actor)}, 'spreadsheet_import', 'sync', ${sqlValue(runId)}, '[]', '{"source":"local_xlsx","created":${creates.length},"updated":${updates.length}}');`);

const tempDirectory = await mkdtemp(path.join(tmpdir(), "villa-laura-finance-"));
const sqlFile = path.join(tempDirectory, "finance-import.sql");
try {
  await writeFile(sqlFile, statements.join("\n"), { encoding: "utf8", mode: 0o600 });
  await chmod(sqlFile, 0o600);
  const command = ["--yes", "wrangler@3.114.15", "d1", "execute", database, remote ? "--remote" : "--local", "--file", sqlFile];
  const result = spawnSync("npx", command, { encoding: "utf8", maxBuffer: 20_000_000, env: process.env });
  if (result.status !== 0) throw new Error("D1 rejected the spreadsheet import batch; no private command output was printed");
  console.log(JSON.stringify({ ...report, applied: true }, null, 2));
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
