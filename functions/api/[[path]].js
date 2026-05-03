import { parseAirbnbIcal } from "../../src/checkin/ical.js";
import { getCloudflareAccessIdentity, passwordFallbackEnabled } from "../../src/checkin/admin-auth.js";
import { allowedDocumentType, randomId, randomToken, sanitizeFilename, signValue, verifySignedValue } from "../../src/checkin/security.js";
import { CheckinStorage, keys } from "../../src/checkin/storage.js";
import { publicSubmission, validateSubmission } from "../../src/checkin/validation.js";
import { buildLocalizedGuestMessage, normalizeLanguage } from "../../src/checkin/i18n.js";

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
      "content-type": "text/plain; charset=utf-8",
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

const sameOriginAdminRequest = (request) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (origin && origin !== url.origin) return false;
  if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) return false;
  return true;
};

const edgeProtectedAdminIdentity = (request, env) => {
  if (env.APP_ENV !== "production") return null;
  if (!env.CF_ACCESS_TEAM_DOMAIN && !env.CF_ACCESS_AUD) return null;
  if (!sameOriginAdminRequest(request)) return null;
  return { email: "cloudflare-access-edge", method: "cloudflare_access_edge_protected" };
};

const getAdminIdentity = async (request, env) => {
  const accessIdentity = await getCloudflareAccessIdentity(request, env);
  if (accessIdentity) return accessIdentity;
  const edgeIdentity = edgeProtectedAdminIdentity(request, env);
  if (edgeIdentity) return edgeIdentity;

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

const makeMessage = (reservation, link) => buildLocalizedGuestMessage(reservation, link);

const normalizeStatus = (status, fallback = "imported") => {
  if (status === "imported_from_airbnb") return "imported";
  return status || fallback;
};

const inactiveTokenStatuses = new Set(["disabled", "expired", "revoked"]);

const activeTokens = (tokens) =>
  tokens
    .filter((token) => token?.token && token?.reservationUid && !inactiveTokenStatuses.has(token.status))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

const activeTokenForReservation = async (storage, uid) => {
  const tokens = activeTokens((await storage.listJson("checkins/tokens/")).filter(Boolean));
  return tokens.find((token) => token.reservationUid === uid) || null;
};

const linkForToken = (request, env, token) => `${siteUrl(request, env).replace(/\/$/, "")}/checkin?token=${encodeURIComponent(token)}`;

const publicDocument = (doc = {}) => ({
  guestId: doc.guestId || "",
  originalName: doc.originalName || "document",
  size: doc.size || 0,
  type: doc.type || ""
});

const manualReviewExport = (submission, reservation = {}) => ({
  label: "Structured export for manual review",
  purpose: "Pre-export data for Alloggiati/ROSS1000 preparation",
  reservation: {
    uid: submission.reservationUid || reservation.uid || "",
    source: reservation.source || "",
    reservationCode: reservation.reservationCode || "",
    checkIn: reservation.checkIn || submission.arrivalDate || "",
    checkOut: reservation.checkOut || submission.departureDate || "",
    nights: reservation.nights || 0,
    status: reservation.status || submission.status || ""
  },
  submission: {
    status: submission.status || "",
    submittedAt: submission.submittedAt || "",
    draftSavedAt: submission.draftSavedAt || "",
    privacyAccepted: Boolean(submission.privacyAccepted),
    arrivalDate: submission.arrivalDate || "",
    departureDate: submission.departureDate || "",
    numberOfGuests: submission.numberOfGuests || 0,
    adults: submission.adults || 0,
    minors: submission.minors || 0,
    infants: submission.infants || 0,
    mainGuestEmail: submission.mainGuestEmail || "",
    mainGuestPhone: submission.mainGuestPhone || ""
  },
  exportReadyView: {
    primaryGuests: (submission.guests || []).filter((guest) => ["single_guest", "head_of_family", "head_of_group"].includes(guest.guestType)),
    members: (submission.guests || []).filter((guest) => ["family_member", "group_member"].includes(guest.guestType)),
    adults: (submission.guests || []).filter((guest) => guest.ageCategory === "adult"),
    minors: (submission.guests || []).filter((guest) => guest.ageCategory === "minor"),
    infants: (submission.guests || []).filter((guest) => guest.ageCategory === "infant")
  },
  guests: (submission.guests || []).map((guest) => ({
    id: guest.id || "",
    ageCategory: guest.ageCategory || "",
    guestType: guest.guestType || "",
    relationshipRole: guest.relationshipRole || "",
    responsibleGuestId: guest.responsibleGuestId || "",
    documentAvailable: Boolean(guest.documentAvailable),
    firstName: guest.firstName || "",
    lastName: guest.lastName || "",
    gender: guest.gender || "",
    dateOfBirth: guest.dateOfBirth || "",
    placeOfBirth: guest.placeOfBirth || "",
    citizenship: guest.citizenship || "",
    documentType: guest.documentType || "",
    documentNumber: guest.documentNumber || "",
    documentIssuingCountry: guest.documentIssuingCountry || "",
    documentExpiryDate: guest.documentExpiryDate || ""
  })),
  documents: (submission.documents || []).map(publicDocument),
  deletion: {
    documentsDeletedAt: submission.documentsDeletedAt || "",
    personalDataDeletedAt: submission.personalDataDeletedAt || "",
    resetAt: submission.resetAt || ""
  }
});

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const exportToCsv = (exportData) => {
  const columns = [
    "reservation_uid",
    "reservation_code",
    "arrival_date",
    "departure_date",
    "guest_id",
    "age_category",
    "guest_type",
    "relationship_role",
    "responsible_guest_id",
    "first_name",
    "last_name",
    "gender",
    "date_of_birth",
    "place_of_birth",
    "citizenship",
    "document_available",
    "document_type",
    "document_number",
    "document_issuing_country",
    "document_expiry_date",
    "document_count_for_guest"
  ];
  const documentCounts = new Map();
  for (const doc of exportData.documents) documentCounts.set(doc.guestId, (documentCounts.get(doc.guestId) || 0) + 1);
  const rows = exportData.guests.map((guest) =>
    [
      exportData.reservation.uid,
      exportData.reservation.reservationCode,
      exportData.submission.arrivalDate,
      exportData.submission.departureDate,
      guest.id,
      guest.ageCategory,
      guest.guestType,
      guest.relationshipRole,
      guest.responsibleGuestId,
      guest.firstName,
      guest.lastName,
      guest.gender,
      guest.dateOfBirth,
      guest.placeOfBirth,
      guest.citizenship,
      guest.documentAvailable ? "yes" : "no",
      guest.documentType,
      guest.documentNumber,
      guest.documentIssuingCountry,
      guest.documentExpiryDate,
      documentCounts.get(guest.id) || 0
    ].map(csvCell).join(",")
  );
  return [columns.join(","), ...rows].join("\n");
};

const listReservations = async (storage) => {
  const reservations = (await storage.listJson("checkins/reservations/")).filter(Boolean);
  const tokens = (await storage.listJson("checkins/tokens/")).filter(Boolean);
  const submissions = (await storage.listJson("checkins/submissions/")).filter(Boolean);
  const tokenByUid = new Map(activeTokens(tokens).map((entry) => [entry.reservationUid, entry]));
  const submissionByToken = new Map(submissions.filter((entry) => entry.token).map((entry) => [entry.token, entry]));
  return reservations
    .map((reservation) => {
      const token = tokenByUid.get(reservation.uid);
      const submission = token ? submissionByToken.get(token.token) : null;
      const isDraft = submission?.status === "draft_saved" || token?.status === "draft_saved";
      const isFinal = Boolean(submission && !isDraft);
      return {
        ...reservation,
        status: normalizeStatus(reservation.status, reservation.type === "blocked" ? "blocked" : "imported"),
        token: token?.token || "",
        tokenStatus: token?.status || "",
        tokenCreatedAt: token?.createdAt || reservation.tokenCreatedAt || "",
        tokenExpiresAt: token?.expiresAt || "",
        checkinSubmitted: isFinal,
        draftSaved: isDraft,
        draftSavedAt: submission?.draftSavedAt || token?.draftSavedAt || reservation.draftSavedAt || "",
        submissionStatus: submission ? (isDraft ? "draft_saved" : submission.personalDataDeletedAt ? "data_redacted" : submission.status || "pending_review") : "",
        submittedAt: isFinal ? submission?.submittedAt || "" : "",
        submittedGuests: submission?.numberOfGuests || 0,
        submittedAdults: submission?.adults || 0,
        submittedMinors: submission?.minors || 0,
        submittedInfants: submission?.infants || 0,
        documentCount: submission?.documents?.length || 0,
        documentsPresent: Boolean(submission?.documents?.length),
        documentsDeletedAt: submission?.documentsDeletedAt || reservation.documentsDeletedAt || "",
        personalDataDeletedAt: submission?.personalDataDeletedAt || ""
      };
    })
    .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));
};

