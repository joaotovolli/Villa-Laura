const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const dashboardGroupDefinitions = [
  {
    id: "needs_manual_details",
    title: "Needs manual details",
    summary: "Complete guest, contact, guest mix, and arrival details.",
    summaryBucket: "needsAttention"
  },
  {
    id: "needs_checkin_link",
    title: "Check-in link/message not yet sent",
    summary: "Create the tokenized link and send the guest message.",
    summaryBucket: "needsAttention"
  },
  {
    id: "waiting_for_guest",
    title: "Waiting for guest submission",
    summary: "A check-in link exists and the guest has not submitted final data.",
    summaryBucket: "waitingForGuest"
  },
  {
    id: "authority_ready",
    title: "Ready for authority submission",
    summary: "Submitted guest data is ready for admin review, Alloggiati, or ROSS1000.",
    summaryBucket: "readyForAuthority"
  },
  {
    id: "cleanup_required",
    title: "Documents/guest data cleanup required",
    summary: "Delete uploaded documents and redact guest data after processing.",
    summaryBucket: "needsAttention"
  },
  {
    id: "upcoming_not_urgent",
    title: "Upcoming but not urgent",
    summary: "Future reservations outside the immediate operating window.",
    summaryBucket: "upcomingArrivals"
  },
  {
    id: "completed_archived",
    title: "Completed / archived stays",
    summary: "Past or redacted stays kept out of the main operating queue.",
    summaryBucket: "completedArchived",
    collapsedByDefault: true
  },
  {
    id: "blocked_dates",
    title: "Blocked dates",
    summary: "Owner blocks and unavailable ranges from Airbnb.",
    summaryBucket: "blockedDates",
    collapsedByDefault: true
  }
];

export const statusLabels = {
  imported: "Imported",
  waiting_for_guest: "Waiting for guest",
  checkin_sent: "Waiting for guest",
  draft_saved: "Draft saved",
  pending_review: "Action needed",
  approved: "Ready for authority submission",
  rejected: "Archived",
  submitted_to_alloggiati: "Submitted to Alloggiati",
  submitted_to_ross1000: "Submitted to ROSS1000",
  documents_deleted: "Cleanup due",
  data_redacted: "Archived",
  blocked: "Blocked date"
};

