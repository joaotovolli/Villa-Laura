const required = (value) => String(value || "").trim().length > 0;

export const validateSubmission = (submission) => {
  const errors = [];
  if (!required(submission.arrivalDate)) errors.push("arrivalDate");
  if (!required(submission.departureDate)) errors.push("departureDate");
  if (!Number.isInteger(submission.numberOfGuests) || submission.numberOfGuests < 1 || submission.numberOfGuests > 16) {
    errors.push("numberOfGuests");
  }
  if (!Number.isInteger(submission.adults) || submission.adults < 1) errors.push("adults");
  if (!Number.isInteger(submission.minors) || submission.minors < 0) errors.push("minors");
  if (!Number.isInteger(submission.infants) || submission.infants < 0) errors.push("infants");
  if (submission.adults + submission.minors + submission.infants !== submission.numberOfGuests) errors.push("guestComposition");
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
        "ageCategory",
        "guestType"
      ].forEach((field) => {
        if (!required(guest[field])) errors.push(`guests.${index}.${field}`);
      });
      if (guest.ageCategory === "adult") {
        ["documentType", "documentNumber", "documentIssuingCountry"].forEach((field) => {
          if (!required(guest[field])) errors.push(`guests.${index}.${field}`);
        });
      } else if (!required(guest.responsibleGuestId)) {
        errors.push(`guests.${index}.responsibleGuestId`);
      }
      if (guest.documentAvailable) {
        ["documentType", "documentNumber", "documentIssuingCountry"].forEach((field) => {
          if (!required(guest[field])) errors.push(`guests.${index}.${field}`);
        });
      }
    });
  }
  return { ok: errors.length === 0, errors };
};

export const publicSubmission = (formValue) => ({
  arrivalDate: String(formValue.arrivalDate || ""),
  departureDate: String(formValue.departureDate || ""),
  numberOfGuests: Number.parseInt(formValue.numberOfGuests, 10),
  adults: Number.parseInt(formValue.adults, 10),
  minors: Number.parseInt(formValue.minors, 10) || 0,
  infants: Number.parseInt(formValue.infants, 10) || 0,
  mainGuestEmail: String(formValue.mainGuestEmail || "").trim(),
  mainGuestPhone: String(formValue.mainGuestPhone || "").trim(),
  privacyAccepted: formValue.privacyAccepted === true || formValue.privacyAccepted === "true" || formValue.privacyAccepted === "on",
  guests: Array.isArray(formValue.guests) ? formValue.guests : []
});
