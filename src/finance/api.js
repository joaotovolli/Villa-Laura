import { FinanceValidationError, assertDateOnly, assertInteger, calculateBooking, centsFromDecimal, minutesFromHours, nightsBetween } from "./core.js";
import { FinanceRepository } from "./repository.js";
import { randomId } from "../checkin/security.js";
import {
  AttachmentValidationError,
  MAX_ATTACHMENT_BYTES,
  contentDisposition,
  financeObjectKey,
  financeObjectPrefix,
  publicAttachment,
  validateAttachmentFile
} from "./attachments.js";

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store, max-age=0", ...headers }
});

const csv = (body, filename) => new Response(body, {
  headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff"
  }
});

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvRows = (columns, records) => [columns.map(([header]) => csvCell(header)).join(","), ...records.map((record) => columns.map(([, getter]) => csvCell(getter(record))).join(","))].join("\r\n");

const sameOrigin = (request) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (!origin || origin === url.origin) && (!fetchSite || ["same-origin", "none"].includes(fetchSite));
};

const textValue = (value, field, max = 2000, { required = false } = {}) => {
  const output = String(value ?? "").trim();
  if ((required && !output) || output.length > max) throw new FinanceValidationError(`${field} is invalid`, [field]);
  return output;
};

const moneyValue = (value, field) => {
  if (Number.isSafeInteger(value)) return assertInteger(value, field);
  return assertInteger(centsFromDecimal(value ?? "0", field), field);
};

const integerValue = (value, field, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return assertInteger(parsed, field, { max });
};

const booleanValue = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on";

const bookingInput = (body, { partial = false } = {}) => {
  const output = {};
  const field = (name, transform) => {
    if (!partial || body[name] !== undefined) output[name] = transform(body[name]);
  };
  field("title", (value) => textValue(value, "title", 180, { required: !partial }));
  field("bookingReference", (value) => textValue(value, "bookingReference", 100));
  field("source", (value) => textValue(value || "Manual", "source", 80, { required: true }));
  field("checkIn", (value) => assertDateOnly(value, "checkIn"));
  field("checkOut", (value) => assertDateOnly(value, "checkOut"));
  field("status", (value) => {
    const allowed = new Set(["active", "confirmed", "completed", "cancelled", "removed_from_calendar", "needs_review"]);
    const result = textValue(value || "active", "status", 40);
    if (!allowed.has(result)) throw new FinanceValidationError("status is invalid", ["status"]);
    return result;
  });
  field("guests", (value) => integerValue(value ?? 0, "guests", 100));
  field("revenueCents", (value) => moneyValue(value, "revenueCents"));
  field("revenueReceivedCents", (value) => moneyValue(value, "revenueReceivedCents"));
  field("revenueReceivedDate", (value) => assertDateOnly(value, "revenueReceivedDate", { optional: true }));
  field("riccardoMinutes", (value) => integerValue(value ?? 0, "riccardoMinutes", 24 * 60 * 366));
  if (body.riccardoHours !== undefined) output.riccardoMinutes = minutesFromHours(body.riccardoHours);
  if (body.hourlyRateCents !== undefined) output.hourlyRateCents = moneyValue(body.hourlyRateCents, "hourlyRateCents");
  if (body.laundryRateCents !== undefined) output.laundryRateCents = moneyValue(body.laundryRateCents, "laundryRateCents");
  if (body.commissionBps !== undefined) output.commissionBps = integerValue(body.commissionBps, "commissionBps", 10_000);
  field("purchasesDescription", (value) => textValue(value, "purchasesDescription", 1000));
  field("purchasesCents", (value) => moneyValue(value, "purchasesCents"));
  field("otherReimbursableCents", (value) => moneyValue(value, "otherReimbursableCents"));
  field("notes", (value) => textValue(value, "notes", 5000));
  field("manualDateOverride", booleanValue);
  if (body.version !== undefined) output.version = integerValue(body.version, "version");
  if (!partial) nightsBetween(output.checkIn, output.checkOut);
  else if (output.checkIn && output.checkOut) nightsBetween(output.checkIn, output.checkOut);
  return output;
};

