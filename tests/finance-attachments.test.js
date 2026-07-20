import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onRequest } from "../functions/api/[[path]].js";
import {
  MAX_ACTIVE_ATTACHMENT_BYTES,
  contentDisposition,
  financeObjectKey,
  validateAttachmentFile
} from "../src/finance/attachments.js";
import { FinanceRepository } from "../src/finance/repository.js";
import { makeD1 } from "./helpers/d1.js";

const migration = `${await readFile("migrations/0001_finance.sql", "utf8")}\n${await readFile("migrations/0002_finance_attachments.sql", "utf8")}`;
const actor = "owner@example.test";
const pdf = (name = "synthetic.pdf") => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], name, { type: "application/pdf" });
const jpeg = (name = "synthetic.jpg") => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00])], name, { type: "image/jpeg" });
const png = (name = "synthetic.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])], name, { type: "image/png" });

class MockR2 {
  constructor() { this.objects = new Map(); this.failPut = false; this.failDelete = false; }
  async put(key, value, options) {
    if (this.failPut) throw new Error("synthetic R2 put failure");
    this.objects.set(key, { bytes: new Uint8Array(value), options });
  }
  async get(key) {
    const found = this.objects.get(key);
    return found ? { body: found.bytes } : null;
  }
  async delete(key) {
    if (this.failDelete) throw new Error("synthetic R2 delete failure");
    this.objects.delete(key);
  }
  async list({ prefix = "" } = {}) {
    return { objects: [...this.objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
  }
}

const makeEnv = async () => ({
  APP_ENV: "production",
  VILLA_LAURA_SITE_URL: "https://villa-laura.it",
  ALLOWED_ADMIN_EMAILS: actor,
  FINANCE_COLLABORATOR_EMAILS: "finance@example.test",
  VILLA_LAURA_FINANCE: await makeD1(migration),
  VILLA_LAURA_CHECKINS: new MockR2()
});

const apiRequest = (path, env, { method = "GET", email = actor, body, headers = {} } = {}) => {
  if (email) headers["cf-access-authenticated-user-email"] = email;
  return onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, { method, headers, body }),
    env,
    params: { path: path.split("?")[0].replace(/^\//, "").split("/") }
  });
};

const createParents = async (env) => {
  const repo = new FinanceRepository(env.VILLA_LAURA_FINANCE);
  const expense = await repo.createExpense({ expenseDate: "2026-08-02", categoryId: "other", description: "Synthetic expense", amountCents: 1000, currency: "EUR", incurredStatus: "incurred", paymentStatus: "paid", paymentDate: "2026-08-02", paymentMethod: "card", paidBy: "owner", reimbursableToRiccardo: false, notes: "" }, actor);
  const payment = (await repo.createPayment({ paymentDate: "2026-08-03", amountCents: 1000, paymentMethod: "transfer", reference: "synthetic", notes: "", idempotencyKey: "synthetic-payment", allocations: [] }, actor)).payment;
  return { repo, expense, payment };
};

const upload = (env, parentType, parentId, file = pdf(), email = actor) => {
  const form = new FormData();
  form.set("file", file);
  form.set("description", "Synthetic evidence");
  const resource = parentType === "expense" ? "expenses" : "payments";
  return apiRequest(`/finance/${resource}/${parentId}/attachments`, env, { method: "POST", email, body: form });
};

test("attachment validation accepts PDF and image signatures and produces SHA-256", async () => {
  for (const file of [pdf(), jpeg(), png()]) {
    const result = await validateAttachmentFile(file);
    assert.equal(result.checksum.length, 64);
    assert.equal(result.sizeBytes, file.size);
  }
});

test("attachment validation rejects unsupported, mismatched, empty, and oversized files", async () => {
  await assert.rejects(() => validateAttachmentFile(new File(["text"], "active.html", { type: "text/html" })), /Only PDF/);
  await assert.rejects(() => validateAttachmentFile(new File(["not pdf"], "fake.pdf", { type: "application/pdf" })), /do not match/);
  await assert.rejects(() => validateAttachmentFile(new File([], "empty.pdf", { type: "application/pdf" })), /must not be empty/);
  await assert.rejects(() => validateAttachmentFile({ name: "large.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1, arrayBuffer: async () => new ArrayBuffer(0) }), /10 MB/);
});

test("expense and payment uploads support multiple private attachments with duplicate prevention", async () => {
  const env = await makeEnv();
  const { repo, expense, payment } = await createParents(env);
  assert.equal((await upload(env, "expense", expense.id, pdf())).status, 201);
  assert.equal((await upload(env, "expense", expense.id, jpeg())).status, 201);
  const repeated = await upload(env, "expense", expense.id, pdf());
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true);
  assert.equal((await repo.listAttachments("expense", expense.id)).length, 2);
  assert.equal((await upload(env, "payment", payment.id, pdf("payment.pdf"))).status, 201);
  assert.equal((await upload(env, "payment", payment.id, png("payment.png"))).status, 201);
  assert.equal((await repo.listAttachments("payment", payment.id)).length, 2);
  const publicList = await (await apiRequest(`/finance/payments/${payment.id}/attachments`, env)).json();
  assert.equal(JSON.stringify(publicList).includes("objectKey"), false);
  assert.equal(JSON.stringify(publicList).includes("finance/evidence"), false);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.size, 4);
});

test("owner and Finance Collaborator can upload and download; unauthorised users are rejected", async () => {
  const env = await makeEnv();
  const { expense } = await createParents(env);
  assert.equal((await upload(env, "expense", expense.id, pdf(), "finance@example.test")).status, 201);
  const listed = await (await apiRequest(`/finance/expenses/${expense.id}/attachments`, env, { email: "finance@example.test" })).json();
  const id = listed.attachments[0].id;
  const path = `/finance/attachments/${id}?parentType=expense&parentId=${expense.id}`;
  const collaboratorDownload = await apiRequest(path, env, { email: "finance@example.test" });
  assert.equal(collaboratorDownload.status, 200);
  assert.match(collaboratorDownload.headers.get("cache-control"), /no-store/);
  assert.equal(collaboratorDownload.headers.get("x-content-type-options"), "nosniff");
  assert.match(collaboratorDownload.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(collaboratorDownload.headers.get("content-disposition"), /^inline;/);
  assert.equal((await apiRequest(path, env, { email: "" })).status, 401);
  assert.equal((await apiRequest(path, env, { email: "outsider@example.test" })).status, 401);
  assert.equal((await apiRequest(`/finance/attachments/${id}`, env, { method: "DELETE", email: "finance@example.test" })).status, 403);
});

test("cross-record requests and arbitrary R2 keys cannot retrieve finance or guest objects", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  const other = await repo.createExpense({ expenseDate: "2026-08-04", categoryId: "other", description: "Other synthetic", amountCents: 100, currency: "EUR", incurredStatus: "incurred", paymentStatus: "unpaid", paidBy: "owner", reimbursableToRiccardo: false, notes: "" }, actor);
  await upload(env, "expense", expense.id);
  const attachment = (await repo.listAttachments("expense", expense.id))[0];
  assert.equal((await apiRequest(`/finance/attachments/${attachment.id}?parentType=expense&parentId=${other.id}`, env)).status, 404);
  assert.equal((await apiRequest("/finance/attachments/checkins%2Fsubmissions%2Fprivate-document", env)).status, 404);
  assert.equal((await apiRequest("/admin/document?token=test&guestId=test&filename=test", env, { email: "finance@example.test" })).status, 403);
});

test("safe content disposition prevents filename header injection", () => {
  const value = contentDisposition("receipt\r\nX-Evil: yes.pdf", true);
  assert.match(value, /^attachment;/);
  assert.equal(value.includes("\r"), false);
  assert.equal(value.includes("\n"), false);
});

test("attachment deletion removes the object, retains metadata, and writes audit events", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  await upload(env, "expense", expense.id);
  const attachment = (await repo.listAttachments("expense", expense.id))[0];
  const deleted = await apiRequest(`/finance/attachments/${attachment.id}`, env, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.size, 0);
  assert.equal((await repo.getAttachment(attachment.id)).status, "deleted");
  assert.equal((await repo.listAudit()).some((event) => event.action === "attachment_deleted"), true);
  assert.equal((await apiRequest(`/finance/attachments/${attachment.id}?parentType=expense&parentId=${expense.id}`, env)).status, 404);
});

test("R2 deletion failure leaves recoverable metadata and an audit event", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  await upload(env, "expense", expense.id);
  const attachment = (await repo.listAttachments("expense", expense.id))[0];
  env.VILLA_LAURA_CHECKINS.failDelete = true;
  const response = await apiRequest(`/finance/attachments/${attachment.id}`, env, { method: "DELETE" });
  assert.equal(response.status, 503);
  assert.equal((await repo.getAttachment(attachment.id)).status, "delete_failed");
  assert.equal((await repo.listAudit()).some((event) => event.action === "attachment_deletion_failed"), true);
});

test("R2 upload failure releases active storage and records a safe failure", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  env.VILLA_LAURA_CHECKINS.failPut = true;
  const response = await upload(env, "expense", expense.id);
  assert.equal(response.status, 503);
  assert.equal((await repo.attachmentStorageSummary()).bytes, 0);
  assert.equal((await repo.listAudit()).some((event) => event.action === "attachment_upload_failed"), true);
});

