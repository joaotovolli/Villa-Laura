import { getCheckinText, normalizeLanguage } from "./i18n.js?v=minor-guest-flow-20260502";

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

const option = (value, label, selected = false) => `<option value="${value}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;

const guestDefaults = (index, adults, minors) => {
  if (index === 0) return { ageCategory: "adult", guestType: adults + minors > 0 ? "head_of_family" : "single_guest", role: "main_guest" };
  if (index < adults) return { ageCategory: "adult", guestType: "family_member", role: "spouse_partner" };
  if (index < adults + minors) return { ageCategory: "minor", guestType: "family_member", role: "child" };
  return { ageCategory: "infant", guestType: "family_member", role: "child" };
};

const guestFields = (index, adults, minors) => {
  const defaults = guestDefaults(index, adults, minors);
  const adultOptions = Array.from({ length: adults }, (_, adultIndex) =>
    option(`guest-${adultIndex + 1}`, `${t().guest} ${adultIndex + 1}`, adultIndex === 0)
  ).join("");
  const isAdult = defaults.ageCategory === "adult";
  return `
  <section class="guest-card stack" data-guest-card="${index}">
    <h3>${escapeHtml(t().guest)} ${index + 1}</h3>
    <div class="grid">
      <label>${escapeHtml(t().guestCategory)}<select name="guest_${index}_ageCategory" data-age-category>
        ${option("adult", t().adult, defaults.ageCategory === "adult")}
        ${option("minor", t().minor, defaults.ageCategory === "minor")}
        ${option("infant", t().infant, defaults.ageCategory === "infant")}
      </select></label>
      <label>${escapeHtml(t().role)}<select name="guest_${index}_relationshipRole">
        ${option("main_guest", t().mainGuest, defaults.role === "main_guest")}
        ${option("spouse_partner", t().spouse, defaults.role === "spouse_partner")}
        ${option("child", t().child, defaults.role === "child")}
        ${option("family_member", t().familyMember, defaults.role === "family_member")}
        ${option("group_member", t().groupMember, defaults.role === "group_member")}
      </select></label>
      <input type="hidden" name="guest_${index}_guestType" value="${escapeHtml(defaults.guestType)}">
      <label class="responsible-field ${isAdult ? "hidden" : ""}">${escapeHtml(t().responsibleAdult)}<select name="guest_${index}_responsibleGuestId">${adultOptions}</select></label>
      <label>${escapeHtml(t().firstName)}<input name="guest_${index}_firstName" required autocomplete="given-name"></label>
      <label>${escapeHtml(t().lastName)}<input name="guest_${index}_lastName" required autocomplete="family-name"></label>
      <label>${escapeHtml(t().dateOfBirth)}<input name="guest_${index}_dateOfBirth" type="date" required></label>
      <label>${escapeHtml(t().placeOfBirth)}<input name="guest_${index}_placeOfBirth" required></label>
      <label>${escapeHtml(t().citizenship)}<input name="guest_${index}_citizenship" required></label>
      <label>${escapeHtml(t().gender)}<select name="guest_${index}_gender" required><option value="">${escapeHtml(t().select)}</option><option>${escapeHtml(t().female)}</option><option>${escapeHtml(t().male)}</option><option>${escapeHtml(t().other)}</option></select></label>
      <label>${escapeHtml(t().documentAvailable)}<select name="guest_${index}_documentAvailable" data-document-available>
        ${option("yes", t().yes, true)}
        ${option("no", t().no, false)}
      </select></label>
      <label>${escapeHtml(t().documentType)}<select name="guest_${index}_documentType" ${isAdult ? "required" : ""}><option value="">${escapeHtml(t().select)}</option><option>${escapeHtml(t().passport)}</option><option>${escapeHtml(t().identityCard)}</option><option>${escapeHtml(t().otherDocument)}</option></select></label>
      <label>${escapeHtml(t().documentNumber)}<input name="guest_${index}_documentNumber" ${isAdult ? "required" : ""}></label>
      <label>${escapeHtml(t().documentIssuingCountry)}<input name="guest_${index}_documentIssuingCountry" ${isAdult ? "required" : ""}></label>
      <label>${escapeHtml(t().documentExpiryDate)}<input name="guest_${index}_documentExpiryDate" type="date"></label>
      <label>${escapeHtml(t().documentUpload)}<input name="guest_${index}_documentUpload" type="file" ${isAdult ? "required" : ""} accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"></label>
    </div>
    <p class="muted minor-note ${isAdult ? "hidden" : ""}">${escapeHtml(t().minorDocumentNote)}</p>
  </section>`;
};

const counts = () => {
  const adults = Math.max(1, Math.min(16, Number.parseInt(document.querySelector("#adult-count")?.value, 10) || 1));
  const minors = Math.max(0, Math.min(16, Number.parseInt(document.querySelector("#minor-count")?.value, 10) || 0));
  const infants = Math.max(0, Math.min(16, Number.parseInt(document.querySelector("#infant-count")?.value, 10) || 0));
  return { adults, minors, infants, total: adults + minors + infants };
};

const refreshGuests = () => {
  const { adults, minors, infants, total } = counts();
  document.querySelector("#guest-count").value = total;
  document.querySelector("#total-guests").textContent = `${t().totalGuests}: ${total}`;
  document.querySelector("#guests").innerHTML = Array.from({ length: total }, (_, index) => guestFields(index, adults, minors)).join("");
  document.querySelectorAll("[data-age-category]").forEach((select) => {
    select.addEventListener("change", () => {
      const card = select.closest("[data-guest-card]");
      const isAdult = select.value === "adult";
      card.querySelector(".responsible-field")?.classList.toggle("hidden", isAdult);
      card.querySelector(".minor-note")?.classList.toggle("hidden", isAdult);
      card.querySelectorAll("[name$='_documentType'],[name$='_documentNumber'],[name$='_documentIssuingCountry'],[name$='_documentUpload']").forEach((field) => {
        field.required = isAdult || card.querySelector("[data-document-available]")?.value === "yes";
      });
    });
  });
  document.querySelectorAll("[data-document-available]").forEach((select) => {
    select.addEventListener("change", () => {
      const card = select.closest("[data-guest-card]");
      const isAdult = card.querySelector("[data-age-category]")?.value === "adult";
      card.querySelectorAll("[name$='_documentType'],[name$='_documentNumber'],[name$='_documentIssuingCountry'],[name$='_documentUpload']").forEach((field) => {
        field.required = isAdult || select.value === "yes";
      });
    });
  });
};

const renderForm = () => {
  setShellLanguage();
  const initialAdults = Math.max(1, Number.parseInt(state.reservation.adults || state.reservation.numberOfGuests, 10) || 1);
  const initialMinors = Math.max(0, Number.parseInt(state.reservation.minors, 10) || 0);
  const initialInfants = Math.max(0, Number.parseInt(state.reservation.infants, 10) || 0);
  app.innerHTML = `
    <form id="checkin-form" class="stack" enctype="multipart/form-data">
      <input type="hidden" name="token" value="${escapeHtml(state.token)}">
      <section class="panel stack">
        <h2>${escapeHtml(t().reservation)}</h2>
        <p class="muted">${escapeHtml(t().everyoneNotice)}</p>
        <div class="grid">
          <label>${escapeHtml(t().arrivalDate)}<input name="arrivalDate" type="date" required value="${escapeHtml(state.reservation.checkIn || "")}"></label>
          <label>${escapeHtml(t().departureDate)}<input name="departureDate" type="date" required value="${escapeHtml(state.reservation.checkOut || "")}"></label>
          <label>${escapeHtml(t().adults)}<input id="adult-count" name="adults" type="number" min="1" max="16" required value="${initialAdults}"></label>
          <label>${escapeHtml(t().minors)}<input id="minor-count" name="minors" type="number" min="0" max="16" required value="${initialMinors}"></label>
          <label>${escapeHtml(t().infants)}<input id="infant-count" name="infants" type="number" min="0" max="16" required value="${initialInfants}"></label>
          <label>${escapeHtml(t().numberOfGuests)}<input id="guest-count" name="numberOfGuests" type="number" readonly value="${initialAdults + initialMinors + initialInfants}"></label>
          <label>${escapeHtml(t().mainGuestEmail)}<input name="mainGuestEmail" type="email" required autocomplete="email"></label>
          <label>${escapeHtml(t().mainGuestPhone)}<input name="mainGuestPhone" type="tel" required autocomplete="tel"></label>
        </div>
        <p id="total-guests" class="muted"></p>
      </section>
      <div id="guests" class="stack"></div>
      <section class="panel stack">
        <label><span><input name="privacyAccepted" type="checkbox" required> ${escapeHtml(t().privacy)}</span></label>
        <p class="muted">${escapeHtml(t().privacyNotice)}</p>
        <div class="actions"><button type="submit">${escapeHtml(t().submit)}</button><span id="message"></span></div>
      </section>
    </form>`;

  ["#adult-count", "#minor-count", "#infant-count"].forEach((selector) => document.querySelector(selector).addEventListener("input", refreshGuests));
  refreshGuests();

  document.querySelector("#checkin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#message");
    message.className = "muted";
    message.textContent = t().submitting;
    try {
      const body = new FormData(event.target);
      await api("/api/checkin/submit", { method: "POST", body });
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
