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
