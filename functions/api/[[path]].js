import { parseAirbnbIcal } from "../../src/checkin/ical.js";
import { getCloudflareAccessIdentity, passwordFallbackEnabled } from "../../src/checkin/admin-auth.js";
import { allowedDocumentType, randomId, randomToken, sanitizeFilename, signValue, verifySignedValue } from "../../src/checkin/security.js";
import { CheckinStorage, keys } from "../../src/checkin/storage.js";
import { publicSubmission, validateSubmission } from "../../src/checkin/validation.js";

const SESSION_COOKIE = "vl_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const loginAttempts = new Map();

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });

const text = (body, init = {}) =>
  new Response(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });

const securityHeaders = (response) => {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
};

const routePath = (context) => `/${(context.params.path || []).join("/")}`.replace(/\/+$/, "") || "/";

const envSecret = (env, name) => {
  const value = env[name];
  if (!value && env.APP_ENV === "production") throw new Error(`Missing required secret: ${name}`);
  return value || `local-development-${name}-change-me`;
};

const cookieMap = (request) =>
  Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key, value]) => key && value)
  );

const getAdminIdentity = async (request, env) => {
  const accessIdentity = await getCloudflareAccessIdentity(request, env);
  if (accessIdentity) return accessIdentity;

  if (!passwordFallbackEnabled(env)) return null;

  const cookie = cookieMap(request)[SESSION_COOKIE];
  if (!cookie) return null;
  const value = await verifySignedValue(decodeURIComponent(cookie), envSecret(env, "ADMIN_SESSION_SECRET"));
  if (!value) return null;
  const session = JSON.parse(value);
  if (Date.now() > session.expiresAt) return null;
  return { email: session.email || "admin", method: "password" };
};

const requireAdmin = async (request, env) => {
  const identity = await getAdminIdentity(request, env);
  if (!identity) return { response: json({ error: "Authentication required" }, { status: 401 }) };
  return { identity };
};

