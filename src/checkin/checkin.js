const state = { token: new URLSearchParams(location.search).get("token") || "", reservation: null };
const app = document.querySelector("#app");

const api = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
};

const guestFields = (index) => `
  <section class="guest-card stack">
    <h3>Guest ${index + 1}</h3>
    <div class="grid">
      <label>First name<input name="guest_${index}_firstName" required autocomplete="given-name"></label>
      <label>Last name<input name="guest_${index}_lastName" required autocomplete="family-name"></label>
      <label>Date of birth<input name="guest_${index}_dateOfBirth" type="date" required></label>
      <label>Place of birth<input name="guest_${index}_placeOfBirth" required></label>
      <label>Citizenship<input name="guest_${index}_citizenship" required></label>
      <label>Sex / gender<select name="guest_${index}_gender" required><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label>
      <label>Document type<select name="guest_${index}_documentType" required><option value="">Select</option><option>Passport</option><option>Identity card</option><option>Other official document</option></select></label>
      <label>Document number<input name="guest_${index}_documentNumber" required></label>
      <label>Issuing country/place<input name="guest_${index}_documentIssuingCountry" required></label>
      <label>Document expiry date<input name="guest_${index}_documentExpiryDate" type="date"></label>
      <label>Document upload<input name="guest_${index}_documentUpload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"></label>
    </div>
  </section>
`;

const renderForm = () => {
  app.innerHTML = `
    <form id="checkin-form" class="stack" enctype="multipart/form-data">
      <input type="hidden" name="token" value="${state.token}">
      <section class="panel stack">
        <h2>Reservation</h2>
        <div class="grid">
          <label>Arrival date<input name="arrivalDate" type="date" required value="${state.reservation.checkIn || ""}"></label>
          <label>Departure date<input name="departureDate" type="date" required value="${state.reservation.checkOut || ""}"></label>
          <label>Number of guests<input id="guest-count" name="numberOfGuests" type="number" min="1" max="16" required value="1"></label>
          <label>Main guest email<input name="mainGuestEmail" type="email" required autocomplete="email"></label>
          <label>Main guest phone<input name="mainGuestPhone" type="tel" required autocomplete="tel"></label>
        </div>
      </section>
      <div id="guests" class="stack">${guestFields(0)}</div>
      <section class="panel stack">
        <label><span><input name="privacyAccepted" type="checkbox" required> I confirm this information is accurate and accept the privacy notice.</span></label>
        <p class="muted">Identity document data is used only for required accommodation registration and operational check-in. Uploaded documents are private and deleted after processing or the applicable retention period.</p>
        <div class="actions"><button type="submit">Submit secure check-in</button><span id="message"></span></div>
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
    message.textContent = "Submitting...";
    try {
      const body = new FormData(event.target);
      const result = await api("/api/checkin/submit", { method: "POST", body });
      event.target.innerHTML = `<section class="panel"><h2>Thank you</h2><p class="success">${result.message}</p></section>`;
    } catch (error) {
      message.className = "error";
      message.textContent = error.message;
    }
  });
};

const init = async () => {
  if (!state.token) {
    app.innerHTML = `<section class="panel"><h2>Invalid link</h2><p class="error">Missing check-in token.</p></section>`;
    return;
  }
  try {
    const result = await api(`/api/checkin/token?token=${encodeURIComponent(state.token)}`);
    state.reservation = result.reservation;
    renderForm();
  } catch (error) {
    app.innerHTML = `<section class="panel"><h2>Check-in unavailable</h2><p class="error">${error.message}</p></section>`;
  }
};

init();
