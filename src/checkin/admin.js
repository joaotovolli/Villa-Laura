import { accessLogoutUrl, usesCloudflareAccessSession } from "./admin-client.js?v=admin-workflow-20260503";
import { buildLocalizedGuestMessage, languageLabels, normalizeLanguage } from "./i18n.js?v=admin-workflow-20260503";

const app = document.querySelector("#app");
const state = { reservations: [], notifications: [], session: null, syncStatus: "" };

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: options.body instanceof FormData ? options.headers : { "content-type": "application/json", ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  const detail = `HTTP ${response.status} · ${contentType.includes("application/json") ? "JSON response" : "non-JSON response"} · ${
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
  ].join(" · ");

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

const documentStatusFor = (reservation) => {
  if (reservation.documentsDeletedAt) return `Documents deleted ${escapeHtml(reservation.documentsDeletedAt)}`;
  if (reservation.documentsPresent) return "documents present";
  return "No documents uploaded yet";
};

const checklistItem = (label, done) => `<li class="${done ? "done" : "todo"}"><span>${done ? "Done" : "Open"}</span>${escapeHtml(label)}</li>`;

const workflowChecklist = (reservation, checkinLink) => {
  const manualDetails = Boolean(reservation.guestName && (reservation.fullPhone || reservation.email) && reservation.adults);
  const docsDeleted = Boolean(reservation.documentsDeletedAt);
  const dataRedacted = Boolean(reservation.personalDataDeletedAt || reservation.status === "data_redacted");
  return `
    <details class="workflow" open>
      <summary>Operational checklist</summary>
      <ol>
        ${checklistItem("Airbnb reservation imported", Boolean(reservation.importedAt || reservation.source))}
        ${checklistItem("Manual details completed", manualDetails)}
        ${checklistItem("Check-in link created", Boolean(checkinLink || reservation.token))}
        ${checklistItem("Message sent to guest", ["checkin_sent", "draft_saved", "pending_review", "approved"].includes(reservation.status))}
        ${checklistItem("Draft saved", Boolean(reservation.draftSaved))}
        ${checklistItem("Final check-in submitted", Boolean(reservation.checkinSubmitted))}
        ${checklistItem("Documents uploaded", Boolean(reservation.documentCount))}
        ${checklistItem("Admin review completed", ["approved", "rejected", "submitted_to_alloggiati", "submitted_to_ross1000"].includes(reservation.status))}
        ${checklistItem("Documents deleted", docsDeleted)}
        ${checklistItem("Guest data redacted", dataRedacted)}
        ${checklistItem("Ready for Alloggiati/ROSS1000 handling", ["approved", "submitted_to_alloggiati", "submitted_to_ross1000"].includes(reservation.status))}
      </ol>
    </details>`;
};

const displayValue = (value) => escapeHtml(value || "Not provided");

const submissionDetailsHtml = (submission, token) => {
  const documents = submission.documents || [];
  const documentLinks = documents.length
    ? documents
        .map(
          (doc) =>
            `<li>${escapeHtml(doc.guestId)} · <a href="/api/admin/document?token=${encodeURIComponent(token)}&guestId=${encodeURIComponent(doc.guestId)}&filename=${encodeURIComponent(doc.filename)}" target="_blank" rel="noopener">${escapeHtml(doc.originalName || "document")}</a> · ${escapeHtml(doc.type || "")} · ${doc.size || 0} bytes</li>`
        )
        .join("")
    : "<li>No documents available.</li>";
  const guests = (submission.guests || [])
    .map(
      (guest, index) => `
        <details class="guest-review" open>
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
    <section class="review-panel">
      <h4>Submitted check-in details</h4>
      <dl class="summary-list">
        <div><dt>Status</dt><dd>${displayValue(submission.status)}</dd></div>
        <div><dt>Submitted at</dt><dd>${displayValue(submission.submittedAt)}</dd></div>
        <div><dt>Draft saved at</dt><dd>${displayValue(submission.draftSavedAt)}</dd></div>
        <div><dt>Arrival</dt><dd>${displayValue(submission.arrivalDate)}</dd></div>
        <div><dt>Departure</dt><dd>${displayValue(submission.departureDate)}</dd></div>
        <div><dt>Guests</dt><dd>${submission.numberOfGuests || 0} total · ${submission.adults || 0} adults · ${submission.minors || 0} minors · ${submission.infants || 0} infants</dd></div>
        <div><dt>Main guest email</dt><dd>${displayValue(submission.mainGuestEmail)}</dd></div>
        <div><dt>Main guest phone</dt><dd>${displayValue(submission.mainGuestPhone)}</dd></div>
        <div><dt>Privacy accepted</dt><dd>${submission.privacyAccepted ? "yes" : "no"}</dd></div>
        <div><dt>Documents</dt><dd>${documents.length}</dd></div>
      </dl>
      <div class="stack">${guests || "<p>No guest details stored.</p>"}</div>
      <details open>
        <summary>Uploaded documents</summary>
        <ul>${documentLinks}</ul>
      </details>
    </section>`;
};

const dataManagementSection = (reservation, checkinLink) => {
  const hasSubmission = Boolean(reservation.checkinSubmitted);
  const hasDraft = Boolean(reservation.draftSaved);
  const canReset = Boolean(checkinLink || reservation.token);
  const submittedSummary = hasSubmission
    ? `<dl class="summary-list">
        <div><dt>Submission status</dt><dd>${escapeHtml(reservation.submissionStatus || "submitted")}</dd></div>
        <div><dt>Submitted at</dt><dd>${escapeHtml(reservation.submittedAt || "")}</dd></div>
        <div><dt>Guests submitted</dt><dd>${reservation.submittedGuests || 0}</dd></div>
        <div><dt>Guest mix</dt><dd>${reservation.submittedAdults || 0} adults · ${reservation.submittedMinors || 0} minors · ${reservation.submittedInfants || 0} infants</dd></div>
        <div><dt>Document count</dt><dd>${reservation.documentCount || 0}</dd></div>
        <div><dt>Document status</dt><dd>${documentStatusFor(reservation)}</dd></div>
      </dl>`
    : `<dl class="summary-list">
        <div><dt>Submission status</dt><dd>${hasDraft ? "Draft saved" : "Not submitted yet"}</dd></div>
        ${hasDraft ? `<div><dt>Draft saved at</dt><dd>${escapeHtml(reservation.draftSavedAt || "")}</dd></div>` : ""}
        ${hasDraft ? `<div><dt>Guests started</dt><dd>${reservation.submittedGuests || 0}</dd></div>` : ""}
        ${hasDraft ? `<div><dt>Document count</dt><dd>${reservation.documentCount || 0}</dd></div>` : ""}
        <div><dt>Documents</dt><dd>${hasDraft ? documentStatusFor(reservation) : "No documents uploaded yet"}</dd></div>
        <div><dt>Guest data</dt><dd>${hasDraft ? "Draft only, not final submitted" : "No guest data submitted yet"}</dd></div>
      </dl>`;

  return `
    <section class="notice data-management">
      <h4>Check-in data management</h4>
      ${
        checkinLink
          ? `<p>Check-in link created: yes${reservation.tokenCreatedAt ? ` · Created ${escapeHtml(reservation.tokenCreatedAt)}` : ""}</p>`
          : `<p>Check-in link created: no</p>`
      }
      ${submittedSummary}
      <p class="muted">Delete uploaded documents removes files from private R2 storage.</p>
      <p class="muted">Delete/redact guest data removes submitted personal details but keeps safe operational metadata.</p>
      <p class="muted">Reset check-in prepares this reservation for another test or new submission.</p>
      <div class="actions">
        ${checkinLink ? `<button class="secondary" data-action="copy-link">Copy check-in link</button>` : ""}
        ${checkinLink ? `<button class="secondary" data-action="regenerate-token">Regenerate check-in link</button>` : ""}
        <button class="secondary" data-action="submission" ${hasSubmission ? "" : "disabled"}>View submitted check-in</button>
        <button class="secondary" data-action="submission" ${hasSubmission && reservation.documentCount ? "" : "disabled"}>View/download documents</button>
        <a class="button secondary ${hasSubmission ? "" : "is-disabled"}" ${hasSubmission ? `href="/api/admin/export?token=${encodeURIComponent(reservation.token)}&format=json"` : ""} target="_blank" rel="noopener">Download JSON</a>
        <a class="button secondary ${hasSubmission ? "" : "is-disabled"}" ${hasSubmission ? `href="/api/admin/export?token=${encodeURIComponent(reservation.token)}&format=csv"` : ""} target="_blank" rel="noopener">Download CSV</a>
        <button class="danger" data-action="delete-documents" ${hasSubmission && reservation.documentCount ? "" : "disabled"}>Delete uploaded documents</button>
        <button class="danger" data-action="redact-data" ${hasSubmission ? "" : "disabled"}>Delete/redact guest data</button>
        <button class="danger" data-action="reset-checkin" ${canReset ? "" : "disabled"}>Reset check-in</button>
      </div>
      <details>
        <summary>Fake test checklist</summary>
        <ol>
          <li>Generate check-in link.</li>
          <li>Submit fake check-in with fake document.</li>
          <li>Confirm submission appears here.</li>
          <li>Delete uploaded documents.</li>
          <li>Delete/redact guest data.</li>
          <li>Reset check-in if needed.</li>
        </ol>
      </details>
    </section>`;
};

const row = (reservation) => {
  const phone = reservation.fullPhone || "";
  const whatsAppDisabled = !phone;
  const checkinLink = checkinLinkFor(reservation);
  const language = normalizeLanguage(reservation.preferredLanguage);
  return `
    <article class="reservation stack" data-uid="${escapeHtml(reservation.uid)}">
      <div class="top">
        <div>
          <h3>${escapeHtml(reservation.guestName || reservation.summary || "Reservation")}</h3>
          <p>${escapeHtml(reservation.checkIn)} to ${escapeHtml(reservation.checkOut)} · ${reservation.nights || 0} nights</p>
        </div>
        <span class="status ${reservation.type === "blocked" ? "blocked" : ""}">${escapeHtml(reservation.status || reservation.type)}</span>
      </div>
      <div class="grid">
        <label>Main guest name<input name="guestName" value="${escapeHtml(reservation.guestName || "")}"></label>
        <label>Full phone<input name="fullPhone" value="${escapeHtml(phone)}" placeholder="+393..."></label>
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
          .map((status) => `<option ${status === reservation.status ? "selected" : ""}>${status}</option>`)
          .join("")}</select></label>
      </div>
      ${
        checkinLink
          ? `<p class="muted">Check-in link created${reservation.tokenCreatedAt ? ` ${escapeHtml(reservation.tokenCreatedAt)}` : ""}: <code>${escapeHtml(checkinLink)}</code></p>`
          : ""
      }
      <label>Notes<textarea name="notes">${escapeHtml(reservation.notes || "")}</textarea></label>
      ${workflowChecklist(reservation, checkinLink)}
      ${dataManagementSection(reservation, checkinLink)}
      <div class="actions">
        <button data-action="save">Save reservation details</button>
        ${
          checkinLink
            ? `<button class="secondary" data-action="copy-link">Copy check-in link</button>`
            : `<button class="secondary" data-action="token">Create check-in link</button>`
        }
        ${reservation.reservationUrl ? `<a class="button secondary" href="${escapeHtml(reservation.reservationUrl)}" target="_blank" rel="noopener">Open Airbnb</a>` : ""}
        <button class="secondary" data-action="copy">Copy Airbnb message</button>
        ${
          whatsAppDisabled
            ? `<button class="secondary" disabled title="Full phone number required">WhatsApp unavailable</button><span class="muted">Full phone number required. Copy it manually from Airbnb reservation details.</span>`
            : `<a class="button secondary" data-whatsapp href="#" target="_blank" rel="noopener">Open WhatsApp Web</a>`
        }
        <button class="secondary" data-action="copy-whatsapp">Copy WhatsApp message</button>
      </div>
      <p class="muted">To use WhatsApp Business, open this link in a browser/profile linked to your WhatsApp Business account.</p>
      <div class="notice hidden" data-output></div>
    </article>`;
};

const blockedRow = (reservation) => `
  <article class="reservation stack blocked-date" data-uid="${escapeHtml(reservation.uid)}">
    <div class="top">
      <div>
        <h3>${escapeHtml(reservation.source || "Airbnb")} (${escapeHtml(reservation.summary || "Not available")})</h3>
        <p>${escapeHtml(reservation.checkIn)} to ${escapeHtml(reservation.checkOut)} · ${reservation.nights || 0} nights</p>
      </div>
      <span class="status blocked">blocked</span>
    </div>
    <div class="grid">
      <label>Source<input value="${escapeHtml(reservation.source || "Airbnb")}" disabled></label>
      <label>Status<input value="blocked" disabled></label>
    </div>
    <details>
      <summary>Metadata</summary>
      <p class="muted">UID: ${escapeHtml(reservation.uid)}</p>
    </details>
    <p class="muted">Blocked dates cannot be used for guest check-in links or messages.</p>
  </article>`;

const notificationPanel = () => {
  if (!state.notifications.length) {
    return `<section class="panel stack"><h2>Notifications</h2><p>No submitted check-in notifications yet.</p></section>`;
  }
  return `
    <section class="panel stack">
      <h2>Notifications</h2>
      <p class="muted">Final check-in submissions appear here with minimal metadata only.</p>
      <div class="stack">${state.notifications
        .map(
          (notification) => `
            <article class="notification">
              <strong>${escapeHtml(notification.type === "checkin_submitted" ? "Check-in submitted" : notification.type)}</strong>
              <p>${escapeHtml(notification.checkIn)} to ${escapeHtml(notification.checkOut)} · ${notification.numberOfGuests || 0} guests · ${escapeHtml(notification.submittedAt || notification.createdAt)}</p>
              ${notification.reservationCode ? `<p class="muted">Reservation code: ${escapeHtml(notification.reservationCode)}</p>` : ""}
            </article>`
        )
        .join("")}</div>
    </section>`;
};

const render = () => {
  const reservations = state.reservations.filter((entry) => entry.type === "reservation");
  const blocked = state.reservations.filter((entry) => entry.type === "blocked");
  const pendingReview = reservations.filter((entry) => entry.status === "pending_review" || entry.checkinSubmitted);
  const completed = reservations.filter((entry) =>
    ["approved", "rejected", "submitted_to_alloggiati", "submitted_to_ross1000", "documents_deleted", "data_redacted"].includes(entry.status)
  );
  const active = reservations.filter((entry) => !pendingReview.includes(entry) && !completed.includes(entry));
  app.innerHTML = `
    <section class="stack">
      <div class="top">
        <div><h2>Reservations</h2><p>${reservations.length} reservations · ${blocked.length} blocked date ranges</p></div>
        <div class="actions"><button id="sync">Import Airbnb iCal</button><a id="logout" class="button secondary" href="${accessLogoutUrl}">Log out</a></div>
      </div>
      <div id="sync-status" class="notice ${state.syncStatus ? "" : "hidden"}">${escapeHtml(state.syncStatus)}</div>
      ${notificationPanel()}
      <section class="stack">
        <h2>Pending review</h2>
        <div class="stack">${pendingReview.map(row).join("") || `<p>No submitted check-ins are waiting for review.</p>`}</div>
      </section>
      <section class="stack">
        <h2>Reservations</h2>
        <p class="muted">Use real reservations to generate guest check-in links. Blocked dates cannot be used for check-in.</p>
        <p class="muted">Use fake documents for testing. Do not upload real passports until upload, review, and deletion have been verified.</p>
        <div class="stack">${active.map(row).join("") || `<p>No active reservations imported yet.</p>`}</div>
      </section>
      <section class="stack">
        <h2>Approved / completed</h2>
        <div class="stack">${completed.map(row).join("") || `<p>No approved or completed reservations yet.</p>`}</div>
      </section>
      <section class="stack">
        <h2>Blocked dates</h2>
        <div class="stack">${blocked.map(blockedRow).join("") || `<p>No blocked date ranges imported yet.</p>`}</div>
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
    const setOutput = (message) => {
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
            setOutput(`${result.existing ? "Existing check-in link reused" : "Check-in link created"} and message copied. Link: ${result.link}`);
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
            setOutput(`Check-in link regenerated and message copied. Old links disabled: ${result.disabledPreviousTokens || 0}. Link: ${result.link}`);
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
              setOutput("Message copied.");
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