test("metadata activation failure cleans up the uploaded object and avoids a false active record", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  const base = env.VILLA_LAURA_FINANCE;
  let failActivation = true;
  env.VILLA_LAURA_FINANCE = {
    ...base,
    prepare: base.prepare.bind(base),
    batch: async (statements) => {
      if (failActivation && statements.some((statement) => statement.sql.includes("status = 'active'"))) {
        failActivation = false;
        throw new Error("synthetic activation failure");
      }
      return base.batch(statements);
    }
  };
  const response = await upload(env, "expense", expense.id);
  assert.equal(response.status, 503);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.size, 0);
  assert.equal((await repo.attachmentStorageSummary()).bytes, 0);
});

test("consistency dry run detects only finance-prefix orphans and cleanup is explicit", async () => {
  const env = await makeEnv();
  const { expense } = await createParents(env);
  await upload(env, "expense", expense.id);
  env.VILLA_LAURA_CHECKINS.objects.set("finance/evidence/production/expenses/orphan/object", { bytes: new Uint8Array([1]) });
  env.VILLA_LAURA_CHECKINS.objects.set("checkins/submissions/private/document", { bytes: new Uint8Array([1]) });
  const dryRun = await apiRequest("/finance/attachments/consistency", env);
  const report = await dryRun.json();
  assert.equal(dryRun.status, 200);
  assert.equal(report.dryRun, true);
  assert.equal(report.report.orphanObjects, 1);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.has("checkins/submissions/private/document"), true);
  const noConfirmation = await apiRequest("/finance/attachments/consistency", env, { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } });
  assert.equal(noConfirmation.status, 400);
  const cleanup = await apiRequest("/finance/attachments/consistency", env, { method: "POST", body: JSON.stringify({ confirm: "DELETE_ORPHAN_FINANCE_OBJECTS" }), headers: { "content-type": "application/json" } });
  assert.equal(cleanup.status, 200);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.has("finance/evidence/production/expenses/orphan/object"), false);
  assert.equal(env.VILLA_LAURA_CHECKINS.objects.has("checkins/submissions/private/document"), true);
});

