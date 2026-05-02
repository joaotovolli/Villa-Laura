import { logoutTarget, usesCloudflareAccessSession } from "./admin-client.js";

const app = document.querySelector("#app");
const state = { reservations: [], session: null };

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
};

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

const login = () => {
  app.innerHTML = `
    <form id="login" class="panel stack">
      <h2>Admin login</h2>
      <p>Use Cloudflare Access in production where available. This password fallback uses an HttpOnly session cookie.</p>
      <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <div class="actions"><button type="submit">Login</button><span id="message"></span></div>
    </form>`;
  document.querySelector("#login").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#message");
    message.textContent = "Checking...";
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: event.target.password.value }) });
      await load();
    } catch (error) {
      message.className = "error";
      message.textContent = error.message;
    }
  });
};

const accessDenied = () => {
  app.innerHTML = `
    <section class="panel stack">
      <h2>Access denied</h2>
      <p>This admin area is protected by Cloudflare Access. Open it through the approved admin email account.</p>
    </section>`;
};

const logout = async () => {
  const target = logoutTarget(state.session);
  if (target) {
    await api("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => {});
    window.location.assign(target);
    return;
  }
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  login();
};

const statusOptions = [
  "imported_from_airbnb",
  "waiting_for_guest",
  "pending_review",
  "approved",
  "rejected",
  "submitted_to_alloggiati",
  "submitted_to_ross1000",
  "documents_deleted",
  "blocked"
];

const row = (reservation) => {
  const isReservation = reservation.type === "reservation";
  const phone = reservation.fullPhone || "";
  const whatsAppDisabled = !phone;
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
        <label>Guest name<input name="guestName" value="${escapeHtml(reservation.guestName || "")}"></label>
        <label>Full phone<input name="fullPhone" value="${escapeHtml(phone)}" placeholder="+393..."></label>
        <label>Phone last 4<input value="${escapeHtml(reservation.phoneLast4 || "")}" disabled></label>
        <label>Language<input name="preferredLanguage" value="${escapeHtml(reservation.preferredLanguage || "en")}"></label>
        <label>Reservation code<input value="${escapeHtml(reservation.reservationCode || "")}" disabled></label>
        <label>Status<select name="status">${statusOptions
          .map((status) => `<option ${status === reservation.status ? "selected" : ""}>${status}</option>`)
          .join("")}</select></label>
      </div>
      <label>Notes<textarea name="notes">${escapeHtml(reservation.notes || "")}</textarea></label>
      <div class="actions">
        <button data-action="save">Save</button>
        ${isReservation ? `<button class="secondary" data-action="token">Create check-in link</button>` : ""}
        ${reservation.reservationUrl ? `<a class="button secondary" href="${escapeHtml(reservation.reservationUrl)}" target="_blank" rel="noopener">Open Airbnb</a>` : ""}
        <button class="secondary" data-action="copy" ${isReservation ? "" : "disabled"}>Copy Airbnb message</button>
        ${
          whatsAppDisabled
            ? `<button class="secondary" disabled title="Full phone number required">WhatsApp unavailable</button><span class="muted">Full phone number required. Copy it manually from Airbnb reservation details.</span>`
            : `<a class="button secondary" data-whatsapp href="#" target="_blank" rel="noopener">Open WhatsApp</a>`
        }
        ${reservation.checkinSubmitted ? `<button class="secondary" data-action="submission">View submission</button>` : ""}
      </div>
      <div class="notice hidden" data-output></div>
    </article>`;
};

const render = () => {
  const reservations = state.reservations.filter((entry) => entry.type === "reservation");
  const blocked = state.reservations.filter((entry) => entry.type === "blocked");
  app.innerHTML = `
    <section class="stack">
      <div class="top">
        <div><h2>Reservations</h2><p>${reservations.length} reservations · ${blocked.length} blocked date ranges</p></div>
        <div class="actions"><button id="sync">Import Airbnb iCal</button><button id="logout" class="secondary">Log out</button></div>
      </div>
      <div class="stack">${state.reservations.map(row).join("") || `<p>No reservations imported yet.</p>`}</div>
      ${
        usesCloudflareAccessSession(state.session)
          ? `<p class="muted">This admin session is managed by Cloudflare Access.</p>`
          : ""
      }
    </section>`;

  document.querySelector("#sync").addEventListener("click", sync);
  document.querySelector("#logout").addEventListener("click", logout);

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
        if (!reservation.lastMessage) {
          event.preventDefault();
          setOutput("Create and copy a check-in link first.");
        } else {
          whatsApp.href = `https://wa.me/${reservation.fullPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(reservation.lastMessage)}`;
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
            reservation.lastMessage = result.message;
            await navigator.clipboard.writeText(result.message);
            setOutput(`Check-in link created and message copied. Link: ${result.link}`);
          }
          if (button.dataset.action === "copy") {
            if (reservation.lastMessage) {
              await navigator.clipboard.writeText(reservation.lastMessage);
              setOutput("Message copied.");
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
            output.innerHTML = `Submission received for ${result.submission.numberOfGuests} guest(s). Documents: ${docs || "none"} <button class="danger" data-delete-docs>Delete documents</button>`;
            output.querySelector("[data-delete-docs]")?.addEventListener("click", async () => {
              await api("/api/admin/documents/delete", { method: "POST", body: JSON.stringify({ token }) });
              setOutput("Documents deleted and metadata retained.");
              await load(false);
            });
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
  await api("/api/admin/sync", { method: "POST", body: "{}" });
  await load();
};

const init = async () => {
  try {
    const session = await api("/api/admin/session");
    state.session = session;
    if (session.authenticated) await load();
    else if (session.passwordFallbackEnabled) login();
    else accessDenied();
  } catch {
    accessDenied();
  }
};

init();
