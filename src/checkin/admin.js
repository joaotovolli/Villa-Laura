import { accessLogoutUrl, usesCloudflareAccessSession } from "./admin-client.js?v=checkin-draft-20260503";
import { buildLocalizedGuestMessage, languageLabels, normalizeLanguage } from "./i18n.js?v=checkin-draft-20260503";

const app = document.querySelector("#app");
const state = { reservations: [], session: null, syncStatus: "" };

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
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

const accessDenied = () => {
  app.innerHTML = `
    <section class="panel stack">
      <h2>Access denied</h2>
      <p>This admin area is protected by Cloudflare Access. Open it through the approved admin email account.</p>
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
        <button class="secondary" data-action="submission" ${hasSubmission ? "" : "disabled"}>View submitted check-in</button>
        <button class="secondary" data-action="submission" ${hasSubmission && reservation.documentCount ? "" : "disabled"}>View/download documents</button>
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
      ${dataManagementSection(reservation, checkinLink)}
      <div class="actions">
        <button data-action="save">Save</button>
        <button class="secondary" data-action="token">Create check-in link</button>
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

const render = () => {
  const reservations = state.reservations.filter((entry) => entry.type === "reservation");
  const blocked = state.reservations.filter((entry) => entry.type === "blocked");
  app.innerHTML = `
    <section class="stack">
      <div class="top">
        <div><h2>Reservations</h2><p>${reservations.length} reservations · ${blocked.length} blocked date ranges</p></div>
        <div class="actions"><button id="sync">Import Airbnb iCal</button><a id="logout" class="button secondary" href="${accessLogoutUrl}">Log out</a></div>
      </div>
      <div id="sync-status" class="notice ${state.syncStatus ? "" : "hidden"}">${escapeHtml(state.syncStatus)}</div>
      <section class="stack">
        <h2>Reservations</h2>
        <p class="muted">Use real reservations to generate guest check-in links. Blocked dates cannot be used for check-in.</p>
        <p class="muted">Use fake documents for testing. Do not upload real passports until upload, review, and deletion have been verified.</p>
        <div class="stack">${reservations.map(row).join("") || `<p>No reservations imported yet.</p>`}</div>
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
            reservation.tokenCreatedAt = new Date().toISOString();
            reservation.lastMessage = result.message;
            await navigator.clipboard.writeText(result.message);
            setOutput(`Check-in link created and message copied. Link: ${result.link}`);
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
            const docs = (result.submission.documents || [])
              .map(
                (doc) =>
                  `<a href="/api/admin/document?token=${encodeURIComponent(token)}&guestId=${encodeURIComponent(doc.guestId)}&filename=${encodeURIComponent(doc.filename)}" target="_blank" rel="noopener">${escapeHtml(doc.originalName || doc.filename)}</a>`
              )
              .join(" · ");
            output.classList.remove("hidden");
            output.innerHTML = `Submission received for ${result.submission.numberOfGuests} guest(s). Adults: ${result.submission.adults || 0}. Minors: ${result.submission.minors || 0}. Infants: ${result.submission.infants || 0}. Documents: ${docs || "none"}`;
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
  const result = await api("/api/admin/reservations");
  state.reservations = result.reservations;
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
    if (session.authenticated) await load();
    else accessDenied();
  } catch {
    accessDenied();
  }
};

init();