const syncIcal = async (request, env, storage, identity) => {
  const diagnostics = {
    icalUrlConfigured: false,
    fetchedIcal: false,
    parsedEvents: 0,
    reservations: 0,
    blockedDates: 0,
    storageWriteSuccess: false,
    storageReadbackSuccess: false
  };
  const icalUrl = await readPrivateIcalUrl(env);
  diagnostics.icalUrlConfigured = Boolean(icalUrl);
  if (!icalUrl) return json({ error: "Airbnb iCal URL is not configured", diagnostics }, { status: 400 });
  let response;
  try {
    response = await fetch(icalUrl, { headers: { accept: "text/calendar" } });
  } catch {
    return json({ error: "Unable to fetch Airbnb calendar", diagnostics }, { status: 502 });
  }
  diagnostics.fetchedIcal = response.ok;
  if (!response.ok) return json({ error: "Unable to fetch Airbnb calendar", diagnostics }, { status: 502 });
  const events = parseAirbnbIcal(await response.text());
  diagnostics.parsedEvents = events.length;
  diagnostics.reservations = events.filter((event) => event.type === "reservation").length;
  diagnostics.blockedDates = events.filter((event) => event.type === "blocked").length;
  let created = 0;
  let updated = 0;
  const writtenKeys = [];
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
      preferredLanguage: normalizeLanguage(existing?.preferredLanguage || "en"),
      numberOfGuests: existing?.numberOfGuests || "",
      adults: existing?.adults || "",
      minors: existing?.minors || "",
      infants: existing?.infants || "",
      arrivalTime: existing?.arrivalTime || "",
      source: existing?.source || event.source || "Airbnb",
      notes: existing?.notes || "",
      status: existing?.status && existing.status !== "blocked" ? normalizeStatus(existing.status) : event.status,
      importedAt: existing?.importedAt || now,
      updatedAt: now
    };
    await storage.putJson(key, merged);
    writtenKeys.push(key);
    existing ? updated += 1 : created += 1;
  }
  diagnostics.storageWriteSuccess = true;
  if (writtenKeys.length) {
    diagnostics.storageReadbackSuccess = Boolean(await storage.getJson(writtenKeys[0]));
  } else {
    diagnostics.storageReadbackSuccess = true;
  }
  await storage.audit({ type: "ical_sync", actor: identity.email, details: { created, updated, total: events.length } });
  return json({ created, updated, total: events.length, diagnostics });
};