test("object keys are opaque, environment-separated, and exclude filenames", () => {
  const production = financeObjectKey({ request: new Request("https://villa-laura.it/api/finance"), env: { APP_ENV: "production", VILLA_LAURA_SITE_URL: "https://villa-laura.it" }, parentType: "expense", parentId: "opaque-parent", attachmentId: "opaque-attachment" });
  const preview = financeObjectKey({ request: new Request("https://preview.pages.dev/api/finance"), env: { APP_ENV: "production", VILLA_LAURA_SITE_URL: "https://villa-laura.it" }, parentType: "expense", parentId: "opaque-parent", attachmentId: "opaque-attachment" });
  assert.match(production, /^finance\/evidence\/production\/expenses\//);
  assert.match(preview, /^finance\/evidence\/preview\/expenses\//);
  assert.equal(production.includes("receipt"), false);
  assert.notEqual(production, preview);
});

test("storage summary exposes only aggregate ceiling information", async () => {
  const env = await makeEnv();
  const owner = await apiRequest("/finance/attachments/storage", env);
  const collaborator = await apiRequest("/finance/attachments/storage", env, { email: "finance@example.test" });
  assert.equal(owner.status, 200);
  assert.equal((await owner.json()).storage.limitBytes, MAX_ACTIVE_ATTACHMENT_BYTES);
  assert.equal(collaborator.status, 403);
});

test("repository enforces 20 attachments per record and the 1 GB active ceiling", async () => {
  const env = await makeEnv();
  const { repo, expense } = await createParents(env);
  for (let index = 0; index < 20; index += 1) {
    const checksum = index.toString(16).padStart(64, "0");
    const result = await repo.reserveAttachment({ id: `limit-${index}`, parentType: "expense", parentId: expense.id, objectKey: `finance/evidence/production/expenses/${expense.id}/limit-${index}`, originalFilename: "synthetic.pdf", displayFilename: "synthetic.pdf", mimeType: "application/pdf", extension: "pdf", sizeBytes: 1, checksum, description: "" }, actor);
    assert.ok(result.attachment);
  }
  const recordLimit = await repo.reserveAttachment({ id: "limit-21", parentType: "expense", parentId: expense.id, objectKey: `finance/evidence/production/expenses/${expense.id}/limit-21`, originalFilename: "synthetic.pdf", displayFilename: "synthetic.pdf", mimeType: "application/pdf", extension: "pdf", sizeBytes: 1, checksum: "f".repeat(64), description: "" }, actor);
  assert.equal(recordLimit.reason, "record_limit");

  const timestamp = new Date().toISOString();
  const statements = Array.from({ length: 102 }, (_, index) => env.VILLA_LAURA_FINANCE.prepare(`INSERT INTO finance_attachments
    (id, parent_type, expense_id, object_key, original_filename, display_filename, mime_type, file_extension, size_bytes, sha256, status, uploaded_by, uploaded_at, updated_at)
    VALUES (?, 'expense', ?, ?, 'synthetic.pdf', 'synthetic.pdf', 'application/pdf', 'pdf', 10485760, ?, 'active', ?, ?, ?)`)
    .bind(`storage-${index}`, expense.id, `finance/evidence/production/expenses/${expense.id}/storage-${index}`, (index + 1000).toString(16).padStart(64, "0"), actor, timestamp, timestamp));
  await env.VILLA_LAURA_FINANCE.batch(statements);
  const another = await repo.createExpense({ expenseDate: "2026-08-05", categoryId: "other", description: "Ceiling parent", amountCents: 100, currency: "EUR", incurredStatus: "incurred", paymentStatus: "unpaid", paidBy: "owner", reimbursableToRiccardo: false, notes: "" }, actor);
  const storageLimit = await repo.reserveAttachment({ id: "over-storage", parentType: "expense", parentId: another.id, objectKey: `finance/evidence/production/expenses/${another.id}/over-storage`, originalFilename: "synthetic.pdf", displayFilename: "synthetic.pdf", mimeType: "application/pdf", extension: "pdf", sizeBytes: 5 * 1024 * 1024, checksum: "e".repeat(64), description: "" }, actor);
  assert.equal(storageLimit.reason, "storage_limit");
});

test("finance-only monthly R2 operation budgets fail closed", async () => {
  const env = await makeEnv();
  const repo = new FinanceRepository(env.VILLA_LAURA_FINANCE);
  const period = new Date().toISOString().slice(0, 7);
  await env.VILLA_LAURA_FINANCE.prepare("INSERT INTO finance_attachment_usage (period, class_a_operations, class_b_operations, updated_at) VALUES (?, 100000, 1000000, ?)").bind(period, new Date().toISOString()).run();
  assert.equal(await repo.consumeAttachmentOperation("class_a"), false);
  assert.equal(await repo.consumeAttachmentOperation("class_b"), false);
});
