import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseAirbnbIcal } from "../src/checkin/ical.js";

test("parses sanitized Airbnb iCal reservations and blocks", async () => {
  const fixture = await readFile(new URL("./fixtures/sanitized-airbnb.ics", import.meta.url), "utf8");
  const events = parseAirbnbIcal(fixture);

  assert.equal(events.length, 2);
  const reservation = events.find((event) => event.type === "reservation");
  const blocked = events.find((event) => event.type === "blocked");

  assert.equal(reservation.uid, "sanitized-reservation-1@example.test");
  assert.equal(reservation.checkIn, "2026-07-01");
  assert.equal(reservation.checkOut, "2026-07-05");
  assert.equal(reservation.nights, 4);
  assert.equal(reservation.status, "imported");
  assert.equal(reservation.source, "Airbnb");
  assert.equal(reservation.reservationCode, "HMABC1234");
  assert.equal(reservation.phoneLast4, "7890");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.nights, 2);
});

test("recognizes a booking reference with an imported title and cancellation status", () => {
  const [event] = parseAirbnbIcal(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:synthetic-cancelled\nSUMMARY:Synthetic title\nSTATUS:CANCELLED\nDTSTART;VALUE=DATE:20261001\nDTEND;VALUE=DATE:20261004\nDESCRIPTION:Reservation https://example.test/reservations/HMSYNTH123\nEND:VEVENT\nEND:VCALENDAR`);
  assert.equal(event.type, "reservation");
  assert.equal(event.status, "cancelled");
  assert.equal(event.summary, "Synthetic title");
});