const updateReservation = async (request, storage, identity) => {
  const body = await request.json();
  const existing = await storage.getJson(keys.reservation(body.uid));
  if (!existing) return json({ error: "Reservation not found" }, { status: 404 });
  if (existing.type === "blocked") {
    const next = {
      ...existing,
      type: "blocked",
      status: "blocked",
      guestName: "",
      fullPhone: "",
      email: "",
      preferredLanguage: "",
      numberOfGuests: "",
      arrivalTime: "",
      notes: "",
      updatedAt: new Date().toISOString()
    };
    await storage.putJson(keys.reservation(next.uid), next);
    await storage.audit({ type: "blocked_item_reset", actor: identity.email, reservationUid: next.uid });
    return json({ ok: true, reservation: next });
  }
  const allowedStatus = new Set([
    "imported",
    "waiting_for_guest",
    "checkin_sent",
    "draft_saved",
    "pending_review",
    "approved",
    "rejected",
    "submitted_to_alloggiati",
    "submitted_to_ross1000",
    "documents_deleted",
    "data_redacted"
  ]);
  const next = {
    ...existing,
    guestName: String(body.guestName || ""),
    fullPhone: String(body.fullPhone || "").replace(/[^\d+]/g, ""),
    email: String(body.email || "").trim(),
    preferredLanguage: normalizeLanguage(body.preferredLanguage || "en"),
    adults: Math.max(1, Math.min(16, Number.parseInt(body.adults || body.numberOfGuests, 10) || 1)),
    minors: Math.max(0, Math.min(16, Number.parseInt(body.minors, 10) || 0)),
    infants: Math.max(0, Math.min(16, Number.parseInt(body.infants, 10) || 0)),
    numberOfGuests: Math.max(1, Math.min(48, (Number.parseInt(body.adults || body.numberOfGuests, 10) || 1) + (Number.parseInt(body.minors, 10) || 0) + (Number.parseInt(body.infants, 10) || 0))),
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
  const existingToken = await activeTokenForReservation(storage, uid);
  if (existingToken) {
    const link = linkForToken(request, env, existingToken.token);
    const language = normalizeLanguage(reservation.preferredLanguage || existingToken.language || "en");
    return json({
      token: existingToken.token,
      tokenStatus: existingToken.status || "created",
      expiresAt: existingToken.expiresAt || "",
      link,
      language,
      existing: true,
      message: makeMessage({ ...reservation, preferredLanguage: language }, link)
    });
  }
  const token = randomToken("vl");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();
  const link = linkForToken(request, env, token);
  const language = normalizeLanguage(reservation.preferredLanguage || "en");
  const record = {
    token,
    reservationUid: uid,
    checkIn: reservation.checkIn || "",
    checkOut: reservation.checkOut || "",
    nights: reservation.nights || 0,
    language,
    source: reservation.source || "",
    adults: reservation.adults || reservation.numberOfGuests || 1,
    minors: reservation.minors || 0,
    infants: reservation.infants || 0,
    status: "created",
    createdAt: now,
    expiresAt
  };
  await storage.putJson(keys.token(token), record);
  await storage.putJson(keys.reservation(uid), {
    ...reservation,
    status: "waiting_for_guest",
    tokenCreatedAt: now,
    updatedAt: now
  });
  await storage.audit({ type: "token_created", actor: identity.email, reservationUid: uid, tokenId: token.slice(0, 10) });
  return json({ token, tokenStatus: "created", expiresAt, link, language, message: makeMessage({ ...reservation, preferredLanguage: language }, link) });
};

const regenerateToken = async (request, env, storage, identity) => {
  const { uid } = await request.json();
  const reservation = await storage.getJson(keys.reservation(uid));
  if (!reservation || reservation.type !== "reservation") return json({ error: "Reservation not found" }, { status: 404 });
  const now = new Date().toISOString();
  const existingTokens = activeTokens((await storage.listJson("checkins/tokens/")).filter(Boolean)).filter((entry) => entry.reservationUid === uid);
  for (const existingToken of existingTokens) {
    await storage.putJson(keys.token(existingToken.token), { ...existingToken, status: "disabled", disabledAt: now, replacedAt: now });
  }
  const token = randomToken("vl");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();
  const link = linkForToken(request, env, token);
  const language = normalizeLanguage(reservation.preferredLanguage || "en");
  const record = {
    token,
    reservationUid: uid,
    checkIn: reservation.checkIn || "",
    checkOut: reservation.checkOut || "",
    nights: reservation.nights || 0,
    language,
    source: reservation.source || "",
    adults: reservation.adults || reservation.numberOfGuests || 1,
    minors: reservation.minors || 0,
    infants: reservation.infants || 0,
    status: "created",
    createdAt: now,
    expiresAt
  };
  await storage.putJson(keys.token(token), record);
  await storage.putJson(keys.reservation(uid), {
    ...reservation,
    status: "waiting_for_guest",
    tokenCreatedAt: now,
    tokenRegeneratedAt: now,
    updatedAt: now
  });
  await storage.audit({ type: "token_regenerated", actor: identity.email, reservationUid: uid, tokenId: token.slice(0, 10), details: { disabled: existingTokens.length } });
  return json({ token, tokenStatus: "created", expiresAt, link, language, disabledPreviousTokens: existingTokens.length, message: makeMessage({ ...reservation, preferredLanguage: language }, link) });
};

const getPublicToken = async (request, storage) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  const record = await storage.getJson(keys.token(token));
  if (!record || ["disabled", "expired"].includes(record.status) || Date.parse(record.expiresAt) < Date.now()) {
    return json({ error: "Invalid or expired check-in link" }, { status: 404 });
  }
  const reservation = await storage.getJson(keys.reservation(record.reservationUid));
  const draft = await storage.getJson(keys.submission(token));
  const safeDraft = draft?.status === "draft_saved"
    ? {
        status: draft.status,
        savedAt: draft.draftSavedAt || "",
        language: normalizeLanguage(draft.language || ""),
        arrivalDate: draft.arrivalDate || "",
        departureDate: draft.departureDate || "",
        numberOfGuests: draft.numberOfGuests || 1,
        adults: draft.adults || 1,
        minors: draft.minors || 0,
        infants: draft.infants || 0,
        mainGuestEmail: draft.mainGuestEmail || "",
        mainGuestPhone: draft.mainGuestPhone || "",
        guests: draft.guests || [],
        documents: (draft.documents || []).map((doc) => ({
          guestId: doc.guestId,
          originalName: doc.originalName || "document",
          size: doc.size || 0,
          type: doc.type || ""
        }))
      }
    : null;
  const language = normalizeLanguage(reservation?.preferredLanguage || record.language || "en");
  return json({
    token,
    language: safeDraft?.language || language,
    draft: safeDraft,
    reservation: {
      checkIn: reservation?.checkIn || record.checkIn || "",
      checkOut: reservation?.checkOut || record.checkOut || "",
      nights: reservation?.nights || record.nights || 0,
      language,
      source: reservation?.source || record.source || "",
      adults: reservation?.adults || record.adults || reservation?.numberOfGuests || 1,
      minors: reservation?.minors || record.minors || 0,
      infants: reservation?.infants || record.infants || 0,
      guestName: reservation?.guestName || ""
    }
  });
};

