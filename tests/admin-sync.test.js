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

const fakeSubmittedCheckin = async (storage, checkinToken = "vl_fake_cleanup_token") => {
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

    const resetTokenValue = await fakeSubmittedCheckin(storage, "vl_fake_reset_token");
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

test("admin deletion endpoints require authentication", async () => {
  const env = { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" };
  for (const path of ["/admin/documents/delete", "/admin/submission/redact", "/admin/checkin/reset"]) {
    const response = await unauthenticatedPost(path, env, { token: "vl_fake" });
    assert.equal(response.status, 401);
  }
});
