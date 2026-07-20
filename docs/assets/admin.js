import { accessLogoutUrl, usesCloudflareAccessSession } from "./admin-client.js?v=admin-dashboard-20260705";
import { buildLocalizedGuestMessage, languageLabels, normalizeLanguage } from "./i18n.js?v=admin-dashboard-20260705";
import {
  dashboardSummary,
  dedupeNotifications,
  groupReservations,
  hasActiveCheckinLink,
  needsManualDetails,
  statusLabelFor
} from "./admin-ops.js?v=admin-dashboard-20260705";

const app = document.querySelector("#app");
const state = { reservations: [], notifications: [], session: null, syncStatus: "" };

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: options.body instanceof FormData ? options.headers : { "content-type": "application/json", ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  const detail = `HTTP ${response.status} - ${contentType.includes("application/json") ? "JSON response" : "non-JSON response"} - ${
    contentType.includes("text/html") ? "looks like Cloudflare Access HTML" : "not Cloudflare Access HTML"
  }`;
  if (!contentType.includes("application/json")) {
    throw new Error(`Admin API request failed. Please log out through Cloudflare Access and log in again. ${detail}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? `Admin API request failed. Please log out through Cloudflare Access and log in again. ${detail}`
        : body.error || `Request failed. ${detail}`
    );
    error.diagnostics = body.diagnostics;
    throw error;
  }
  return body;
};

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

const importMessage = (result) => {
  const diagnostics = result.diagnostics || {};
  const reservations = diagnostics.reservations ?? 0;
  const blocked = diagnostics.blockedDates ?? 0;
  return `Imported ${reservations} reservations and ${blocked} blocked date ranges.`;
};

const diagnosticMessage = (diagnostics = {}) =>
  [
    `iCal URL configured: ${diagnostics.icalUrlConfigured ? "yes" : "no"}`,
    `fetched iCal: ${diagnostics.fetchedIcal ? "yes" : "no"}`,
    `parsed events: ${diagnostics.parsedEvents ?? 0}`,
    `reservations: ${diagnostics.reservations ?? 0}`,
    `blocked dates: ${diagnostics.blockedDates ?? 0}`,
    `storage write: ${diagnostics.storageWriteSuccess ? "yes" : "no"}`,
    `storage readback: ${diagnostics.storageReadbackSuccess ? "yes" : "no"}`
  ].join(" - ");

const adminApiDenied = (message = "Admin API request failed. Please log out through Cloudflare Access and log in again.") => {
  app.innerHTML = `
    <section class="panel stack">
      <h2>Admin API access denied</h2>
      <p>${escapeHtml(message)}</p>
      <p><a class="button secondary" href="${accessLogoutUrl}">Log out through Cloudflare Access</a></p>
    </section>`;
};

const statusOptions = [
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
];

const languageOptions = Object.entries(languageLabels)
  .map(([value, label]) => ({ value, label }))
  .filter(({ value }) => ["en", "fr", "it", "pt", "de", "es"].includes(value));

const absoluteCheckinLink = (reservation) =>
  reservation.token ? `${window.location.origin}/checkin?token=${encodeURIComponent(reservation.token)}` : "";

const normalizeLink = (link) => (link && link.startsWith("/") ? `${window.location.origin}${link}` : link);

const checkinLinkFor = (reservation) => normalizeLink(reservation.checkinLink) || absoluteCheckinLink(reservation);

const buildGuestMessage = (reservation) => {
  const link = checkinLinkFor(reservation);
  if (!link) return "";
  return buildLocalizedGuestMessage({ ...reservation, preferredLanguage: normalizeLanguage(reservation.preferredLanguage) }, link);
};

const whatsappWebUrl = (phone, message) =>
  `https://web.whatsapp.com/send?phone=${String(phone || "").replace(/\D/g, "")}&text=${encodeURIComponent(message)}`;

const displayValue = (value) => escapeHtml(value || "Not provided");

const guestTitle = (reservation) => escapeHtml(reservation.guestName || "Reserved");

const dateRange = (reservation) =>
  `${escapeHtml(reservation.checkIn || "No arrival date")} to ${escapeHtml(reservation.checkOut || "No departure date")}`;

const nightLabel = (reservation) => `${reservation.nights || 0} ${Number(reservation.nights) === 1 ? "night" : "nights"}`;

const groupTone = (groupId) => {
  if (["needs_manual_details", "needs_checkin_link", "cleanup_required"].includes(groupId)) return "attention";
  if (groupId === "authority_ready") return "ready";
  if (groupId === "waiting_for_guest") return "waiting";
  if (groupId === "completed_archived") return "complete";
  if (groupId === "blocked_dates") return "blocked";
  return "neutral";
};

const documentStatusFor = (reservation) => {
  if (reservation.documentsDeletedAt) return `Documents deleted ${escapeHtml(reservation.documentsDeletedAt)}`;
  if (reservation.documentsPresent) return "Documents still stored";
  return "No documents uploaded";
};

const checklistItem = (label, done) => `<li class="${done ? "done" : "todo"}"><span>${done ? "Done" : "Open"}</span>${escapeHtml(label)}</li>`;

const workflowChecklist = (view, checkinLink) => {
  const reservation = view.reservation;
  const docsDeleted = Boolean(reservation.documentsDeletedAt);
  const dataRedacted = Boolean(reservation.personalDataDeletedAt || reservation.status === "data_redacted");
  return `
    <ol class="workflow-list">
      ${checklistItem("Airbnb reservation imported", Boolean(reservation.importedAt || reservation.source))}
      ${checklistItem("Manual details completed", !needsManualDetails(reservation))}
      ${checklistItem("Check-in link created", Boolean(checkinLink || reservation.token))}
      ${checklistItem("Guest submission received", Boolean(reservation.checkinSubmitted))}
      ${checklistItem("Authority review/export handled", ["approved", "submitted_to_alloggiati", "submitted_to_ross1000"].includes(reservation.status))}
      ${checklistItem("Documents deleted", docsDeleted)}
      ${checklistItem("Guest data redacted", dataRedacted)}
    </ol>`;
};

const submissionDetailsHtml = (submission, token) => {
  const documents = submission.documents || [];
  const documentLinks = documents.length
    ? documents
        .map(
          (doc) =>
            `<li>${escapeHtml(doc.guestId)} - <a href="/api/admin/document?token=${encodeURIComponent(token)}&guestId=${encodeURIComponent(doc.guestId)}&filename=${encodeURIComponent(doc.filename)}" target="_blank" rel="noopener">${escapeHtml(doc.originalName || "document")}</a> - ${escapeHtml(doc.type || "")} - ${doc.size || 0} bytes</li>`
        )
        .join("")
    : "<li>No documents available.</li>";
  const guests = (submission.guests || [])
    .map(
      (guest, index) => `
        <details class="guest-review">
          <summary>Guest ${index + 1}: ${displayValue(`${guest.firstName || ""} ${guest.lastName || ""}`.trim())}</summary>
          <dl class="summary-list">
            <div><dt>Category</dt><dd>${displayValue(guest.ageCategory)}</dd></div>
            <div><dt>Guest type</dt><dd>${displayValue(guest.guestType)}</dd></div>
            <div><dt>Relationship / role</dt><dd>${displayValue(guest.relationshipRole)}</dd></div>
            <div><dt>Responsible adult</dt><dd>${displayValue(guest.responsibleGuestId)}</dd></div>
            <div><dt>First name</dt><dd>${displayValue(guest.firstName)}</dd></div>
            <div><dt>Last name</dt><dd>${displayValue(guest.lastName)}</dd></div>
            <div><dt>Sex / gender</dt><dd>${displayValue(guest.gender)}</dd></div>
            <div><dt>Date of birth</dt><dd>${displayValue(guest.dateOfBirth)}</dd></div>
            <div><dt>Place of birth</dt><dd>${displayValue(guest.placeOfBirth)}</dd></div>
            <div><dt>Citizenship / nationality</dt><dd>${displayValue(guest.citizenship)}</dd></div>
            <div><dt>Document available</dt><dd>${guest.documentAvailable ? "yes" : "no"}</dd></div>
            <div><dt>Document type</dt><dd>${displayValue(guest.documentType)}</dd></div>
            <div><dt>Document number</dt><dd>${displayValue(guest.documentNumber)}</dd></div>
            <div><dt>Issuing country/place</dt><dd>${displayValue(guest.documentIssuingCountry)}</dd></div>
            <div><dt>Document expiry</dt><dd>${displayValue(guest.documentExpiryDate)}</dd></div>
          </dl>
        </details>`
    )
    .join("");
  return `
    <section class="review-panel stack">
      <h4>Submitted check-in details</h4>
      <dl class="summary-list">
        <div><dt>Status</dt><dd>${displayValue(submission.status)}</dd></div>
        <div><dt>Submitted at</dt><dd>${displayValue(submission.submittedAt)}</dd></div>
        <div><dt>Draft saved at</dt><dd>${displayValue(submission.draftSavedAt)}</dd></div>
        <div><dt>Arrival</dt><dd>${displayValue(submission.arrivalDate)}</dd></div>
        <div><dt>Departure</dt><dd>${displayValue(submission.departureDate)}</dd></div>
        <div><dt>Guests</dt><dd>${submission.numberOfGuests || 0} total - ${submission.adults || 0} adults - ${submission.minors || 0} minors - ${submission.infants || 0} infants</dd></div>
        <div><dt>Main guest email</dt><dd>${displayValue(submission.mainGuestEmail)}</dd></div>
        <div><dt>Main guest phone</dt><dd>${displayValue(submission.mainGuestPhone)}</dd></div>
        <div><dt>Privacy accepted</dt><dd>${submission.privacyAccepted ? "yes" : "no"}</dd></div>
        <div><dt>Documents</dt><dd>${documents.length}</dd></div>
      </dl>
      <div class="stack">${guests || "<p>No guest details stored.</p>"}</div>
      <details>
        <summary>Uploaded documents</summary>
        <ul>${documentLinks}</ul>
      </details>
    </section>`;
};

const checkinDataSummary = (reservation) => {
  const hasSubmission = Boolean(reservation.checkinSubmitted);
  const hasDraft = Boolean(reservation.draftSaved);
  return `
    <dl class="summary-list">
      <div><dt>Submission status</dt><dd>${escapeHtml(hasSubmission ? reservation.submissionStatus || "submitted" : hasDraft ? "Draft saved" : "Not submitted yet")}</dd></div>
      <div><dt>Submitted at</dt><dd>${displayValue(reservation.submittedAt)}</dd></div>
      <div><dt>Draft saved at</dt><dd>${displayValue(reservation.draftSavedAt)}</dd></div>
      <div><dt>Guests submitted</dt><dd>${reservation.submittedGuests || 0}</dd></div>
      <div><dt>Submitted guest mix</dt><dd>${reservation.submittedAdults || 0} adults - ${reservation.submittedMinors || 0} minors - ${reservation.submittedInfants || 0} infants</dd></div>
      <div><dt>Document count</dt><dd>${reservation.documentCount || 0}</dd></div>
      <div><dt>Document status</dt><dd>${documentStatusFor(reservation)}</dd></div>
      <div><dt>Guest data</dt><dd>${reservation.personalDataDeletedAt ? `Redacted ${escapeHtml(reservation.personalDataDeletedAt)}` : "Stored until cleanup"}</dd></div>
    </dl>`;
};

const reservationFields = (reservation) => {
  const language = normalizeLanguage(reservation.preferredLanguage);
  return `
    <div class="grid">
      <label>Main guest name<input name="guestName" value="${escapeHtml(reservation.guestName || "")}"></label>
      <label>Full phone<input name="fullPhone" value="${escapeHtml(reservation.fullPhone || "")}" placeholder="+393..."></label>
      <label>Email<input name="email" type="email" value="${escapeHtml(reservation.email || "")}"></label>
      <label>Phone last 4<input value="${escapeHtml(reservation.phoneLast4 || "")}" disabled></label>
      <label>Language<select name="preferredLanguage">${languageOptions
        .map(({ value, label }) => `<option value="${value}" ${value === language ? "selected" : ""}>${value} - ${escapeHtml(label)}</option>`)
        .join("")}</select></label>
      <label>Adults<input name="adults" type="number" min="1" max="16" value="${escapeHtml(reservation.adults || reservation.numberOfGuests || 1)}"></label>
      <label>Children / minors<input name="minors" type="number" min="0" max="16" value="${escapeHtml(reservation.minors || 0)}"></label>
      <label>Infants / babies<input name="infants" type="number" min="0" max="16" value="${escapeHtml(reservation.infants || 0)}"></label>
      <label>Arrival time<input name="arrivalTime" value="${escapeHtml(reservation.arrivalTime || "")}" placeholder="15:00"></label>
      <label>Source<input name="source" value="${escapeHtml(reservation.source || "Airbnb")}"></label>
      <label>Reservation code<input value="${escapeHtml(reservation.reservationCode || "")}" disabled></label>
      <label>Status<select name="status">${statusOptions
        .map((status) => `<option value="${status}" ${status === reservation.status ? "selected" : ""}>${escapeHtml(statusLabelFor(status))}</option>`)
        .join("")}</select></label>
    </div>
    <label>Notes<textarea name="notes">${escapeHtml(reservation.notes || "")}</textarea></label>`;
};

const warningChips = (warnings) =>
  warnings.length ? `<ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : "";

const messageActions = (reservation, checkinLink) => {
  const phone = reservation.fullPhone || "";
  return `
    <details class="ops-details">
      <summary>Message templates</summary>
      <p class="muted">${checkinLink ? "Use the copy buttons; the full tokenized link stays hidden from the card." : "Create the check-in link before copying guest messages."}</p>
      <div class="actions">
        <button class="secondary" data-action="copy" ${checkinLink ? "" : "disabled"}>Copy Airbnb message</button>
        ${
          phone
            ? `<a class="button secondary" data-whatsapp href="#" target="_blank" rel="noopener">Open WhatsApp Web</a>`
            : `<button class="secondary" disabled title="Full phone number required">WhatsApp unavailable</button>`
        }
        <button class="secondary" data-action="copy-whatsapp" ${checkinLink ? "" : "disabled"}>Copy WhatsApp message</button>
        <button class="secondary" data-action="regenerate-token" ${checkinLink ? "" : "disabled"}>Regenerate check-in link</button>
        ${reservation.reservationUrl ? `<a class="button secondary" href="${escapeHtml(reservation.reservationUrl)}" target="_blank" rel="noopener">Open Airbnb</a>` : ""}
      </div>
      ${phone ? "" : `<p class="muted">Full phone number required. Copy it manually from Airbnb reservation details.</p>`}
    </details>`;
};

const documentActions = (reservation) => {
  const hasSubmission = Boolean(reservation.checkinSubmitted);
  return `
    <details class="ops-details">
      <summary>Submitted check-in metadata</summary>
      ${checkinDataSummary(reservation)}
      <div class="actions">
        <button class="secondary" data-action="submission" ${hasSubmission ? "" : "disabled"}>View submitted check-in</button>
        <button class="secondary" data-action="submission" ${hasSubmission && reservation.documentCount ? "" : "disabled"}>View/download documents</button>
        <button class="secondary" data-action="download-json" ${hasSubmission ? "" : "disabled"}>Download JSON</button>
        <button class="secondary" data-action="download-csv" ${hasSubmission ? "" : "disabled"}>Download CSV</button>
      </div>
    </details>`;
};

const rawDetails = (reservation, checkinLink) => `
  <details class="ops-details">
    <summary>Raw data/debug information</summary>
    <dl class="summary-list">
      <div><dt>UID</dt><dd>${displayValue(reservation.uid)}</dd></div>
      <div><dt>Reservation code</dt><dd>${displayValue(reservation.reservationCode)}</dd></div>
      <div><dt>iCal summary</dt><dd>${displayValue(reservation.summary)}</dd></div>
      <div><dt>Token status</dt><dd>${displayValue(reservation.tokenStatus || (checkinLink ? "created" : ""))}</dd></div>
      <div><dt>Token created</dt><dd>${displayValue(reservation.tokenCreatedAt)}</dd></div>
      <div><dt>Token expires</dt><dd>${displayValue(reservation.tokenExpiresAt)}</dd></div>
      <div><dt>Imported at</dt><dd>${displayValue(reservation.importedAt)}</dd></div>
      <div><dt>Updated at</dt><dd>${displayValue(reservation.updatedAt)}</dd></div>
    </dl>
  </details>`;

const dangerZone = (reservation, checkinLink) => {
  const hasSubmission = Boolean(reservation.checkinSubmitted);
  const canReset = Boolean(checkinLink || reservation.token);
  return `
    <details class="ops-details danger-zone">
      <summary>Dangerous actions</summary>
      <p class="muted">These actions remove private uploaded documents or submitted guest personal data.</p>
      <div class="actions">
        <button class="danger" data-action="delete-documents" ${hasSubmission && reservation.documentCount ? "" : "disabled"}>Delete uploaded documents</button>
        <button class="danger" data-action="redact-data" ${hasSubmission ? "" : "disabled"}>Delete/redact guest data</button>
        <button class="danger" data-action="reset-checkin" ${canReset ? "" : "disabled"}>Reset check-in</button>
      </div>
    </details>`;
};

const reservationCard = (view) => {
  const reservation = view.reservation;
  const checkinLink = checkinLinkFor(reservation);
  const hasLink = hasActiveCheckinLink(reservation) || Boolean(checkinLink);
  const tone = groupTone(view.groupId);
  return `
    <article class="reservation ops-card stack" data-uid="${escapeHtml(reservation.uid)}" data-group="${escapeHtml(view.groupId)}">
      <div class="ops-card-head">
        <div>
          <h3>${guestTitle(reservation)}</h3>
          <p>${dateRange(reservation)} - ${nightLabel(reservation)}</p>
        </div>
        <span class="status ${tone}">${escapeHtml(view.statusLabel)}</span>
      </div>
      <dl class="ops-facts">
        <div><dt>Guest mix</dt><dd>${escapeHtml(view.guestMix)}</dd></div>
        <div><dt>Arrival</dt><dd>${displayValue(reservation.arrivalTime)}</dd></div>
        <div><dt>Source</dt><dd>${displayValue(reservation.source || "Airbnb")}</dd></div>
        <div><dt>Next action</dt><dd>${escapeHtml(view.nextAction)}</dd></div>
      </dl>
      ${warningChips(view.warnings)}
      <div class="actions primary-actions">
        ${
          hasLink
            ? `<button class="secondary" data-action="copy-link">Copy check-in link</button>`
            : `<button data-action="token">Create check-in link</button>`
        }
        ${reservation.checkinSubmitted ? `<button class="secondary" data-action="submission">View submitted check-in</button>` : ""}
      </div>
      <details class="ops-details">
        <summary>Edit reservation details</summary>
        ${reservationFields(reservation)}
        <div class="actions"><button data-action="save">Save reservation details</button></div>
      </details>
      ${messageActions(reservation, checkinLink)}
      <details class="ops-details">
        <summary>Full checklist</summary>
        ${workflowChecklist(view, checkinLink)}
      </details>
      ${documentActions(reservation)}
      ${rawDetails(reservation, checkinLink)}
      ${dangerZone(reservation, checkinLink)}
      <div class="notice hidden" data-output></div>
    </article>`;
};

const blockedCard = (view) => {
  const reservation = view.reservation;
  return `
    <article class="reservation ops-card blocked-date stack" data-uid="${escapeHtml(reservation.uid)}" data-group="blocked_dates">
      <div class="ops-card-head">
        <div>
          <h3>Blocked date</h3>
          <p>${dateRange(reservation)} - ${nightLabel(reservation)}</p>
        </div>
        <span class="status blocked">Blocked date</span>
      </div>
      <dl class="ops-facts">
        <div><dt>Source</dt><dd>${displayValue(reservation.source || "Airbnb")}</dd></div>
        <div><dt>Reason</dt><dd>${displayValue(reservation.summary || "Not available")}</dd></div>
      </dl>
      <details class="ops-details">
        <summary>Raw data/debug information</summary>
        <p class="muted">UID: ${escapeHtml(reservation.uid)}</p>
      </details>
    </article>`;
};

const notificationItem = (notification) => `
  <article class="notification">
    <strong>${escapeHtml(notification.type === "checkin_submitted" ? "Check-in submitted" : notification.type)}</strong>
    <p>${escapeHtml(notification.checkIn)} to ${escapeHtml(notification.checkOut)} - ${notification.numberOfGuests || 0} guests - ${escapeHtml(notification.submittedAt || notification.createdAt)}</p>
    ${notification.duplicateCount ? `<p class="muted">${notification.duplicateCount} duplicate ${notification.duplicateCount === 1 ? "notification" : "notifications"} hidden.</p>` : ""}
  </article>`;

const notificationPanel = () => {
  const notifications = dedupeNotifications(state.notifications, { limit: 50 });
  if (!notifications.length) {
    return `<section class="notification-panel stack"><h2>Notifications</h2><p>No recent check-in submissions.</p></section>`;
  }
  const recent = notifications.slice(0, 5);
  const history = notifications.slice(5);
  return `
    <section class="notification-panel stack">
      <div class="section-heading">
        <div>
          <h2>Notifications</h2>
          <p>Recent submitted check-ins only.</p>
        </div>
      </div>
      <div class="stack">${recent.map(notificationItem).join("")}</div>
      ${
        history.length
          ? `<details class="ops-details"><summary>Older notification history (${history.length})</summary><div class="stack">${history.map(notificationItem).join("")}</div></details>`
          : ""
      }
    </section>`;
};

const summaryTile = (label, count) => `
  <div class="summary-tile">
    <span>${escapeHtml(label)}</span>
    <strong>${count}</strong>
  </div>`;

const topSummary = (summary, reservations, blocked) => `
  <section class="admin-summary stack">
    <div class="section-heading">
      <div>
        <h2>Admin operations</h2>
        <p>${reservations.length} reservations - ${blocked.length} blocked date ranges</p>
      </div>
      <div class="actions">
        <a class="button secondary" href="/admin/finances/">Finances</a>
        <button id="sync">Import Airbnb iCal</button>
        <a id="logout" class="button secondary" href="${accessLogoutUrl}">Log out</a>
      </div>
    </div>
    <div class="summary-grid">
      ${summaryTile("Needs attention", summary.needsAttention)}
      ${summaryTile("Waiting for guest", summary.waitingForGuest)}
      ${summaryTile("Ready for authority submission", summary.readyForAuthority)}
      ${summaryTile("Upcoming arrivals", summary.upcomingArrivals)}
      ${summaryTile("Completed / archived", summary.completedArchived)}
    </div>
    <div id="sync-status" class="notice ${state.syncStatus ? "" : "hidden"}">${escapeHtml(state.syncStatus)}</div>
  </section>`;

const groupSection = (group) => {
  const body = `<div class="stack">${group.reservations.map((view) => (group.id === "blocked_dates" ? blockedCard(view) : reservationCard(view))).join("")}</div>`;
  if (group.collapsedByDefault) {
    return `
      <details class="ops-group stack">
        <summary>
          <span>${escapeHtml(group.title)}</span>
          <strong>${group.reservations.length}</strong>
        </summary>
        <p class="muted">${escapeHtml(group.summary)}</p>
        ${body}
      </details>`;
  }
  return `
    <section class="ops-group stack">
      <div class="section-heading">
        <div>
          <h2>${escapeHtml(group.title)}</h2>
          <p>${escapeHtml(group.summary)}</p>
        </div>
        <strong>${group.reservations.length}</strong>
      </div>
      ${body}
    </section>`;
};

const render = () => {
  const reservations = state.reservations.filter((entry) => entry.type === "reservation");
  const blocked = state.reservations.filter((entry) => entry.type === "blocked");
  const summary = dashboardSummary(state.reservations);
  const groups = groupReservations(state.reservations);
  const openGroups = groups.filter((group) => group.reservations.length && !group.collapsedByDefault);
  const collapsedGroups = groups.filter((group) => group.reservations.length && group.collapsedByDefault);

  app.innerHTML = `
    <section class="stack admin-dashboard">
      ${topSummary(summary, reservations, blocked)}
      ${notificationPanel()}
      <section class="stack">
        ${openGroups.map(groupSection).join("") || `<section class="ops-group stack"><h2>No active reservations need action</h2><p>Import Airbnb iCal or open completed/blocked history below.</p></section>`}
      </section>
      <section class="stack secondary-groups">
        ${collapsedGroups.map(groupSection).join("") || ""}
      </section>
      ${
        usesCloudflareAccessSession(state.session)
          ? `<p class="muted">This admin session is managed by Cloudflare Access.</p>`
          : ""
      }
    </section>`;

  document.querySelector("#sync").addEventListener("click", sync);

  document.querySelectorAll(".reservation").forEach((card) => {
    const uid = card.dataset.uid;
    const output = card.querySelector("[data-output]");
    const reservation = state.reservations.find((entry) => entry.uid === uid);
    if (!reservation) return;
    const setOutput = (message) => {
      if (!output) return;
      output.classList.remove("hidden");
      output.textContent = message;
    };
    const whatsApp = card.querySelector("[data-whatsapp]");
    if (whatsApp && reservation.fullPhone) {
      whatsApp.addEventListener("click", (event) => {
        const message = buildGuestMessage(reservation);
        if (!message) {
          event.preventDefault();
          setOutput("Create and copy a check-in link first.");
        } else {
          whatsApp.href = whatsappWebUrl(reservation.fullPhone, message);
        }
      });
    }
    card.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          if (button.dataset.action === "save") {
            const body = Object.fromEntries(new FormDataLike(card));
            body.uid = uid;
            await api("/api/admin/reservations", { method: "PATCH", body: JSON.stringify(body) });
            setOutput("Saved.");
            await load(false);
          }
          if (button.dataset.action === "token") {
            const result = await api("/api/admin/token", { method: "POST", body: JSON.stringify({ uid }) });
            reservation.token = result.token || reservation.token;
            reservation.checkinLink = result.link;
            reservation.tokenCreatedAt = result.existing ? reservation.tokenCreatedAt : new Date().toISOString();
            reservation.lastMessage = result.message;
            await navigator.clipboard.writeText(result.message);
            setOutput(`${result.existing ? "Existing check-in link reused" : "Check-in link created"} and guest message copied.`);
            await load(false);
          }
          if (button.dataset.action === "regenerate-token") {
            if (!confirm("Regenerate check-in link? The old link will stop working and the guest will need the new link.")) return;
            const result = await api("/api/admin/token/regenerate", { method: "POST", body: JSON.stringify({ uid }) });
            reservation.token = result.token || reservation.token;
            reservation.checkinLink = result.link;
            reservation.tokenCreatedAt = new Date().toISOString();
            reservation.lastMessage = result.message;
            await navigator.clipboard.writeText(result.message);
            setOutput(`Check-in link regenerated and guest message copied. Old links disabled: ${result.disabledPreviousTokens || 0}.`);
            await load(false);
          }
          if (button.dataset.action === "copy-link") {
            const link = normalizeLink(reservation.checkinLink) || absoluteCheckinLink(reservation);
            if (link) {
              await navigator.clipboard.writeText(link);
              setOutput("Check-in link copied.");
            } else {
              setOutput("Create a check-in link first.");
            }
          }
          if (button.dataset.action === "copy") {
            const message = reservation.lastMessage || buildGuestMessage(reservation);
            if (message) {
              await navigator.clipboard.writeText(message);
              setOutput("Airbnb message copied.");
            } else {
              setOutput("Create a check-in link first.");
            }
          }
          if (button.dataset.action === "copy-whatsapp") {
            const message = reservation.lastMessage || buildGuestMessage(reservation);
            if (message) {
              await navigator.clipboard.writeText(message);
              setOutput("WhatsApp message copied.");
            } else {
              setOutput("Create a check-in link first.");
            }
          }
          if (button.dataset.action === "submission") {
            const token = reservation.token;
            if (!token) return setOutput("No check-in token is available for this reservation.");
            const result = await api(`/api/admin/submission?token=${encodeURIComponent(token)}`);
            output.classList.remove("hidden");
            output.innerHTML = submissionDetailsHtml(result.submission, token);
          }
          if (button.dataset.action === "download-json" || button.dataset.action === "download-csv") {
            const token = reservation.token;
            if (!token) return setOutput("No check-in token is available for this reservation.");
            const format = button.dataset.action === "download-json" ? "json" : "csv";
            window.open(`/api/admin/export?token=${encodeURIComponent(token)}&format=${format}`, "_blank", "noopener");
          }
          if (button.dataset.action === "delete-documents") {
            const token = reservation.token;
            if (!token) return setOutput("No check-in token is available for this reservation.");
            if (!confirm("Delete uploaded documents for this reservation? This cannot be undone.")) return;
            await api("/api/admin/documents/delete", { method: "POST", body: JSON.stringify({ token }) });
            setOutput("Documents deleted. No documents available.");
            await load(false);
          }
          if (button.dataset.action === "redact-data") {
            const token = reservation.token;
            if (!token) return setOutput("No check-in token is available for this reservation.");
            if (!confirm("Delete/redact guest personal data? This cannot be undone.")) return;
            await api("/api/admin/submission/redact", { method: "POST", body: JSON.stringify({ token }) });
            setOutput("Guest personal data deleted/redacted.");
            await load(false);
          }
          if (button.dataset.action === "reset-checkin") {
            const token = reservation.token;
            if (!token) return setOutput("No check-in token is available for this reservation.");
            if (!confirm("Reset check-in for this reservation? Uploaded documents and submitted guest data will be deleted/redacted. This cannot be undone.")) return;
            await api("/api/admin/checkin/reset", { method: "POST", body: JSON.stringify({ token }) });
            setOutput("Check-in reset. The existing link can be used for another test.");
            await load(false);
          }
        } catch (error) {
          setOutput(error.message);
        }
      });
    });
  });
};

function FormDataLike(element) {
  return Array.from(element.querySelectorAll("input[name],select[name],textarea[name]")).map((field) => [field.name, field.value]);
}

const load = async (rerender = true) => {
  const [result, notifications] = await Promise.all([
    api("/api/admin/reservations"),
    api("/api/admin/notifications").catch(() => ({ notifications: [] }))
  ]);
  state.reservations = result.reservations;
  state.notifications = notifications.notifications || [];
  if (rerender) render();
};

const sync = async () => {
  state.syncStatus = "Import started.";
  render();
  const button = document.querySelector("#sync");
  button.disabled = true;
  try {
    const result = await api("/api/admin/sync", { method: "POST", body: "{}" });
    await load(false);
    state.syncStatus = `${importMessage(result)} ${diagnosticMessage(result.diagnostics)}`;
    render();
  } catch (error) {
    state.syncStatus = `Import failed: ${error.message}. ${error.diagnostics ? diagnosticMessage(error.diagnostics) : ""}`;
    render();
  } finally {
    document.querySelector("#sync").disabled = false;
  }
};

const init = async () => {
  try {
    const session = await api("/api/admin/session");
    state.session = session;
  } catch {
    state.session = { authenticated: true, passwordFallbackEnabled: false };
  }

  try {
    await load();
  } catch (error) {
    adminApiDenied(error.message);
  }
};

init();