const parseCheckinForm = async (request) => {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const numberOfGuests = Number.parseInt(form.get("numberOfGuests"), 10);
  const adults = Number.parseInt(form.get("adults"), 10);
  const minors = Number.parseInt(form.get("minors"), 10) || 0;
  const infants = Number.parseInt(form.get("infants"), 10) || 0;
  const guests = [];
  for (let index = 0; index < numberOfGuests; index += 1) {
    const ageCategory = String(form.get(`guest_${index}_ageCategory`) || (index === 0 ? "adult" : "adult"));
    const documentAvailable = form.get(`guest_${index}_documentAvailable`) !== "no";
    guests.push({
      id: `guest-${index + 1}`,
      ageCategory,
      guestType: String(form.get(`guest_${index}_guestType`) || (index === 0 ? (numberOfGuests > 1 ? "head_of_family" : "single_guest") : "family_member")),
      relationshipRole: String(form.get(`guest_${index}_relationshipRole`) || (index === 0 ? "main_guest" : "family_member")),
      responsibleGuestId: String(form.get(`guest_${index}_responsibleGuestId`) || ""),
      documentAvailable,
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
    adults,
    minors,
    infants,
    mainGuestEmail: form.get("mainGuestEmail"),
    mainGuestPhone: form.get("mainGuestPhone"),
    privacyAccepted: form.get("privacyAccepted"),
    guests
  });
  submission.language = normalizeLanguage(form.get("language") || "en");
  return { form, token, numberOfGuests, guests, submission };
};

const storeUploadedDocuments = async ({ form, storage, token, numberOfGuests, existingDocuments = [], strict = false, guests = [] }) => {
  const documents = [...existingDocuments];
  const warnings = [];
  for (let index = 0; index < numberOfGuests; index += 1) {
    const guestId = `guest-${index + 1}`;
    const file = form.get(`guest_${index}_documentUpload`);
    if (strict && guests[index]?.ageCategory === "adult" && !documents.some((doc) => doc.guestId === guestId) && (!file || file.size <= 0)) {
      return { error: "Please check the required fields", fields: [`guests.${index}.documentUpload`], documents };
    }
    if (file && file.size > 0) {
      if (file.size > 8 * 1024 * 1024 || !allowedDocumentType(file)) {
        if (!strict) {
          warnings.push({ guestId, code: "invalid_document" });
          continue;
        }
        return { error: "Invalid document upload", documents };
      }
      for (const doc of documents.filter((entry) => entry.guestId === guestId)) {
        await storage.delete(keys.document(token, doc.guestId, doc.filename));
      }
      const safeName = `${randomId()}-${sanitizeFilename(file.name)}`;
      await storage.putBytes(keys.document(token, guestId, safeName), file, file.type || "application/octet-stream");
      const nextDoc = { guestId, filename: safeName, originalName: sanitizeFilename(file.name), size: file.size, type: file.type };
      const withoutGuest = documents.filter((entry) => entry.guestId !== guestId);
      documents.length = 0;
      documents.push(...withoutGuest, nextDoc);
    }
  }
  return { documents, warnings };
};

const saveDraftCheckin = async (request, storage) => {
  const { form, token, numberOfGuests, guests, submission } = await parseCheckinForm(request);
  const record = await storage.getJson(keys.token(token));
  if (!record || ["disabled", "expired"].includes(record.status) || Date.parse(record.expiresAt) < Date.now()) {
    return json({ error: "Invalid or expired check-in link" }, { status: 404 });
  }
  const existing = await storage.getJson(keys.submission(token));
  const stored = await storeUploadedDocuments({
    form,
    storage,
    token,
    numberOfGuests: Number.isInteger(numberOfGuests) ? numberOfGuests : 0,
    existingDocuments: existing?.documents || [],
    guests
  });
  const now = new Date().toISOString();
  await storage.putJson(keys.submission(token), {
    ...submission,
    token,
    reservationUid: record.reservationUid,
    status: "draft_saved",
    documents: stored.documents || existing?.documents || [],
    draftSavedAt: now,
    submittedAt: ""
  });
  await storage.putJson(keys.token(token), { ...record, status: "draft_saved", draftSavedAt: now, language: submission.language || record.language });
  const reservation = await storage.getJson(keys.reservation(record.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(record.reservationUid), { ...reservation, status: "draft_saved", draftSavedAt: now, updatedAt: now });
  }
  await storage.audit({ type: "checkin_draft_saved", actor: "guest", reservationUid: record.reservationUid, tokenId: token.slice(0, 10) });
  return json({
    ok: true,
    status: "draft_saved",
    draftSavedAt: now,
    warnings: stored.warnings || [],
    documents: (stored.documents || []).map((doc) => ({
      guestId: doc.guestId,
      originalName: doc.originalName || "document",
      size: doc.size || 0,
      type: doc.type || ""
    }))
  });
};

const submitCheckin = async (request, storage) => {
  const { form, token, numberOfGuests, guests, submission } = await parseCheckinForm(request);
  const record = await storage.getJson(keys.token(token));
  if (!record || ["disabled", "expired"].includes(record.status) || Date.parse(record.expiresAt) < Date.now()) {
    return json({ error: "Invalid or expired check-in link" }, { status: 404 });
  }
  const validation = validateSubmission(submission);
  if (!validation.ok) return json({ error: "Please check the required fields", fields: validation.errors }, { status: 400 });

  const existing = await storage.getJson(keys.submission(token));
  const stored = await storeUploadedDocuments({ form, storage, token, numberOfGuests, existingDocuments: existing?.documents || [], strict: true, guests });
  if (stored.error) return json({ error: stored.error, fields: stored.fields || [] }, { status: 400 });
  const now = new Date().toISOString();
  await storage.putJson(keys.submission(token), { ...submission, token, reservationUid: record.reservationUid, status: "pending_review", documents: stored.documents, submittedAt: now, draftSavedAt: existing?.draftSavedAt || "" });
  await storage.putJson(keys.token(token), { ...record, status: "pending_review", submittedAt: now, language: submission.language || record.language });
  const reservation = await storage.getJson(keys.reservation(record.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(record.reservationUid), { ...reservation, status: "pending_review", submittedAt: now, updatedAt: now });
  }
  await queueNotification(storage, {
    type: "checkin_submitted",
    reservationUid: record.reservationUid,
    source: reservation?.source || record.source || "",
    reservationCode: reservation?.reservationCode || "",
    checkIn: reservation?.checkIn || record.checkIn || submission.arrivalDate || "",
    checkOut: reservation?.checkOut || record.checkOut || submission.departureDate || "",
    numberOfGuests: submission.numberOfGuests || 0,
    adults: submission.adults || 0,
    minors: submission.minors || 0,
    infants: submission.infants || 0,
    submittedAt: now,
    adminPath: "/admin"
  });
  await storage.audit({ type: "checkin_submitted", actor: "guest", reservationUid: record.reservationUid, tokenId: token.slice(0, 10) });
  return json({ ok: true, message: "Check-in submitted securely. Thank you." });
};

const queueNotification = async (storage, event) => {
  const now = new Date().toISOString();
  const id = randomId();
  const date = now.slice(0, 10);
  await storage.putJson(keys.notification(date, id), {
    id,
    type: event.type,
    createdAt: now,
    status: "unread",
    reservationUid: event.reservationUid || "",
    source: event.source || "",
    reservationCode: event.reservationCode || "",
    checkIn: event.checkIn || "",
    checkOut: event.checkOut || "",
    numberOfGuests: event.numberOfGuests || 0,
    adults: event.adults || 0,
    minors: event.minors || 0,
    infants: event.infants || 0,
    submittedAt: event.submittedAt || now,
    adminPath: event.adminPath || "/admin"
  });
};

const listNotifications = async (storage) => {
  const notifications = (await storage.listJson("checkins/notifications/")).filter(Boolean);
  return notifications
    .map((notification) => ({
      id: notification.id || "",
      type: notification.type || "",
      createdAt: notification.createdAt || "",
      status: notification.status || "",
      reservationUid: notification.reservationUid || "",
      source: notification.source || "",
      reservationCode: notification.reservationCode || "",
      checkIn: notification.checkIn || "",
      checkOut: notification.checkOut || "",
      numberOfGuests: notification.numberOfGuests || 0,
      adults: notification.adults || 0,
      minors: notification.minors || 0,
      infants: notification.infants || 0,
      submittedAt: notification.submittedAt || "",
      adminPath: notification.adminPath || "/admin"
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 50);
};

const getSubmission = async (request, storage) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  return json({ submission });
};

const exportSubmission = async (request, storage) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  const reservation = await storage.getJson(keys.reservation(submission.reservationUid));
  const exportData = manualReviewExport(submission, reservation || {});
  if (format === "csv") {
    return text(exportToCsv(exportData), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="villa-laura-checkin-${sanitizeFilename(submission.reservationUid || "submission")}.csv"`
      }
    });
  }
  return json(exportData, {
    headers: {
      "content-disposition": `attachment; filename="villa-laura-checkin-${sanitizeFilename(submission.reservationUid || "submission")}.json"`
    }
  });
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

const redactedSubmission = (submission, now) => ({
  token: submission.token,
  reservationUid: submission.reservationUid,
  arrivalDate: submission.arrivalDate,
  departureDate: submission.departureDate,
  numberOfGuests: submission.numberOfGuests,
  adults: submission.adults || 0,
  minors: submission.minors || 0,
  infants: submission.infants || 0,
  submittedAt: submission.submittedAt || "",
  documentsDeletedAt: submission.documentsDeletedAt || "",
  personalDataDeletedAt: now,
  documents: [],
  guests: (submission.guests || []).map((guest) => ({
    id: guest.id,
    ageCategory: guest.ageCategory || "",
    guestType: guest.guestType || "",
    relationshipRole: guest.relationshipRole || "",
    responsibleGuestId: guest.responsibleGuestId || "",
    documentAvailable: Boolean(guest.documentAvailable),
    personalDataDeleted: true
  }))
});

const redactSubmissionData = async (request, storage, identity) => {
  const { token } = await request.json();
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  for (const doc of submission.documents || []) {
    await storage.delete(keys.document(token, doc.guestId, doc.filename));
  }
  const now = new Date().toISOString();
  const next = redactedSubmission({ ...submission, documentsDeletedAt: submission.documentsDeletedAt || now }, now);
  await storage.putJson(keys.submission(token), next);
  const reservation = await storage.getJson(keys.reservation(submission.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(submission.reservationUid), {
      ...reservation,
      status: "data_redacted",
      documentsDeletedAt: next.documentsDeletedAt,
      personalDataDeletedAt: now,
      updatedAt: now
    });
  }
  await storage.audit({ type: "personal_data_deleted", actor: identity.email, reservationUid: submission.reservationUid, tokenId: token.slice(0, 10) });
  return json({ ok: true, personalDataDeletedAt: now, documentsDeletedAt: next.documentsDeletedAt });
};

const resetCheckin = async (request, storage, identity) => {
  const { token } = await request.json();
  const submission = await storage.getJson(keys.submission(token));
  if (!submission) return json({ error: "Submission not found" }, { status: 404 });
  for (const doc of submission.documents || []) {
    await storage.delete(keys.document(token, doc.guestId, doc.filename));
  }
  const now = new Date().toISOString();
  await storage.putJson(keys.submission(token), { ...redactedSubmission({ ...submission, documentsDeletedAt: submission.documentsDeletedAt || now }, now), resetAt: now });
  const record = await storage.getJson(keys.token(token));
  if (record) await storage.putJson(keys.token(token), { ...record, status: "created", resetAt: now });
  const reservation = await storage.getJson(keys.reservation(submission.reservationUid));
  if (reservation) {
    await storage.putJson(keys.reservation(submission.reservationUid), {
      ...reservation,
      status: reservation.tokenCreatedAt ? "checkin_sent" : "waiting_for_guest",
      documentsDeletedAt: submission.documentsDeletedAt || now,
      personalDataDeletedAt: now,
      resetAt: now,
      updatedAt: now
    });
  }
  await storage.audit({ type: "checkin_reset", actor: identity.email, reservationUid: submission.reservationUid, tokenId: token.slice(0, 10) });
  return json({ ok: true, resetAt: now });
};

const handleAdmin = async (context, path, storage) => {
  const { request, env } = context;
  if (path === "/admin/session") {
    const identity = await getAdminIdentity(request, env);
    return json({
      authenticated: Boolean(identity),
      identity: identity ? { method: identity.method } : null,
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
  if (path === "/admin/health" && request.method === "GET") {
    return json({ ok: true, storage: "available", accessMode: auth.identity.method || "edge-protected" });
  }
  if (path === "/admin/sync" && request.method === "POST") return syncIcal(request, env, storage, auth.identity);
  if (path === "/admin/reservations" && request.method === "GET") return json({ reservations: await listReservations(storage) });
  if (path === "/admin/reservations" && request.method === "PATCH") return updateReservation(request, storage, auth.identity);
  if (path === "/admin/notifications" && request.method === "GET") return json({ notifications: await listNotifications(storage) });
  if (path === "/admin/token" && request.method === "POST") return createToken(request, env, storage, auth.identity);
  if (path === "/admin/token/regenerate" && request.method === "POST") return regenerateToken(request, env, storage, auth.identity);
  if (path === "/admin/submission" && request.method === "GET") return getSubmission(request, storage);
  if (path === "/admin/export" && request.method === "GET") return exportSubmission(request, storage);
  if (path === "/admin/document" && request.method === "GET") return getDocument(request, storage, auth.identity);
  if (path === "/admin/documents/delete" && request.method === "POST") return deleteDocuments(request, storage, auth.identity);
  if (path === "/admin/submission/redact" && request.method === "POST") return redactSubmissionData(request, storage, auth.identity);
  if (path === "/admin/checkin/reset" && request.method === "POST") return resetCheckin(request, storage, auth.identity);
  return json({ error: "Not found" }, { status: 404 });
};

export const onRequest = async (context) => {
  try {
    const path = routePath(context);
    const storage = new CheckinStorage(context.env);
    let response;
    if (path === "/checkin/token" && context.request.method === "GET") response = await getPublicToken(context.request, storage);
    else if (path === "/checkin/draft" && context.request.method === "POST") response = await saveDraftCheckin(context.request, storage);
    else if (path === "/checkin/submit" && context.request.method === "POST") response = await submitCheckin(context.request, storage);
    else response = await handleAdmin(context, path, storage);
    return securityHeaders(response);
  } catch (error) {
    return securityHeaders(json({ error: "Request failed" }, { status: 500 }));
  }
};
