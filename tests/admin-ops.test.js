import assert from "node:assert/strict";
import test from "node:test";
import {
  categorizeReservation,
  dashboardSummary,
  dedupeNotifications,
  groupReservations,
  reservationViewModel
} from "../src/checkin/admin-ops.js";

const today = "2026-07-05";
const fakeToken = (name) => ["vl_fake", name].join("_");

const reservation = (overrides) => ({
  uid: overrides.uid,
  type: "reservation",
  status: "imported",
  source: "Airbnb",
  checkIn: "2026-07-10",
  checkOut: "2026-07-14",
  nights: 4,
  ...overrides
});

test("admin operations grouping covers active reservation workflow states", () => {
  const fixtures = [
    reservation({ uid: "missing-manual", guestName: "", fullPhone: "", adults: "" }),
    reservation({ uid: "needs-link", guestName: "Test Guest", fullPhone: "+390000000001", adults: 2, minors: 1, arrivalTime: "15:00" }),
    reservation({
      uid: "waiting",
      guestName: "Waiting Guest",
      fullPhone: "+390000000002",
      adults: 2,
      arrivalTime: "16:00",
      status: "checkin_sent",
      token: fakeToken("waiting")
    }),
    reservation({
      uid: "submitted",
      guestName: "Submitted Guest",
      fullPhone: "+390000000003",
      adults: 1,
      arrivalTime: "17:00",
      status: "pending_review",
      token: fakeToken("submitted"),
      checkinSubmitted: true,
      documentCount: 1,
      documentsPresent: true
    }),
    reservation({
      uid: "cleanup",
      guestName: "Cleanup Guest",
      fullPhone: "+390000000004",
      adults: 1,
      arrivalTime: "18:00",
      status: "documents_deleted",
      token: fakeToken("cleanup"),
      checkinSubmitted: true,
      documentsDeletedAt: "2026-07-06T12:00:00.000Z"
    }),
    reservation({
      uid: "redacted",
      guestName: "Archived Guest",
      fullPhone: "+390000000005",
      adults: 2,
      arrivalTime: "15:30",
      status: "data_redacted",
      checkIn: "2026-06-01",
      checkOut: "2026-06-05",
      personalDataDeletedAt: "2026-06-06T12:00:00.000Z"
    }),
    {
      uid: "blocked-range",
      type: "blocked",
      status: "blocked",
      source: "Airbnb",
      summary: "Not available",
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
      nights: 2
    }
  ];

  assert.equal(categorizeReservation(fixtures[0], { today }), "needs_manual_details");
  assert.equal(categorizeReservation(fixtures[1], { today }), "needs_checkin_link");
  assert.equal(categorizeReservation(fixtures[2], { today }), "waiting_for_guest");
  assert.equal(categorizeReservation(fixtures[3], { today }), "authority_ready");
  assert.equal(categorizeReservation(fixtures[4], { today }), "cleanup_required");
  assert.equal(categorizeReservation(fixtures[5], { today }), "completed_archived");
  assert.equal(categorizeReservation(fixtures[6], { today }), "blocked_dates");

  const summary = dashboardSummary(fixtures, { today });
  assert.deepEqual(summary, {
    needsAttention: 3,
    waitingForGuest: 1,
    readyForAuthority: 1,
    upcomingArrivals: 0,
    completedArchived: 1,
    blockedDates: 1
  });
});

test("far future reservations stay out of the immediate action queue", () => {
  const future = reservation({
    uid: "future-import",
    checkIn: "2026-10-20",
    checkOut: "2026-10-24",
    guestName: "",
    fullPhone: "",
    adults: ""
  });
  const view = reservationViewModel(future, { today });

  assert.equal(view.groupId, "upcoming_not_urgent");
  assert.equal(view.nextAction, "Monitor upcoming arrival");
  assert.equal(view.warnings.includes("Missing phone number"), true);
});

test("groupReservations keeps operational groups in dashboard order and sorts by arrival", () => {
  const fixtures = [
    reservation({ uid: "later-manual", checkIn: "2026-07-12", guestName: "", fullPhone: "", adults: "" }),
    reservation({ uid: "earlier-manual", checkIn: "2026-07-08", guestName: "", fullPhone: "", adults: "" }),
    reservation({ uid: "needs-link", checkIn: "2026-07-07", guestName: "Test Guest", fullPhone: "+390000000001", adults: 1, arrivalTime: "15:00" })
  ];
  const groups = groupReservations(fixtures, { today }).filter((group) => group.reservations.length);

  assert.deepEqual(groups.map((group) => group.id), ["needs_manual_details", "needs_checkin_link"]);
  assert.deepEqual(groups[0].reservations.map((view) => view.reservation.uid), ["earlier-manual", "later-manual"]);
});

test("dedupeNotifications keeps the latest check-in submission per reservation", () => {
  const notifications = dedupeNotifications([
    {
      id: "old",
      type: "checkin_submitted",
      reservationUid: "duplicate-reservation",
      checkIn: "2026-07-10",
      checkOut: "2026-07-14",
      numberOfGuests: 2,
      createdAt: "2026-07-01T10:00:00.000Z",
      submittedAt: "2026-07-01T10:00:00.000Z"
    },
    {
      id: "new",
      type: "checkin_submitted",
      reservationUid: "duplicate-reservation",
      checkIn: "2026-07-10",
      checkOut: "2026-07-14",
      numberOfGuests: 2,
      createdAt: "2026-07-01T11:00:00.000Z",
      submittedAt: "2026-07-01T11:00:00.000Z"
    },
    {
      id: "other",
      type: "checkin_submitted",
      reservationUid: "other-reservation",
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
      numberOfGuests: 1,
      createdAt: "2026-07-01T09:00:00.000Z",
      submittedAt: "2026-07-01T09:00:00.000Z"
    }
  ]);

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].id, "new");
  assert.equal(notifications[0].duplicateCount, 1);
  assert.equal(notifications[1].id, "other");
});