const authorityStatuses = new Set(["pending_review", "approved", "submitted_to_alloggiati", "submitted_to_ross1000"]);
const archivedStatuses = new Set(["data_redacted", "rejected"]);

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateOnly = (value) => {
  if (!value) return null;
  const timestamp = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const todayTimestamp = (today = new Date()) => {
  if (typeof today === "string") return parseDateOnly(today);
  return parseDateOnly(today.toISOString().slice(0, 10));
};

const normalizedStatus = (reservation = {}) => reservation.status || (reservation.type === "blocked" ? "blocked" : "imported");

export const statusLabelFor = (status) => statusLabels[status] || String(status || "Imported").replace(/_/g, " ");

export const hasActiveCheckinLink = (reservation = {}) => Boolean(reservation.token || reservation.checkinLink);

export const daysUntilCheckIn = (reservation = {}, today = new Date()) => {
  const checkIn = parseDateOnly(reservation.checkIn);
  const base = todayTimestamp(today);
  if (checkIn === null || base === null) return null;
  return Math.round((checkIn - base) / MS_PER_DAY);
};

export const isPastStay = (reservation = {}, today = new Date()) => {
  const checkOut = parseDateOnly(reservation.checkOut);
  const base = todayTimestamp(today);
  if (checkOut === null || base === null) return false;
  return checkOut < base;
};

export const guestCountsFor = (reservation = {}) => {
  const adults = toInt(reservation.adults ?? reservation.submittedAdults);
  const minors = toInt(reservation.minors ?? reservation.submittedMinors) ?? 0;
  const infants = toInt(reservation.infants ?? reservation.submittedInfants) ?? 0;
  const explicitTotal = toInt(reservation.numberOfGuests ?? reservation.submittedGuests);
  const hasProvidedCounts = adults !== null || explicitTotal !== null;
  const adultCount = adults ?? (explicitTotal ? Math.max(1, explicitTotal - minors - infants) : 0);
  const total = explicitTotal ?? Math.max(0, adultCount + minors + infants);
  return {
    adults: adultCount,
    minors,
    infants,
    total,
    provided: hasProvidedCounts
  };
};

export const guestMixLabel = (reservation = {}) => {
  const counts = guestCountsFor(reservation);
  if (!counts.provided) return "Guest mix missing";
  const guestWord = counts.total === 1 ? "guest" : "guests";
  return `${counts.total} ${guestWord} (${counts.adults} adults, ${counts.minors} minors, ${counts.infants} infants)`;
};

export const missingManualDetails = (reservation = {}) => {
  const counts = guestCountsFor(reservation);
  return {
    guestName: !String(reservation.guestName || "").trim(),
    phone: !String(reservation.fullPhone || "").trim(),
    guestMix: !counts.provided,
    arrivalTime: !String(reservation.arrivalTime || "").trim()
  };
};

export const needsManualDetails = (reservation = {}) => {
  const missing = missingManualDetails(reservation);
  return missing.guestName || missing.phone || missing.guestMix;
};

export const cleanupDue = (reservation = {}, today = new Date()) => {
  const status = normalizedStatus(reservation);
  if (reservation.personalDataDeletedAt || status === "data_redacted") return false;
  if (status === "documents_deleted" || reservation.documentsDeletedAt) return true;
  if (reservation.documentsPresent && (isPastStay(reservation, today) || ["approved", "submitted_to_alloggiati", "submitted_to_ross1000"].includes(status))) {
    return true;
  }
  return false;
};

export const isCompletedOrArchived = (reservation = {}, today = new Date()) => {
  const status = normalizedStatus(reservation);
  if (reservation.type === "blocked") return false;
  if (reservation.personalDataDeletedAt || archivedStatuses.has(status)) return true;
  if (isPastStay(reservation, today) && !reservation.checkinSubmitted && !reservation.draftSaved && !reservation.documentsPresent) return true;
  return false;
};

const withinAttentionWindow = (reservation, today, attentionWindowDays) => {
  const days = daysUntilCheckIn(reservation, today);
  return days === null || days <= attentionWindowDays;
};

export const categorizeReservation = (reservation = {}, options = {}) => {
  const today = options.today || new Date();
  const attentionWindowDays = options.attentionWindowDays ?? 30;
  const status = normalizedStatus(reservation);
  const hasLink = hasActiveCheckinLink(reservation);

  if (reservation.type === "blocked") return "blocked_dates";
  if (cleanupDue(reservation, today)) return "cleanup_required";
  if (isCompletedOrArchived(reservation, today)) return "completed_archived";
  if (reservation.checkinSubmitted || authorityStatuses.has(status)) return "authority_ready";
  if (!withinAttentionWindow(reservation, today, attentionWindowDays)) return "upcoming_not_urgent";
  if (needsManualDetails(reservation)) return "needs_manual_details";
  if (!hasLink) return "needs_checkin_link";
  if (hasLink && !reservation.checkinSubmitted) return "waiting_for_guest";
  return "upcoming_not_urgent";
};

export const nextActionFor = (reservation = {}, groupId = categorizeReservation(reservation)) => {
  if (groupId === "needs_manual_details") return "Complete missing manual details";
  if (groupId === "needs_checkin_link") return "Create and send check-in link";
  if (groupId === "waiting_for_guest") return reservation.draftSaved ? "Guest draft saved; wait for final submission" : "Wait for guest submission";
  if (groupId === "authority_ready") return "Review and prepare authority submission";
  if (groupId === "cleanup_required") {
    if (reservation.documentsPresent) return "Delete documents, then redact guest data";
    return "Redact guest data";
  }
  if (groupId === "upcoming_not_urgent") return "Monitor upcoming arrival";
  if (groupId === "completed_archived") return "Archived";
  if (groupId === "blocked_dates") return "No guest action";
  return "Review reservation";
};

export const warningsForReservation = (reservation = {}, groupId = categorizeReservation(reservation), options = {}) => {
  const today = options.today || new Date();
  const status = normalizedStatus(reservation);
  const missing = missingManualDetails(reservation);
  const warnings = [];

  if (groupId === "authority_ready") warnings.push("Submitted data pending review");
  if (groupId === "cleanup_required") warnings.push("Cleanup due");
  if (missing.guestName && groupId !== "completed_archived" && groupId !== "blocked_dates") warnings.push("Guest name missing");
  if (missing.phone && groupId !== "completed_archived" && groupId !== "blocked_dates") warnings.push("Missing phone number");
  if (missing.guestMix && groupId !== "completed_archived" && groupId !== "blocked_dates") warnings.push("Guest mix missing");
  if (!hasActiveCheckinLink(reservation) && ["needs_checkin_link", "needs_manual_details"].includes(groupId)) warnings.push("Check-in link missing");
  if (missing.arrivalTime && !["completed_archived", "blocked_dates"].includes(groupId)) warnings.push("Arrival time missing");
  if (reservation.draftSaved && !reservation.checkinSubmitted) warnings.push("Guest draft saved");
  if (reservation.documentsPresent) warnings.push("Documents still stored");
  if (reservation.documentsDeletedAt && !reservation.personalDataDeletedAt && status !== "data_redacted") warnings.push("Guest data not redacted");
  if (reservation.tokenExpiresAt && Date.parse(reservation.tokenExpiresAt) < todayTimestamp(today)) warnings.push("Check-in link expired");

  return Array.from(new Set(warnings));
};

export const reservationViewModel = (reservation = {}, options = {}) => {
  const groupId = categorizeReservation(reservation, options);
  return {
    reservation,
    groupId,
    statusLabel: statusLabelFor(normalizedStatus(reservation)),
    guestMix: guestMixLabel(reservation),
    nextAction: nextActionFor(reservation, groupId),
    warnings: warningsForReservation(reservation, groupId, options),
    daysUntilCheckIn: daysUntilCheckIn(reservation, options.today || new Date())
  };
};

const sortByArrival = (a, b) => {
  const aTime = parseDateOnly(a.reservation?.checkIn) ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseDateOnly(b.reservation?.checkIn) ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return String(a.reservation?.guestName || a.reservation?.uid || "").localeCompare(String(b.reservation?.guestName || b.reservation?.uid || ""));
};

export const groupReservations = (reservations = [], options = {}) => {
  const groups = new Map(
    dashboardGroupDefinitions.map((definition) => [
      definition.id,
      {
        ...definition,
        reservations: []
      }
    ])
  );

  for (const reservation of reservations) {
    const view = reservationViewModel(reservation, options);
    groups.get(view.groupId)?.reservations.push(view);
  }

  return dashboardGroupDefinitions.map((definition) => {
    const group = groups.get(definition.id);
    return {
      ...group,
      reservations: group.reservations.sort(sortByArrival)
    };
  });
};

export const dashboardSummary = (reservations = [], options = {}) => {
  const summary = {
    needsAttention: 0,
    waitingForGuest: 0,
    readyForAuthority: 0,
    upcomingArrivals: 0,
    completedArchived: 0,
    blockedDates: 0
  };
  const definitionsById = new Map(dashboardGroupDefinitions.map((definition) => [definition.id, definition]));

  for (const reservation of reservations) {
    const groupId = categorizeReservation(reservation, options);
    const bucket = definitionsById.get(groupId)?.summaryBucket;
    if (bucket) summary[bucket] += 1;
  }

  return summary;
};

const notificationTimestamp = (notification = {}) => Date.parse(notification.createdAt || notification.submittedAt || "") || 0;

const notificationDedupeKey = (notification = {}) => {
  if (notification.type === "checkin_submitted") {
    if (notification.reservationUid) return `checkin_submitted:${notification.reservationUid}`;
    const fallback = [notification.reservationCode, notification.checkIn, notification.checkOut].filter(Boolean).join(":");
    if (fallback) return `checkin_submitted:${fallback}`;
  }
  return `${notification.type || "notification"}:${notification.id || notification.createdAt || notification.submittedAt || JSON.stringify(notification)}`;
};

export const dedupeNotifications = (notifications = [], options = {}) => {
  const limit = options.limit ?? 50;
  const sorted = [...notifications].sort((a, b) => notificationTimestamp(b) - notificationTimestamp(a));
  const deduped = new Map();

  for (const notification of sorted) {
    const key = notificationDedupeKey(notification);
    const existing = deduped.get(key);
    if (existing) {
      existing.duplicateCount = (existing.duplicateCount || 0) + 1;
      continue;
    }
    deduped.set(key, { ...notification, duplicateCount: 0 });
  }

  return Array.from(deduped.values()).slice(0, limit);
};