const setSessionCookie = async (email, env) => {
  const payload = JSON.stringify({ email, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
  const signed = await signValue(payload, envSecret(env, "ADMIN_SESSION_SECRET"));
  const secure = env.APP_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(signed)}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
};

const readPrivateIcalUrl = async (env) => {
  if (env.AIRBNB_ICAL_URL) return env.AIRBNB_ICAL_URL;
  if (env.APP_ENV === "production") return "";
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const candidates = [
      path.join(process.cwd(), "Doc_Keys_Villa_Laura.txt"),
      path.join(process.cwd(), "..", "Doc_Keys_Villa_Laura.txt")
    ];
    for (const candidate of candidates) {
      try {
        const privateText = await fs.readFile(candidate, "utf8");
        const match = privateText.match(/https?:\/\/[^\s"'<>]+\.ics[^\s"'<>]*/i);
        if (match) return match[0];
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  } catch {
    return "";
  }
  return "";
};

const siteUrl = (request, env) => env.VILLA_LAURA_SITE_URL || new URL(request.url).origin;

const makeMessage = (reservation, link) => {
  const greeting = reservation.guestName
    ? `Hello ${reservation.guestName}, this is Joao from Villa Laura.`
    : "Hello, this is Joao from Villa Laura.";
  return `${greeting}\n\nTo prepare your arrival and complete the required Italian guest registration, please complete the secure online check-in form here:\n\n${link}\n\nThank you,\nJoao\nVilla Laura`;
};

const normalizeStatus = (status, fallback = "imported") => {
  if (status === "imported_from_airbnb") return "imported";
  return status || fallback;
};

const listReservations = async (storage) => {
  const reservations = (await storage.listJson("checkins/reservations/")).filter(Boolean);
  const tokens = (await storage.listJson("checkins/tokens/")).filter(Boolean);
  const submissions = (await storage.listJson("checkins/submissions/")).filter(Boolean);
  const tokenByUid = new Map(tokens.map((entry) => [entry.reservationUid, entry]));
  const submissionByToken = new Map(submissions.filter((entry) => entry.token).map((entry) => [entry.token, entry]));
  return reservations
    .map((reservation) => {
      const token = tokenByUid.get(reservation.uid);
      return {
        ...reservation,
        status: normalizeStatus(reservation.status, reservation.type === "blocked" ? "blocked" : "imported"),
        token: token?.token || "",
        tokenStatus: token?.status || "",
        tokenCreatedAt: token?.createdAt || reservation.tokenCreatedAt || "",
        tokenExpiresAt: token?.expiresAt || "",
        checkinSubmitted: token ? submissionByToken.has(token.token) : false,
        documentsDeletedAt: reservation.documentsDeletedAt || ""
      };
    })
    .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));
};

const syncIcal = async (request, env, storage, identity) => {
  const icalUrl = await readPrivateIcalUrl(env);
  if (!icalUrl) return json({ error: "Airbnb iCal URL is not configured" }, { status: 400 });
  const response = await fetch(icalUrl, { headers: { accept: "text/calendar" } });
  if (!response.ok) return json({ error: "Unable to fetch Airbnb calendar" }, { status: 502 });
  const events = parseAirbnbIcal(await response.text());
  let created = 0;
  let updated = 0;
  for (const event of events) {
    const key = keys.reservation(event.uid);
    const existing = await storage.getJson(key);
    const now = new Date().toISOString();
    const merged = {
      ...(existing || {}),
      ...event,
      guestName: existing?.guestName || "",
      fullPhone: existing?.fullPhone || "",
      email: existing?.email || "",
      preferredLanguage: existing?.preferredLanguage || "en",
      numberOfGuests: existing?.numberOfGuests || "",
      arrivalTime: existing?.arrivalTime || "",
      source: existing?.source || event.source || "Airbnb",
      notes: existing?.notes || "",
      status: existing?.status && existing.status !== "blocked" ? normalizeStatus(existing.status) : event.status,
      importedAt: existing?.importedAt || now,
      updatedAt: now
    };
    await storage.putJson(key, merged);
    existing ? updated += 1 : created += 1;
  }
  await storage.audit({ type: "ical_sync", actor: identity.email, details: { created, updated, total: events.length } });
  return json({ created, updated, total: events.length });
};

const updateReservation = async (request, storage, identity) => {
  const body = await request.json();
  const existing = await storage.getJson(keys.reservation(body.uid));
  if (!existing) return json({ error: "Reservation not found" }, { status: 404 });
  const allowedStatus = new Set([
    "imported",
    "waiting_for_guest",
    "checkin_sent",
    "pending_review",
    "approved",
    "rejected",
    "submitted_to_alloggiati",
    "submitted_to_ross1000",
    "documents_deleted",
    "blocked"
  ]);
  const next = {
    ...existing,
    guestName: String(body.guestName || ""),
    fullPhone: String(body.fullPhone || "").replace(/[^\d+]/g, ""),
    email: String(body.email || "").trim(),
    preferredLanguage: String(body.preferredLanguage || "en"),
    numberOfGuests: body.numberOfGuests ? Math.max(1, Math.min(16, Number.parseInt(body.numberOfGuests, 10) || 1)) : "",
    arrivalTime: String(body.arrivalTime || "").slice(0, 40),
    source: String(body.source || existing.source || "Airbnb").slice(0, 60),
    notes: String(body.notes || ""),
    status: allowedStatus.has(body.status) ? body.status : normalizeStatus(existing.status, existing.type === "blocked" ? "blocked" : "imported"),
    reviewedAt: body.status === "pending_review" ? new Date().toISOString() : existing.reviewedAt || "",
    approvedAt: body.status === "approved" ? new Date().toISOString() : existing.approvedAt || "",
    rejectedAt: body.status === "rejected" ? new Date().toISOString() : existing.rejectedAt || "",
    submittedToAlloggiatiAt: body.status === "submitted_to_alloggiati" ? new Date().toISOString() : existing.submittedToAlloggiatiAt || "",
    submittedToRoss1000At: body.status === "submitted_to_ross1000" ? new Date().toISOString() : existing.submittedToRoss1000At || "",
    updatedAt: new Date().toISOString()
  };
  await storage.putJson(keys.reservation(next.uid), next);
  await storage.audit({ type: "reservation_updated", actor: identity.email, reservationUid: next.uid });
  return json({ ok: true, reservation: next });
};

const createToken = async (request, env, storage, identity) => {
  const { uid } = await request.json();
  const reservation = await storage.getJson(keys.reservation(uid));
  if (!reservation || reservation.type !== "reservation") return json({ error: "Reservation not found" }, { status: 404 });
  const token = randomToken("vl");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();
  const link = `${siteUrl(request, env).replace(/\/$/, "")}/checkin?token=${encodeURIComponent(token)}`;
  const record = { token, reservationUid: uid, status: "created", createdAt: now, expiresAt };
  await storage.putJson(keys.token(token), record);
  await storage.putJson(keys.reservation(uid), {
    ...reservation,
    status: "waiting_for_guest",
    tokenCreatedAt: now,
    updatedAt: now
  });
  await storage.audit({ type: "token_created", actor: identity.email, reservationUid: uid, tokenId: token.slice(0, 10) });
  return json({ token, tokenStatus: "created", expiresAt, link, message: makeMessage(reservation, link) });
};

const getPublicToken = async (request, storage) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  const record = await storage.getJson(keys.token(token));
  if (!record || ["disabled", "expired"].includes(record.status) || Date.parse(record.expiresAt) < Date.now()) {
    return json({ error: "Invalid or expired check-in link" }, { status: 404 });
  }
  const reservation = await storage.getJson(keys.reservation(record.reservationUid));
  return json({
    token,
    reservation: {
      checkIn: reservation?.checkIn || "",
      checkOut: reservation?.checkOut || "",
      nights: reservation?.nights || 0,
      guestName: reservation?.guestName || ""
    }
  });
};

const submitCheckin = async (request, storage) => {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const record = await storage.getJson(keys.token(token));
  if (!record || ["disabled", "expired"].includes(record.status) || Date.parse(record.expiresAt) < Date.now()) {
    return json({ error: "Invalid or expired check-in link" }, { status: 404 });
  }
  const numberOfGuests = Number.parseInt(form.get("numberOfGuests"), 10);
  const guests = [];
  for (let index = 0; index < numberOfGuests; index += 1) {
    guests.push({
      id: `guest-${index + 1}`,
      firstName: String(form.get(`guest_${index}_firstName`) || ""),
      lastName: String(form.get(`guest_${index}_lastName`) || ""),
      dateOfBirth: String(form.get(`guest_${index}_dateOfBirth`) || ""),
      placeOfBirth: String(form.get(`guest_${index}_placeOfBirth`) || ""),
      citizenship: String(form.get(`guest_${index}_citizenship`) || ""),
      gender: String(form.get(`guest_${index}_gender`) || ""),
      documentType: String(form.get(`guest_${index}_documentType`) || ""),
      documentNumber: String(form.get(`guest_${index}_documentNumber`) || ""),
      documentIssuingCountry: String(form.get(`guest_${index}_documentIssuingCountry`) || ""),
      documentExpiryDate: String(form.get(`guest_${index}_documentExpiryDate`) || "")
    });
  }
  const submission = publicSubmission({
    arrivalDate: form.get("arrivalDate"),
    departureDate: form.get("departureDate"),
    numberOfGuests,
    mainGuestEmail: form.get("mainGuestEmail"),
    mainGuestPhone: form.get("mainGuestPhone"),
    privacyAccepted: form.get("privacyAccepted"),
    guests
  });
  const validation = validateSubmission(submission);
  if (!validation.ok) return json({ error: "Please check the required fields", fields: validation.errors }, { status: 400 });

  const documents = [];
  for (let index = 0; index < numberOfGuests; index += 1) {
    const file = form.get(`guest_${index}_documentUpload`);
    if (file && file.size > 0) {
      if (file.size > 8 * 1024 * 1024 || !allowedDocumentType(file)) {
        return json({ error: "Invalid document upload" }, { status: 400 });
      }
      const safeName = `${randomId()}-${sanitizeFilename(file.name)}`;
      await storage.putBytes(keys.document(token, `guest-${index + 1}`, safeName), file, file.type);
      documents.push({ guestId: `guest-${index + 1}`, filename: safeName, originalName: sanitizeFilename(file.name), size: file.size, type: file.type });
    }
  }
  const now = new Date().toISOString();
  await storage.putJson(keys.submission(token), { ...submission, token, reservationUid: record.reservationUid, documents, submittedAt: now });
  await storage.putJson(keys.token(token), { ...record, status: "submitted", submittedAt: now });
  const reservation = await storage.getJson(keys.reservation(record.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(record.reservationUid), { ...reservation, status: "pending_review", submittedAt: now, updatedAt: now });
  }
  await storage.audit({ type: "checkin_submitted", actor: "guest", reservationUid: record.reservationUid, tokenId: token.slice(0, 10) });
  return json({ ok: true, message: "Check-in submitted securely. Thank you." });
};

const getSubmission = async (request, storage) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  return json({ submission });
};

