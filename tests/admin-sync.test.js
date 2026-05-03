import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";
import { onRequest } from "../functions/api/[[path]].js";
import { CheckinStorage } from "../src/checkin/storage.js";
import { keys } from "../src/checkin/storage.js";

const fixture = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:sync-reservation@example.test
SUMMARY:Reserved
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260705
DTSTAMP:20260101T000000Z
DESCRIPTION:Reservation https://www.airbnb.example/reservations/HMABC1234 Phone +39 000 000 7890
END:VEVENT
BEGIN:VEVENT
UID:sync-blocked@example.test
SUMMARY:Not available
DTSTART;VALUE=DATE:20260801
DTEND;VALUE=DATE:20260803
DTSTAMP:20260101T000000Z
DESCRIPTION:Owner block
END:VEVENT
END:VCALENDAR`;

const fakeToken = (name) => `vl_fake_${name}`;

const adminRequest = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-access-authenticated-user-email": "admin@example.com"
      },
      body: "{}"
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const adminPatch = (path, env, body) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "cf-access-authenticated-user-email": "admin@example.com"
      },
      body: JSON.stringify(body)
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const adminPost = (path, env, body) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-access-authenticated-user-email": "admin@example.com"
      },
      body: JSON.stringify(body)
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const adminGet = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      headers: {
        "cf-access-authenticated-user-email": "admin@example.com"
      }
    }),
    env,
    params: { path: path.split("?")[0].replace(/^\//, "").split("/") }
  });

const unauthenticatedPost = (path, env, body) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const edgeCookieGet = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      headers: {
        cookie: "CF_Authorization=fake-edge-cookie",
        "sec-fetch-site": "same-origin"
      }
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const sameOriginEdgeGet = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      headers: {
        "sec-fetch-site": "same-origin"
      }
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const crossOriginEdgeCookieGet = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      headers: {
        cookie: "CF_Authorization=fake-edge-cookie",
        origin: "https://example.invalid",
        "sec-fetch-site": "cross-site"
      }
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const publicFormPost = (path, env, form) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`, {
      method: "POST",
      body: form
    }),
    env,
    params: { path: path.replace(/^\//, "").split("/") }
  });