const expenseInput = (body, { partial = false } = {}) => {
  const output = {};
  const field = (name, transform) => {
    if (!partial || body[name] !== undefined) output[name] = transform(body[name]);
  };
  field("expenseDate", (value) => assertDateOnly(value, "expenseDate"));
  field("categoryId", (value) => textValue(value, "categoryId", 80, { required: true }));
  field("description", (value) => textValue(value, "description", 500, { required: true }));
  field("supplier", (value) => textValue(value, "supplier", 180));
  field("amountCents", (value) => moneyValue(value, "amountCents"));
  field("currency", (value) => {
    const currency = textValue(value || "EUR", "currency", 3, { required: true }).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new FinanceValidationError("currency is invalid", ["currency"]);
    return currency;
  });
  field("incurredStatus", (value) => {
    const status = textValue(value || "incurred", "incurredStatus", 30);
    if (!["planned", "incurred", "void"].includes(status)) throw new FinanceValidationError("incurredStatus is invalid", ["incurredStatus"]);
    return status;
  });
  field("paymentStatus", (value) => {
    const status = textValue(value || "unpaid", "paymentStatus", 30);
    if (!["unpaid", "partially_paid", "paid"].includes(status)) throw new FinanceValidationError("paymentStatus is invalid", ["paymentStatus"]);
    return status;
  });
  field("paymentDate", (value) => assertDateOnly(value, "paymentDate", { optional: true }));
  field("paymentMethod", (value) => textValue(value, "paymentMethod", 100));
  field("paidBy", (value) => {
    const paidBy = textValue(value || "owner", "paidBy", 30);
    if (!["owner", "riccardo", "other"].includes(paidBy)) throw new FinanceValidationError("paidBy is invalid", ["paidBy"]);
    return paidBy;
  });
  field("bookingId", (value) => textValue(value, "bookingId", 100));
  field("reimbursableToRiccardo", booleanValue);
  field("notes", (value) => textValue(value, "notes", 5000));
  if (body.version !== undefined) output.version = integerValue(body.version, "version");
  if (output.reimbursableToRiccardo && output.paidBy && output.paidBy !== "riccardo") {
    throw new FinanceValidationError("Only expenses paid by Riccardo can be reimbursable to him", ["paidBy", "reimbursableToRiccardo"]);
  }
  return output;
};

const allocationInput = (body) => {
  const bookingId = textValue(body.bookingId, "bookingId", 100);
  const expenseId = textValue(body.expenseId, "expenseId", 100);
  if (Boolean(bookingId) === Boolean(expenseId)) throw new FinanceValidationError("Choose one booking or reimbursable expense", ["bookingId", "expenseId"]);
  const amountCents = moneyValue(body.amountCents, "amountCents");
  if (amountCents <= 0) throw new FinanceValidationError("amountCents must be greater than zero", ["amountCents"]);
  return { bookingId, expenseId, amountCents };
};

const paymentInput = (body) => {
  const amountCents = moneyValue(body.amountCents, "amountCents");
  if (amountCents <= 0) throw new FinanceValidationError("amountCents must be greater than zero", ["amountCents"]);
  return {
    paymentDate: assertDateOnly(body.paymentDate, "paymentDate"), amountCents,
    paymentMethod: textValue(body.paymentMethod, "paymentMethod", 100),
    reference: textValue(body.reference, "reference", 180), notes: textValue(body.notes, "notes", 5000),
    idempotencyKey: textValue(body.idempotencyKey, "idempotencyKey", 180, { required: true }),
    allocations: Array.isArray(body.allocations) ? body.allocations.map(allocationInput) : []
  };
};

const queryFilters = (request) => {
  const params = new URL(request.url).searchParams;
  const filters = {
    from: params.get("from") || "",
    to: params.get("to") || "",
    year: params.get("year") || "",
    month: params.get("month") || "",
    status: params.get("status") || "",
    search: params.get("search") || "",
    sort: params.get("sort") || "",
    direction: params.get("direction") || ""
  };
  if (filters.from) assertDateOnly(filters.from, "from");
  if (filters.to) assertDateOnly(filters.to, "to");
  if (filters.year && !/^\d{4}$/.test(filters.year)) throw new FinanceValidationError("year is invalid", ["year"]);
  if (filters.month && (!/^\d{1,2}$/.test(filters.month) || Number(filters.month) < 1 || Number(filters.month) > 12)) throw new FinanceValidationError("month is invalid", ["month"]);
  return filters;
};