const getDocument = async (request, storage, identity) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const guestId = url.searchParams.get("guestId") || "";
  const filename = url.searchParams.get("filename") || "";
  const submission = await storage.getJson(keys.submission(token));
  const allowed = submission?.documents?.some((doc) => doc.guestId === guestId && doc.filename === filename);
  if (!allowed) return json({ error: "Document not found" }, { status: 404 });
  const object = await storage.getObject(keys.document(token, guestId, filename));
  if (!object) return json({ error: "Document not found" }, { status: 404 });
  const headers = new Headers({ "cache-control": "no-store", "content-disposition": `attachment; filename="${sanitizeFilename(filename)}"` });
  object.writeHttpMetadata?.(headers);
  await storage.audit({ type: "document_viewed", actor: identity.email, reservationUid: submission.reservationUid, tokenId: token.slice(0, 10) });
  return new Response(object.body, { headers });
};

const deleteDocuments = async (request, storage, identity) => {
  const { token } = await request.json();
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  for (const doc of submission.documents || []) {
    await storage.delete(keys.document(token, doc.guestId, doc.filename));
  }
  const now = new Date().toISOString();
  await storage.putJson(keys.submission(token), { ...submission, documentsDeletedAt: now, documents: [] });
  const reservation = await storage.getJson(keys.reservation(submission.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(submission.reservationUid), {
      ...reservation,
      status: "documents_deleted",
      documentsDeletedAt: now,
      updatedAt: now
    });
  }
  await storage.audit({ type: "documents_deleted", actor: identity.email, reservationUid: submission.reservationUid, tokenId: token.slice(0, 10) });
  return json({ ok: true, documentsDeletedAt: now });
};

