const required = (value) => String(value || "").trim().length > 0;

export const validateSubmission = (submission) => {
  const errors = [];
  if (!required(submission.arrivalDate)) errors.push("arrivalDate");
  if (!required(submission.departureDate)) errors.push("departureDate");
  if (!Number.isInteger(submission.numberOfGuests) || submission.numberOfGuests < 1 || submission.numberOfGuests > 16) {
    errors.push("numberOfGuests");
  }
  if (!required(submission.mainGuestEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.mainGuestEmail)) {
    errors.push("mainGuestEmail");
  }
  if (!required(submission.mainGuestPhone)) errors.push("mainGuestPhone");
  if (submission.privacyAccepted !== true) errors.push("privacyAccepted");
  if (!Array.isArray(submission.guests) || submission.guests.length !== submission.numberOfGuests) {
    errors.push("guests");
  } else {
    submission.guests.forEach((guest, index) => {
      [
        "firstName",
        "lastName",
        "dateOfBirth",
        "placeOfBirth",
        "citizenship",
        "gender",
        "documentType",
        "documentNumber",
        "documentIssuingCountry"
      ].forEach((field) => {
        if (!required(guest[field])) errors.push(`guests.${index}.${field}`);
      });
    });
  }
  return { ok: errors.length === 0, errors };
};

export const publicSubmission = (formValue) => ({
  arrivalDate: String(formValue.arrivalDate || ""),
  departureDate: String(formValue.departureDate || ""),
  numberOfGuests: Number.parseInt(formValue.numberOfGuests, 10),
  mainGuestEmail: String(formValue.mainGuestEmail || "").trim(),
  mainGuestPhone: String(formValue.mainGuestPhone || "").trim(),
  privacyAccepted: formValue.privacyAccepted === true || formValue.privacyAccepted === "true" || formValue.privacyAccepted === "on",
  guests: Array.isArray(formValue.guests) ? formValue.guests : []
});