const bodyJson = async (request) => {
  if (!String(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    throw new FinanceValidationError("JSON request body required");
  }
  return request.json();
};

const attachmentDescription = (value) => textValue(value, "description", 500);

const attachmentHeaders = (attachment, download) => ({
  "content-type": attachment.mimeType,
  "content-length": String(attachment.sizeBytes),
  "content-disposition": contentDisposition(attachment.displayFilename, download),
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
  "x-robots-tag": "noindex, nofollow, noarchive"
});

const attachmentParentFromPath = (path) => {
  const match = path.match(/^\/finance\/(expenses|payments)\/([^/]+)\/attachments$/);
  if (!match) return null;
  return { parentType: match[1] === "expenses" ? "expense" : "payment", parentId: decodeURIComponent(match[2]) };
};

const uploadAttachment = async (request, env, repo, actor, parentType, parentId) => {
  if (!env.VILLA_LAURA_CHECKINS) return json({ error: "Private evidence storage is not configured" }, 503);
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) throw new AttachmentValidationError("Multipart form data is required", "invalid_content_type");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_ATTACHMENT_BYTES + 1024 * 1024) throw new AttachmentValidationError("The attachment exceeds the 10 MB limit", "file_too_large", 413);
  const form = await request.formData();
  const validated = await validateAttachmentFile(form.get("file"));
  const id = randomId();
  const objectKey = financeObjectKey({ request, env, parentType, parentId, attachmentId: id });
  const reserved = await repo.reserveAttachment({ id, parentType, parentId, objectKey, ...validated, description: attachmentDescription(form.get("description")) }, actor);
  if (reserved.duplicate) return json({ attachment: publicAttachment(reserved.duplicate), duplicate: true });
  if (reserved.reason === "parent_not_found") return json({ error: `${parentType === "expense" ? "Expense" : "Payment"} not found` }, 404);
  if (reserved.reason === "record_limit") return json({ error: "This record already has the maximum of 20 attachments", code: "attachment_record_limit" }, 409);
  if (reserved.reason === "storage_limit") return json({ error: "The 1 GB finance attachment storage ceiling would be exceeded", code: "attachment_storage_limit" }, 409);
  if (reserved.reason === "quarantined_duplicate") return json({ error: "A matching file is awaiting secure storage repair; ask the owner to run the attachment consistency check", code: "attachment_quarantined" }, 409);
  if (!await repo.consumeAttachmentOperation("class_a")) {
    await repo.failAttachmentUpload(id, actor, "operation_budget_exceeded");
    return json({ error: "The monthly finance upload safety budget has been reached", code: "attachment_operation_limit" }, 429);
  }
  let stored = false;
  try {
    await env.VILLA_LAURA_CHECKINS.put(objectKey, validated.bytes, {
      httpMetadata: { contentType: validated.mimeType },
      customMetadata: { attachmentId: id, checksum: validated.checksum }
    });
    stored = true;
    const attachment = await repo.completeAttachmentUpload(id, actor);
    if (!attachment) throw new Error("Attachment activation failed");
    return json({ attachment: publicAttachment(attachment), duplicate: false }, 201);
  } catch {
    let cleanupFailed = false;
    if (stored) {
      try { await env.VILLA_LAURA_CHECKINS.delete(objectKey); } catch { cleanupFailed = true; }
    }
    await repo.failAttachmentUpload(id, actor, cleanupFailed ? "orphan_cleanup_failed" : "failed");
    return json({ error: "The attachment could not be stored safely; retry the file upload", code: cleanupFailed ? "attachment_orphaned" : "attachment_upload_failed" }, 503);
  }
};

const retrieveAttachment = async (request, env, repo, actor, id) => {
  if (!env.VILLA_LAURA_CHECKINS) return json({ error: "Private evidence storage is not configured" }, 503);
  const attachment = await repo.getAttachment(id);
  const params = new URL(request.url).searchParams;
  const requestedParentType = params.get("parentType") || "";
  const requestedParentId = params.get("parentId") || "";
  if (!attachment || requestedParentType !== attachment.parentType || requestedParentId !== attachment.parentId ||
      !["active", "delete_failed"].includes(attachment.status) || !await repo.attachmentParent(attachment.parentType, attachment.parentId)) {
    return json({ error: "Attachment not found" }, 404);
  }
  if (!await repo.consumeAttachmentOperation("class_b")) return json({ error: "The monthly finance download safety budget has been reached" }, 429);
  const object = await env.VILLA_LAURA_CHECKINS.get(attachment.objectKey);
  if (!object) return json({ error: "Attachment not found" }, 404);
  const download = params.get("download") === "1";
  await repo.auditAttachmentAccess(id, actor, download ? "attachment_downloaded" : "attachment_viewed");
  return new Response(object.body, { headers: attachmentHeaders(attachment, download) });
};