const handleAdmin = async (context, path, storage) => {
  const { request, env } = context;
  if (path === "/admin/session") {
    const identity = await getAdminIdentity(request, env);
    return json({
      authenticated: Boolean(identity),
      identity,
      passwordFallbackEnabled: passwordFallbackEnabled(env)
    });
  }
  if (path === "/admin/login" && request.method === "POST") {
    if (!passwordFallbackEnabled(env)) {
      return json({ error: "Cloudflare Access authentication required" }, { status: 403 });
    }
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const attempts = loginAttempts.get(ip) || { count: 0, reset: Date.now() + 600000 };
    if (attempts.count >= 8 && attempts.reset > Date.now()) return json({ error: "Too many attempts" }, { status: 429 });
    const body = await request.json();
    if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
      loginAttempts.set(ip, { count: attempts.count + 1, reset: attempts.reset });
      await storage.audit({ type: "failed_admin_login", actor: "unknown" });
      return json({ error: "Invalid login" }, { status: 401 });
    }
    loginAttempts.delete(ip);
    await storage.audit({ type: "admin_login", actor: "admin" });
    return json({ ok: true }, { headers: { "set-cookie": await setSessionCookie("admin", env) } });
  }
  if (path === "/admin/logout" && request.method === "POST") {
    return json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` } });
  }

  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (path === "/admin/sync" && request.method === "POST") return syncIcal(request, env, storage, auth.identity);
  if (path === "/admin/reservations" && request.method === "GET") return json({ reservations: await listReservations(storage) });
  if (path === "/admin/reservations" && request.method === "PATCH") return updateReservation(request, storage, auth.identity);
  if (path === "/admin/token" && request.method === "POST") return createToken(request, env, storage, auth.identity);
  if (path === "/admin/submission" && request.method === "GET") return getSubmission(request, storage);
  if (path === "/admin/document" && request.method === "GET") return getDocument(request, storage, auth.identity);
  if (path === "/admin/documents/delete" && request.method === "POST") return deleteDocuments(request, storage, auth.identity);
  return json({ error: "Not found" }, { status: 404 });
};

export const onRequest = async (context) => {
  try {
    const path = routePath(context);
    const storage = new CheckinStorage(context.env);
    let response;
    if (path === "/checkin/token" && context.request.method === "GET") response = await getPublicToken(context.request, storage);
    else if (path === "/checkin/submit" && context.request.method === "POST") response = await submitCheckin(context.request, storage);
    else response = await handleAdmin(context, path, storage);
    return securityHeaders(response);
  } catch (error) {
    return securityHeaders(json({ error: "Request failed" }, { status: 500 }));
  }
};
