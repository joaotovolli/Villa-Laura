import { getCheckinText, normalizeLanguage } from "./i18n.js?v=localized-checkin-whatsapp-20260502";

const params = new URLSearchParams(location.search);
const state = {
  token: params.get("token") || "",
  language: normalizeLanguage(params.get("lang") || "en"),
  reservation: null
};
const app = document.querySelector("#app");

const api = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || getCheckinText(state.language).genericError);
  return body;
};

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

const t = () => getCheckinText(state.language);

const setShellLanguage = () => {
  document.documentElement.lang = state.language;
  document.title = `${t().title} | Villa Laura`;
  document.querySelector("header p").textContent = t().subtitle;
};

const guestFields = (index) => `
  <section class="guest-card stack">
    <h3>${escapeHtml(t().guest)} ${index + 1}</h3>
    <div class="grid">
      <label>${escapeHtml(t().firstName)}<input name="guest_${index}_firstName" required autocomplete="given-name"></label>
      <label>${escapeHtml(t().lastName)}<input name="guest_${index}_lastName" required autocomplete="family-name"></label>
      <label>${escapeHtml(t().dateOfBirth)}<input name="guest_${index}_dateOfBirth" type="date" required></label>
      <label>${escapeHtml(t().placeOfBirth)}<input name="guest_${index}_placeOfBirth" required></label>
      <label>${escapeHtml(t().citizenship)}<input name="guest_${index}_citizenship" required></label>
      <label>${escapeHtml(t().gender)}<select name="guest_${index}_gender" required><option value="">${escapeHtml(t().select)}</option><option>${escapeHtml(t().female)}</option><option>${escapeHtml(t().male)}</option><option>${escapeHtml(t().other)}</option></select></label>
      <label>${escapeHtml(t().documentType)}<select name="guest_${index}_documentType" required><option value="">${escapeHtml(t().select)}</option><option>${escapeHtml(t().passport)}</option><option>${escapeHtml(t().identityCard)}</option><option>${escapeHtml(t().otherDocument)}</option></select></label>
      <label>${escapeHtml(t().documentNumber)}<input name="guest_${index}_documentNumber" required></label>
      <label>${escapeHtml(t().documentIssuingCountry)}<input name="guest_${index}_documentIssuingCountry" required></label>
      <label>${escapeHtml(t().documentExpiryDate)}<input name="guest_${index}_documentExpiryDate" type="date"></label>
      <label>${escapeHtml(t().documentUpload)}<input name="guest_${index}_documentUpload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"></label>
    </div>
  </section>
`;

const renderForm = () => {
  setShellLanguage();
  app.innerHTML = `
    <form id="checkin-form" class="stack" enctype="multipart/form-data">
      <input type="hidden" name="token" value="${escapeHtml(state.token)}">
      <section class="panel stack">
        <h2>${escapeHtml(t().reservation)}</h2>
        <div class="grid">
          <label>${escapeHtml(t().arrivalDate)}<input name="arrivalDate" type="date" required value="${escapeHtml(state.reservation.checkIn || "")}"></label>
          <label>${escapeHtml(t().departureDate)}<input name="departureDate" type="date" required value="${escapeHtml(state.reservation.checkOut || "")}"></label>
          <label>${escapeHtml(t().numberOfGuests)}<input id="guest-count" name="numberOfGuests" type="number" min="1" max="16" required value="1"></label>
          <label>${escapeHtml(t().mainGuestEmail)}<input name="mainGuestEmail" type="email" required autocomplete="email"></label>
          <label>${escapeHtml(t().mainGuestPhone)}<input name="mainGuestPhone" type="tel" required autocomplete="tel"></label>
        </div>
      </section>
      <div id="guests" class="stack">${guestFields(0)}</div>
      <section class="panel stack">
        <label><span><input name="privacyAccepted" type="checkbox" required> ${escapeHtml(t().privacy)}</span></label>
        <p class="muted">${escapeHtml(t().privacyNotice)}</p>
        <div class="actions"><button type="submit">${escapeHtml(t().submit)}</button><span id="message"></span></div>
      </section>
    </form>`;

  const guests = document.querySelector("#guests");
  document.querySelector("#guest-count").addEventListener("input", (event) => {
    const count = Math.max(1, Math.min(16, Number.parseInt(event.target.value, 10) || 1));
    guests.innerHTML = Array.from({ length: count }, (_, index) => guestFields(index)).join("");
  });

  document.querySelector("#checkin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#message");
    message.className = "muted";
    message.textContent = t().submitting;
    try {
      const body = new FormData(event.target);
      const result = await api("/api/checkin/submit", { method: "POST", body });
      event.target.innerHTML = `<section class="panel"><h2>${escapeHtml(t().thankYou)}</h2><p class="success">${escapeHtml(t().success)}</p></section>`;
    } catch (error) {
      message.className = "error";
      message.textContent = error.message === "Invalid document upload" ? t().uploadError : error.message;
    }
  });
};

const init = async () => {
  setShellLanguage();
  if (!state.token) {
    app.innerHTML = `<section class="panel"><h2>${escapeHtml(t().invalidLink)}</h2><p class="error">${escapeHtml(t().missingToken)}</p></section>`;
    return;
  }
  try {
    const result = await api(`/api/checkin/token?token=${encodeURIComponent(state.token)}`);
    state.language = normalizeLanguage(result.language || result.reservation?.language || state.language);
    state.reservation = result.reservation;
    renderForm();
  } catch (error) {
    app.innerHTML = `<section class="panel"><h2>${escapeHtml(t().unavailable)}</h2><p class="error">${escapeHtml(error.message)}</p></section>`;
  }
};

init();