const deleteAttachment = async (env, repo, actor, id) => {
  if (!env.VILLA_LAURA_CHECKINS) return json({ error: "Private evidence storage is not configured" }, 503);
  const attachment = await repo.beginAttachmentDeletion(id, actor);
  if (!attachment) return json({ error: "Attachment not found" }, 404);
  try {
    await env.VILLA_LAURA_CHECKINS.delete(attachment.objectKey);
    await repo.completeAttachmentDeletion(id, actor);
    return json({ ok: true });
  } catch {
    await repo.failAttachmentDeletion(id, actor);
    return json({ error: "The attachment could not be deleted from private storage; it is flagged for retry" }, 503);
  }
};

const attachmentConsistency = async (request, env, repo, actor, apply = false) => {
  if (!env.VILLA_LAURA_CHECKINS) return json({ error: "Private evidence storage is not configured" }, 503);
  const prefix = financeObjectPrefix({ request, env });
  const metadata = await repo.attachmentConsistencyRows(prefix);
  const objectKeys = new Set();
  let cursor;
  do {
    if (!await repo.consumeAttachmentOperation("class_a")) return json({ error: "The monthly finance storage safety budget has been reached" }, 429);
    const page = await env.VILLA_LAURA_CHECKINS.list({ prefix, cursor, limit: 1000 });
    for (const object of page.objects || []) if (object.key.startsWith(prefix)) objectKeys.add(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const expected = new Map(metadata.filter((entry) => ["pending", "active", "delete_pending", "delete_failed"].includes(entry.status)).map((entry) => [entry.objectKey, entry]));
  const stalePendingBefore = Date.now() - 15 * 60 * 1000;
  const missing = [...expected.values()].filter((entry) => !objectKeys.has(entry.objectKey) && (entry.status !== "pending" || Date.parse(entry.updatedAt) < stalePendingBefore));
  const orphans = [...objectKeys].filter((key) => !expected.has(key));
  const report = {
    metadataRecords: metadata.length,
    objects: objectKeys.size,
    missingObjects: missing.length,
    orphanObjects: orphans.length,
    invalidParents: metadata.filter((entry) => !entry.validParent).length,
    pendingOrFailed: metadata.filter((entry) => entry.status !== "active" && entry.status !== "deleted").length
  };
  if (!apply) return json({ dryRun: true, report });
  const body = await bodyJson(request);
  if (body.confirm !== "DELETE_ORPHAN_FINANCE_OBJECTS") return json({ error: "Explicit orphan cleanup confirmation is required" }, 400);
  let objectsDeleted = 0;
  let objectDeleteFailures = 0;
  for (const key of orphans) {
    if (!key.startsWith(prefix)) continue;
    try { await env.VILLA_LAURA_CHECKINS.delete(key); objectsDeleted += 1; } catch { objectDeleteFailures += 1; }
  }
  const metadataQuarantined = await repo.quarantineMissingAttachments(missing.map((entry) => entry.id), actor);
  const result = { objectsDeleted, objectDeleteFailures, metadataQuarantined };
  await repo.auditOrphanCleanup(actor, { ...report, ...result });
  return json({ dryRun: false, report, result });
};

const requireOwner = (identity) => identity?.role === "owner";
const canUseFinance = (identity) => ["owner", "finance_collaborator"].includes(identity?.role);

const exportData = async (repo, request) => {
  const params = new URL(request.url).searchParams;
  const type = params.get("type") || "bookings";
  const filters = queryFilters(request);
  if (type === "bookings") {
    const records = await repo.listBookings(filters);
    return csv(csvRows([
      ["id", (r) => r.id], ["source", (r) => r.source], ["booking_reference", (r) => r.bookingReference], ["check_in", (r) => r.checkIn],
      ["check_out", (r) => r.checkOut], ["nights", (r) => r.calculations.nights], ["status", (r) => r.status], ["guests", (r) => r.guests],
      ["revenue_cents", (r) => r.revenueCents], ["revenue_received_cents", (r) => r.revenueReceivedCents], ["riccardo_minutes", (r) => r.riccardoMinutes],
      ["hourly_rate_cents", (r) => r.hourlyRateCents], ["laundry_rate_cents", (r) => r.laundryRateCents], ["commission_bps", (r) => r.commissionBps],
      ["hours_cost_cents", (r) => r.calculations.hoursCostCents], ["laundry_cost_cents", (r) => r.calculations.laundryCostCents],
      ["purchases_cents", (r) => r.purchasesCents], ["other_reimbursable_cents", (r) => r.otherReimbursableCents],
      ["commission_cents", (r) => r.calculations.commissionCents], ["riccardo_accrued_cents", (r) => r.calculations.riccardoAccruedCents],
      ["allocated_payments_cents", (r) => r.calculations.allocatedPaymentsCents], ["riccardo_outstanding_cents", (r) => r.calculations.outstandingCents],
      ["property_expenses_cents", (r) => r.propertyExpensesCents], ["operating_profit_cents", (r) => r.calculations.operatingProfitCents],
      ["net_profit_cents", (r) => r.calculations.netProfitCents], ["profit_per_night_cents", (r) => r.calculations.profitPerNightCents],
      ["origin", (r) => r.origin], ["created_at", (r) => r.createdAt], ["updated_at", (r) => r.updatedAt]
    ], records), "finance-bookings.csv");
  }
  if (type === "expenses") {
    const records = await repo.listExpenses(filters);
    return csv(csvRows([
      ["id", (r) => r.id], ["expense_date", (r) => r.expenseDate], ["category", (r) => r.categoryName], ["description", (r) => r.description],
      ["supplier", (r) => r.supplier], ["amount_cents", (r) => r.amountCents], ["currency", (r) => r.currency], ["incurred_status", (r) => r.incurredStatus],
      ["payment_status", (r) => r.paymentStatus], ["payment_date", (r) => r.paymentDate], ["payment_method", (r) => r.paymentMethod],
      ["paid_by", (r) => r.paidBy], ["booking_id", (r) => r.bookingId], ["reimbursable_to_riccardo", (r) => r.reimbursableToRiccardo],
      ["allocated_payments_cents", (r) => r.allocatedPaymentsCents], ["attachment_count", (r) => r.attachmentCount], ["evidence_available", (r) => r.hasEvidence],
      ["created_at", (r) => r.createdAt], ["updated_at", (r) => r.updatedAt]
    ], records), "finance-expenses.csv");
  }
  if (type === "payments") {
    const records = await repo.listPayments(filters);
    return csv(csvRows([
      ["id", (r) => r.id], ["payment_date", (r) => r.paymentDate], ["amount_cents", (r) => r.amountCents], ["allocated_cents", (r) => r.allocatedCents],
      ["unallocated_cents", (r) => r.unallocatedCents], ["payment_method", (r) => r.paymentMethod], ["reference", (r) => r.reference],
      ["attachment_count", (r) => r.attachmentCount], ["evidence_available", (r) => r.hasEvidence], ["created_at", (r) => r.createdAt]
    ], records), "finance-payments.csv");
  }
  if (type === "allocations") {
    const records = await repo.listAllocations();
    return csv(csvRows([
      ["id", (r) => r.id], ["payment_id", (r) => r.paymentId], ["booking_id", (r) => r.bookingId], ["expense_id", (r) => r.expenseId], ["amount_cents", (r) => r.amountCents], ["created_at", (r) => r.createdAt]
    ], records), "finance-payment-allocations.csv");
  }
  if (type === "monthly") {
    const year = filters.year || new Date().getUTCFullYear();
    const records = await repo.monthlyReport(year);
    return csv(csvRows([
      ["year", () => year], ["month", (r) => r.month], ["booking_revenue_cents", (r) => r.revenueCents], ["riccardo_accrued_cents", (r) => r.riccardoAccruedCents],
      ["riccardo_paid_cents", (r) => r.riccardoPaidCents], ["other_property_expenses_cents", (r) => r.propertyExpensesCents],
      ["operating_profit_cents", (r) => r.operatingProfitCents], ["cash_position_cents", (r) => r.cashPositionCents], ["occupied_nights", (r) => r.occupiedNights]
    ], records), `finance-monthly-${year}.csv`);
  }
  throw new FinanceValidationError("Unknown export type", ["type"]);
};

export const handleFinanceRequest = async (request, path, env, identity) => {
  try {
    if (!identity) return json({ error: "Authentication required" }, 401);
    if (!canUseFinance(identity)) return json({ error: "Finance access required" }, 403);
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) return json({ error: "Cross-origin request rejected" }, 403);
    if (!env.VILLA_LAURA_FINANCE) return json({ error: "Finance database is not configured" }, 503);
    const repo = new FinanceRepository(env.VILLA_LAURA_FINANCE);
    const actor = identity.email;

    const attachmentParent = attachmentParentFromPath(path);
    if (attachmentParent && request.method === "GET") {
      const attachments = await repo.listAttachments(attachmentParent.parentType, attachmentParent.parentId);
      return attachments ? json({ attachments: attachments.map(publicAttachment) }) : json({ error: `${attachmentParent.parentType === "expense" ? "Expense" : "Payment"} not found` }, 404);
    }
    if (attachmentParent && request.method === "POST") return uploadAttachment(request, env, repo, actor, attachmentParent.parentType, attachmentParent.parentId);
    if (path === "/finance/attachments/consistency" && request.method === "GET") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      return attachmentConsistency(request, env, repo, actor, false);
    }
    if (path === "/finance/attachments/consistency" && request.method === "POST") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      return attachmentConsistency(request, env, repo, actor, true);
    }
    if (path === "/finance/attachments/storage" && request.method === "GET") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      return json({ storage: await repo.attachmentStorageSummary() });
    }
    if (path.match(/^\/finance\/attachments\/[^/]+$/) && request.method === "GET") {
      return retrieveAttachment(request, env, repo, actor, decodeURIComponent(path.split("/").at(-1)));
    }
    if (path.match(/^\/finance\/attachments\/[^/]+$/) && request.method === "PATCH") {
      const attachment = await repo.updateAttachmentDescription(decodeURIComponent(path.split("/").at(-1)), attachmentDescription((await bodyJson(request)).description), actor);
      return attachment ? json({ attachment: publicAttachment(attachment) }) : json({ error: "Attachment not found" }, 404);
    }
    if (path.match(/^\/finance\/attachments\/[^/]+$/) && request.method === "DELETE") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      return deleteAttachment(env, repo, actor, decodeURIComponent(path.split("/").at(-1)));
    }

    if (path === "/finance/session" && request.method === "GET") return json({ authenticated: true, role: identity.role, canManageSettings: requireOwner(identity) });
    if (path === "/finance/dashboard" && request.method === "GET") {
      const filters = queryFilters(request);
      return json({ summary: await repo.summary(filters), monthly: await repo.monthlyReport(filters.year || new Date().getUTCFullYear()), lastSync: await repo.lastSync() });
    }
    if (path === "/finance/bookings" && request.method === "GET") return json({ bookings: await repo.listBookings(queryFilters(request)) });
    if (path === "/finance/bookings" && request.method === "POST") return json({ booking: await repo.createBooking(bookingInput(await bodyJson(request)), actor) }, 201);
    if (path.match(/^\/finance\/bookings\/[^/]+$/) && request.method === "GET") {
      const booking = await repo.getBooking(decodeURIComponent(path.split("/").at(-1)));
      return booking ? json({ booking }) : json({ error: "Booking not found" }, 404);
    }
    if (path.match(/^\/finance\/bookings\/[^/]+$/) && request.method === "PATCH") {
      const id = decodeURIComponent(path.split("/").at(-1));
      const body = await bodyJson(request);
      const booking = await repo.updateBooking(id, bookingInput(body, { partial: true }), actor);
      if (!booking) return json({ error: "Booking not found" }, 404);
      if (booking.conflict) return json({ error: "Booking changed since it was opened; reload and retry" }, 409);
      return json({ booking });
    }
    if (path.match(/^\/finance\/bookings\/[^/]+\/void$/) && request.method === "POST") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      const id = decodeURIComponent(path.split("/").at(-2));
      return (await repo.voidBooking(id, actor)) ? json({ ok: true }) : json({ error: "Booking not found" }, 404);
    }

    if (path === "/finance/categories" && request.method === "GET") return json({ categories: await repo.listCategories() });
    if (path === "/finance/categories" && request.method === "POST") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      const body = await bodyJson(request);
      return json({ category: await repo.createCategory({ name: textValue(body.name, "name", 100, { required: true }), sortOrder: integerValue(body.sortOrder || 500, "sortOrder", 10_000) }, actor) }, 201);
    }
    if (path === "/finance/expenses" && request.method === "GET") return json({ expenses: await repo.listExpenses(queryFilters(request)) });
    if (path === "/finance/expenses" && request.method === "POST") return json({ expense: await repo.createExpense(expenseInput(await bodyJson(request)), actor) }, 201);
    if (path.match(/^\/finance\/expenses\/[^/]+$/) && request.method === "PATCH") {
      const id = decodeURIComponent(path.split("/").at(-1));
      const body = await bodyJson(request);
      const expense = await repo.updateExpense(id, expenseInput(body, { partial: true }), actor);
      if (!expense) return json({ error: "Expense not found" }, 404);
      if (expense.conflict) return json({ error: "Expense changed since it was opened; reload and retry" }, 409);
      return json({ expense });
    }
    if (path.match(/^\/finance\/expenses\/[^/]+\/void$/) && request.method === "POST") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      const id = decodeURIComponent(path.split("/").at(-2));
      return (await repo.voidExpense(id, actor)) ? json({ ok: true }) : json({ error: "Expense not found" }, 404);
    }

    if (path === "/finance/payments" && request.method === "GET") return json({ payments: await repo.listPayments(queryFilters(request)) });
    if (path === "/finance/payments" && request.method === "POST") return json(await repo.createPayment(paymentInput(await bodyJson(request)), actor), 201);
    if (path.match(/^\/finance\/payments\/[^/]+\/allocations$/) && request.method === "POST") {
      const id = decodeURIComponent(path.split("/").at(-2));
      const allocation = await repo.addAllocation(id, allocationInput(await bodyJson(request)), actor);
      return allocation ? json({ allocation }, 201) : json({ error: "Payment not found" }, 404);
    }
    if (path.match(/^\/finance\/payments\/[^/]+\/void$/) && request.method === "POST") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      const id = decodeURIComponent(path.split("/").at(-2));
      return (await repo.voidPayment(id, actor)) ? json({ ok: true }) : json({ error: "Payment not found" }, 404);
    }
    if (path === "/finance/allocations" && request.method === "GET") return json({ allocations: await repo.listAllocations(new URL(request.url).searchParams.get("paymentId") || "") });

    if (path === "/finance/settings" && request.method === "GET") return json({ settings: await repo.getSettings(), readOnly: !requireOwner(identity) });
    if (path === "/finance/settings" && request.method === "PATCH") {
      if (!requireOwner(identity)) return json({ error: "Owner access required" }, 403);
      const body = await bodyJson(request);
      const settings = {
        hourlyRateCents: moneyValue(body.hourlyRateCents, "hourlyRateCents"),
        laundryRateCents: moneyValue(body.laundryRateCents, "laundryRateCents"),
        commissionBps: integerValue(body.commissionBps, "commissionBps", 10_000),
        currency: textValue(body.currency || "EUR", "currency", 3, { required: true }).toUpperCase(),
        reportingMonth: integerValue(body.reportingMonth || 1, "reportingMonth", 12)
      };
      return json({ settings: await repo.updateSettings(settings, actor) });
    }
    if (path === "/finance/reports/monthly" && request.method === "GET") {
      const year = queryFilters(request).year || new Date().getUTCFullYear();
      return json({ year, months: await repo.monthlyReport(year) });
    }
    if (path === "/finance/audit" && request.method === "GET") return json({ events: await repo.listAudit(new URL(request.url).searchParams.get("limit")) });
    if (path === "/finance/sync" && request.method === "GET") return json({ lastSync: await repo.lastSync() });
    if (path === "/finance/export" && request.method === "GET") return exportData(repo, request);
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof FinanceValidationError) return json({ error: error.message, fields: error.fields }, 400);
    if (error instanceof AttachmentValidationError) return json({ error: error.message, code: error.code }, error.status);
    if (String(error?.message || "").includes("UNIQUE constraint failed")) return json({ error: "A matching finance record already exists" }, 409);
    if (String(error?.message || "").includes("FOREIGN KEY constraint failed")) return json({ error: "A related finance record does not exist" }, 400);
    if (String(error?.message || "").includes("Allocation") || String(error?.message || "").includes("allocations")) return json({ error: error.message }, 400);
    return json({ error: "Finance request failed" }, 500);
  }
};

export const __financeApiTest = { bookingInput, expenseInput, paymentInput, allocationInput, queryFilters, sameOrigin };