const publicGet = (path, env) =>
  onRequest({
    request: new Request(`https://villa-laura.it/api${path}`),
    env,
    params: { path: path.split("?")[0].replace(/^\//, "").split("/") }
  });

const makeDraftForm = (token, overrides = {}) => {
  const form = new FormData();
  form.set("token", token);
  form.set("language", overrides.language || "fr");
  form.set("arrivalDate", overrides.arrivalDate || "");
  form.set("departureDate", overrides.departureDate || "");
  form.set("adults", overrides.adults || "1");
  form.set("minors", overrides.minors || "0");
  form.set("infants", overrides.infants || "0");
  form.set("numberOfGuests", overrides.numberOfGuests || "1");
  form.set("mainGuestEmail", overrides.mainGuestEmail || "");
  form.set("mainGuestPhone", overrides.mainGuestPhone || "");
  form.set("guest_0_ageCategory", "adult");
  form.set("guest_0_guestType", "single_guest");
  form.set("guest_0_relationshipRole", "main_guest");
  form.set("guest_0_documentAvailable", "yes");
  form.set("guest_0_firstName", overrides.firstName || "");
  form.set("guest_0_lastName", overrides.lastName || "");
  form.set("guest_0_dateOfBirth", overrides.dateOfBirth || "");
  form.set("guest_0_placeOfBirth", overrides.placeOfBirth || "");
  form.set("guest_0_citizenship", overrides.citizenship || "");
  form.set("guest_0_gender", overrides.gender || "");
  form.set("guest_0_documentType", overrides.documentType || "");
  form.set("guest_0_documentNumber", overrides.documentNumber || "");
  form.set("guest_0_documentIssuingCountry", overrides.documentIssuingCountry || "");
  form.set("guest_0_documentExpiryDate", overrides.documentExpiryDate || "");
  if (overrides.privacyAccepted) form.set("privacyAccepted", "on");
  if (overrides.file) form.set("guest_0_documentUpload", overrides.file.blob, overrides.file.name);
  return form;
};

const createPublicToken = async (storage, token = fakeToken("public_token")) => {
  await storage.putJson(keys.reservation("public-reservation"), {
    uid: "public-reservation",
    type: "reservation",
    status: "checkin_sent",
    checkIn: "2026-11-01",
    checkOut: "2026-11-04",
    nights: 3,
    preferredLanguage: "fr",
    adults: 1,
    minors: 0,
    infants: 0
  });
  await storage.putJson(keys.token(token), {
    token,
    reservationUid: "public-reservation",
    status: "created",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    language: "fr"
  });
  return token;
};

const fakeSubmittedCheckin = async (storage, checkinToken = fakeToken("cleanup_token")) => {
  await storage.putJson(keys.reservation("cleanup-reservation"), {
    uid: "cleanup-reservation",
    type: "reservation",
    status: "pending_review",
    checkIn: "2026-10-01",
    checkOut: "2026-10-05",
    nights: 4
  });
  await storage.putJson(keys.token(checkinToken), {
    checkinToken,
    reservationUid: "cleanup-reservation",
    status: "submitted",
    createdAt: "2026-01-01T00:00:00.000Z",
    submittedAt: "2026-01-02T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z"
  });
  await storage.putJson(keys.submission(checkinToken), {
    checkinToken,
    reservationUid: "cleanup-reservation",
    arrivalDate: "2026-10-01",
    departureDate: "2026-10-05",
    numberOfGuests: 1,
    adults: 1,
    minors: 0,
    infants: 0,
    mainGuestEmail: "fake@example.test",
    mainGuestPhone: "+390000000000",
    submittedAt: "2026-01-02T00:00:00.000Z",
    guests: [
      {
        id: "guest-1",
        firstName: "Fake",
        lastName: "Guest",
        dateOfBirth: "1990-01-01",
        citizenship: "Testland",
        documentNumber: "FAKE123",
        ageCategory: "adult",
        guestType: "single_guest",
        documentAvailable: true
      }
    ],
    documents: [{ guestId: "guest-1", filename: "fake.pdf", originalName: "fake.pdf", size: 4, type: "application/pdf" }]
  });
  await storage.putBytes(keys.document(checkinToken, "guest-1", "fake.pdf"), new Blob(["fake"], { type: "application/pdf" }), "application/pdf");
  return checkinToken;
};

test("admin sync returns safe diagnostics when iCal URL is missing", async () => {
  const response = await adminRequest("/admin/sync", {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com"
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Airbnb iCal URL is not configured");
  assert.equal(body.diagnostics.icalUrlConfigured, false);
  assert.equal(JSON.stringify(body).includes("http"), false);
});

test("blocked items ignore guest fields and remain blocked on save", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com"
  };
  const storage = new CheckinStorage(env);
  const uid = "blocked-reset@example.test";

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    await storage.putJson(keys.reservation(uid), {
      uid,
      type: "blocked",
      summary: "Not available",
      status: "blocked",
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      nights: 2,
      source: "Airbnb",
      guestName: "Should Be Removed",
      fullPhone: "+390000000000"
    });

    const response = await adminPatch("/admin/reservations", env, {
      uid,
      guestName: "Accidental Guest",
      fullPhone: "+391111111111",
      email: "guest@example.com",
      status: "imported",
      notes: "Should not persist"
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.reservation.type, "blocked");
    assert.equal(body.reservation.status, "blocked");
    assert.equal(body.reservation.guestName, "");
    assert.equal(body.reservation.fullPhone, "");
    assert.equal(body.reservation.email, "");
    assert.equal(body.reservation.notes, "");
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("checkinToken creation preserves reservation language and localized message", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com",
    VILLA_LAURA_SITE_URL: "https://villa-laura.it"
  };
  const storage = new CheckinStorage(env);
  const uid = "french-reservation@example.test";

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    await storage.putJson(keys.reservation(uid), {
      uid,
      type: "reservation",
      summary: "Reserved",
      status: "imported",
      checkIn: "2026-09-01",
      checkOut: "2026-09-05",
      nights: 4,
      source: "Airbnb",
      preferredLanguage: "fr",
      guestName: "Test"
    });

    const createResponse = await adminPost("/admin/token", env, { uid });
    const createBody = await createResponse.json();
    const tokenResponse = await onRequest({
      request: new Request(`https://villa-laura.it/api/checkin/token?token=${encodeURIComponent(createBody.token)}`),
      env,
      params: { path: ["checkin", "token"] }
    });
    const tokenBody = await tokenResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createBody.language, "fr");
    assert.match(createBody.message, /Merci pour votre reservation/);
    assert.equal(tokenBody.language, "fr");
    assert.equal(tokenBody.reservation.language, "fr");
    assert.equal(createBody.token.includes("Test"), false);
    assert.equal(createBody.token.includes("2026"), false);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("check-in link creation is idempotent and regeneration disables the old token", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com",
    VILLA_LAURA_SITE_URL: "https://villa-laura.it"
  };
  const storage = new CheckinStorage(env);
  const uid = "idempotent-token@example.test";

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    await storage.putJson(keys.reservation(uid), {
      uid,
      type: "reservation",
      summary: "Reserved",
      status: "imported",
      checkIn: "2026-09-01",
      checkOut: "2026-09-05",
      nights: 4,
      preferredLanguage: "en"
    });

    const first = await (await adminPost("/admin/token", env, { uid })).json();
    const second = await (await adminPost("/admin/token", env, { uid })).json();
    assert.equal(second.token, first.token);
    assert.equal(second.existing, true);

    const regenerated = await (await adminPost("/admin/token/regenerate", env, { uid })).json();
    assert.notEqual(regenerated.token, first.token);
    assert.equal(regenerated.disabledPreviousTokens, 1);

    const oldTokenResponse = await onRequest({
      request: new Request(`https://villa-laura.it/api/checkin/token?token=${encodeURIComponent(first.token)}`),
      env,
      params: { path: ["checkin", "token"] }
    });
    const newTokenResponse = await onRequest({
      request: new Request(`https://villa-laura.it/api/checkin/token?token=${encodeURIComponent(regenerated.token)}`),
      env,
      params: { path: ["checkin", "token"] }
    });
    const tokens = await storage.listJson("checkins/tokens/");
    const active = tokens.filter((entry) => entry.reservationUid === uid && !["disabled", "expired", "revoked"].includes(entry.status));

    assert.equal(oldTokenResponse.status, 404);
    assert.equal(newTokenResponse.status, 200);
    assert.equal(active.length, 1);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("admin sync writes reservations to the same storage list endpoint reads", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200, headers: { "content-type": "text/calendar" } });
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com",
    AIRBNB_ICAL_URL: "https://calendar.example.test/sanitized.ics"
  };

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const response = await adminRequest("/admin/sync", env);
    const body = await response.json();
    const reservations = await new CheckinStorage(env).listJson("checkins/reservations/");

    assert.equal(response.status, 200);
    assert.equal(body.diagnostics.icalUrlConfigured, true);
    assert.equal(body.diagnostics.fetchedIcal, true);
    assert.equal(body.diagnostics.parsedEvents, 2);
    assert.equal(body.diagnostics.reservations, 1);
    assert.equal(body.diagnostics.blockedDates, 1);
    assert.equal(body.diagnostics.storageWriteSuccess, true);
    assert.equal(body.diagnostics.storageReadbackSuccess, true);
    assert.equal(reservations.length, 2);
    assert.equal(reservations.filter((entry) => entry.type === "reservation").length, 1);
    assert.equal(reservations.filter((entry) => entry.type === "blocked").length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("admin cleanup deletes documents, redacts personal data, and resets check-in", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com"
  };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const checkinToken = await fakeSubmittedCheckin(storage);
    const deleteResponse = await adminPost("/admin/documents/delete", env, { token: checkinToken });
    const afterDelete = await storage.getJson(keys.submission(checkinToken));
    const deletedObject = await storage.getObject(keys.document(checkinToken, "guest-1", "fake.pdf"));

    assert.equal(deleteResponse.status, 200);
    assert.equal(afterDelete.documents.length, 0);
    assert.equal(Boolean(afterDelete.documentsDeletedAt), true);
    assert.equal(deletedObject, null);

    afterDelete.documents = [{ guestId: "guest-1", filename: "fake.pdf", originalName: "fake.pdf", size: 4, type: "application/pdf" }];
    await storage.putJson(keys.submission(checkinToken), afterDelete);
    await storage.putBytes(keys.document(checkinToken, "guest-1", "fake.pdf"), new Blob(["fake"], { type: "application/pdf" }), "application/pdf");

    const redactResponse = await adminPost("/admin/submission/redact", env, { token: checkinToken });
    const redacted = await storage.getJson(keys.submission(checkinToken));
    assert.equal(redactResponse.status, 200);
    assert.equal(redacted.mainGuestEmail, undefined);
    assert.equal(redacted.mainGuestPhone, undefined);
    assert.equal(redacted.guests[0].firstName, undefined);
    assert.equal(redacted.guests[0].documentNumber, undefined);
    assert.equal(redacted.guests[0].personalDataDeleted, true);

    const resetTokenValue = await fakeSubmittedCheckin(storage, fakeToken("reset_token"));
    const resetResponse = await adminPost("/admin/checkin/reset", env, { token: resetTokenValue });
    const resetSubmission = await storage.getJson(keys.submission(resetTokenValue));
    const resetRecord = await storage.getJson(keys.token(resetTokenValue));
    assert.equal(resetResponse.status, 200);
    assert.equal(resetSubmission.resetAt.length > 0, true);
    assert.equal(resetSubmission.mainGuestEmail, undefined);
    assert.equal(resetRecord.status, "created");
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("admin export returns submitted data without private storage keys", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com"
  };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const checkinToken = await fakeSubmittedCheckin(storage, fakeToken("export_token"));
    const jsonResponse = await adminGet(`/admin/export?token=${encodeURIComponent(checkinToken)}&format=json`, env);
    const jsonBody = await jsonResponse.json();
    const csvResponse = await adminGet(`/admin/export?token=${encodeURIComponent(checkinToken)}&format=csv`, env);
    const csvBody = await csvResponse.text();

    assert.equal(jsonResponse.status, 200);
    assert.equal(jsonBody.label, "Structured export for manual review");
    assert.equal(jsonBody.guests[0].firstName, "Fake");
    assert.equal(jsonBody.guests[0].documentNumber, "FAKE123");
    assert.equal(JSON.stringify(jsonBody).includes("checkins/submissions"), false);
    assert.equal(JSON.stringify(jsonBody).includes("filename"), false);
    assert.equal(csvResponse.status, 200);
    assert.match(csvBody, /first_name/);
    assert.match(csvBody, /FAKE123/);
    assert.equal(csvBody.includes("checkins/submissions"), false);
    assert.equal(csvBody.includes("fake.pdf"), false);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("final submit queues minimal admin notification without document data", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const token = await createPublicToken(storage, fakeToken("notification_token"));
    const response = await publicFormPost(
      "/checkin/submit",
      env,
      makeDraftForm(token, {
        arrivalDate: "2026-11-01",
        departureDate: "2026-11-04",
        mainGuestEmail: "fake@example.test",
        mainGuestPhone: "+390000000000",
        firstName: "Fake",
        lastName: "Guest",
        dateOfBirth: "1990-01-01",
        placeOfBirth: "Test City",
        citizenship: "Testland",
        gender: "Other",
        documentType: "Passport",
        documentNumber: "FAKE123",
        documentIssuingCountry: "Testland",
        privacyAccepted: true,
        file: { blob: new Blob(["fake"], { type: "application/pdf" }), name: "fake.pdf" }
      })
    );
    const notificationsResponse = await adminGet("/admin/notifications", env);
    const notifications = await notificationsResponse.json();
    const serialized = JSON.stringify(notifications);

    assert.equal(response.status, 200);
    assert.equal(notifications.notifications.length, 1);
    assert.equal(notifications.notifications[0].type, "checkin_submitted");
    assert.equal(serialized.includes("FAKE123"), false);
    assert.equal(serialized.includes("fake.pdf"), false);
    assert.equal(serialized.includes("fake@example.test"), false);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("admin deletion endpoints require authentication", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  for (const path of ["/admin/documents/delete", "/admin/submission/redact", "/admin/checkin/reset"]) {
    const response = await unauthenticatedPost(path, env, { token: "vl_fake" });
    assert.equal(response.status, 401);
  }
});

test("admin API can trust Cloudflare Access edge protection for same-origin protected requests", async () => {
  const env = {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com",
    CF_ACCESS_TEAM_DOMAIN: "team.example",
    CF_ACCESS_AUD: "audience"
  };

  const sameOrigin = await edgeCookieGet("/admin/reservations", env);
  const sameOriginNoHeader = await sameOriginEdgeGet("/admin/health", env);
  const crossOrigin = await crossOriginEdgeCookieGet("/admin/reservations", env);
  const sameOriginNoCookie = await onRequest({
    request: new Request("https://villa-laura.it/api/admin/reservations"),
    env,
    params: { path: ["admin", "reservations"] }
  });

  assert.equal(sameOrigin.status, 200);
  assert.equal(sameOriginNoHeader.status, 200);
  assert.equal((await sameOriginNoHeader.json()).accessMode, "cloudflare_access_edge_protected");
  assert.equal(crossOrigin.status, 401);
  assert.equal(sameOriginNoCookie.status, 200);
});

test("R2-style listJson ignores uploaded document objects under submission prefix", async () => {
  const objects = new Map([
    [keys.submission("vl_fake_r2"), { token: "vl_fake_r2", reservationUid: "r2-reservation", status: "pending_review" }],
    [keys.document("vl_fake_r2", "guest-1", "fake.jpg"), "not-json-document-bytes"]
  ]);
  const storage = new CheckinStorage({
    VILLA_LAURA_CHECKINS: {
      async list({ prefix }) {
        return { objects: Array.from(objects.keys()).filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
      },
      async get(key) {
        const value = objects.get(key);
        if (!key.endsWith(".json")) {
          return {
            async json() {
              throw new Error("document object should not be parsed as json");
            }
          };
        }
        return value
          ? {
              async json() {
                return value;
              }
            }
          : null;
      }
    }
  });

  const submissions = await storage.listJson("checkins/submissions/");
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].token, "vl_fake_r2");
});

test("guest draft save accepts partial fields, stores JPEG, and reloads without public document URLs", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const token = await createPublicToken(storage, fakeToken("draft_token"));
    const form = makeDraftForm(token, {
      firstName: "Fake",
      language: "fr",
      file: { blob: new Blob(["fake-jpeg"], { type: "image/jpeg" }), name: "Photo Test.JPEG" }
    });

    const response = await publicFormPost("/checkin/draft", env, form);
    const body = await response.json();
    const saved = await storage.getJson(keys.submission(token));
    const tokenRecord = await storage.getJson(keys.token(token));
    const reloadResponse = await publicGet(`/checkin/token?token=${encodeURIComponent(token)}`, env);
    const reload = await reloadResponse.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "draft_saved");
    assert.equal(saved.status, "draft_saved");
    assert.equal(saved.privacyAccepted, false);
    assert.equal(saved.guests[0].firstName, "Fake");
    assert.equal(saved.documents.length, 1);
    assert.equal(saved.documents[0].originalName, "Photo-Test.JPEG");
    assert.equal(tokenRecord.status, "draft_saved");
    assert.equal(reload.draft.status, "draft_saved");
    assert.equal(reload.draft.language, "fr");
    assert.equal(reload.draft.documents[0].originalName, "Photo-Test.JPEG");
    assert.equal(JSON.stringify(reload).includes("checkins/submissions"), false);
    assert.equal(JSON.stringify(reload).includes("filename"), false);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("guest draft save preserves text when invalid document is skipped", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const token = await createPublicToken(storage, fakeToken("invalid_draft_token"));
    const response = await publicFormPost(
      "/checkin/draft",
      env,
      makeDraftForm(token, {
        firstName: "Draft",
        file: { blob: new Blob(["bad"], { type: "text/plain" }), name: "notes.txt" }
      })
    );
    const body = await response.json();
    const saved = await storage.getJson(keys.submission(token));

    assert.equal(response.status, 200);
    assert.equal(body.warnings[0].code, "invalid_document");
    assert.equal(saved.guests[0].firstName, "Draft");
    assert.equal(saved.documents.length, 0);
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});

test("final submit remains strict but can reuse draft document", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  const storage = new CheckinStorage(env);

  try {
    await rm(".local-data/checkins", { recursive: true, force: true });
    const token = await createPublicToken(storage, fakeToken("final_token"));
    const validFields = {
      arrivalDate: "2026-11-01",
      departureDate: "2026-11-04",
      mainGuestEmail: "fake@example.test",
      mainGuestPhone: "+390000000000",
      firstName: "Fake",
      lastName: "Guest",
      dateOfBirth: "1990-01-01",
      placeOfBirth: "Test City",
      citizenship: "Testland",
      gender: "Other",
      documentType: "Passport",
      documentNumber: "FAKE123",
      documentIssuingCountry: "Testland"
    };

    const noPrivacy = await publicFormPost("/checkin/submit", env, makeDraftForm(token, validFields));
    assert.equal(noPrivacy.status, 400);

    await publicFormPost(
      "/checkin/draft",
      env,
      makeDraftForm(token, {
        ...validFields,
        file: { blob: new Blob(["fake-jpg"], { type: "image/jpeg" }), name: "adult.JPG" }
      })
    );
    const finalResponse = await publicFormPost("/checkin/submit", env, makeDraftForm(token, { ...validFields, privacyAccepted: true }));
    const finalSubmission = await storage.getJson(keys.submission(token));
    const reservation = await storage.getJson(keys.reservation("public-reservation"));

    assert.equal(finalResponse.status, 200);
    assert.equal(finalSubmission.status, "pending_review");
    assert.equal(finalSubmission.documents.length, 1);
    assert.equal(reservation.status, "pending_review");
  } finally {
    await rm(".local-data/checkins", { recursive: true, force: true });
  }
});
