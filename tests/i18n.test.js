import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalizedGuestMessage, getCheckinText, messageTemplates, normalizeLanguage } from "../src/checkin/i18n.js";

test("localized message templates support required languages with English fallback", () => {
  for (const language of ["en", "fr", "it", "pt"]) {
    assert.equal(typeof messageTemplates[language], "function");
  }
  assert.equal(normalizeLanguage("de"), "en");
  assert.match(buildLocalizedGuestMessage({ preferredLanguage: "fr", guestName: "Test" }, "https://example.test/checkin?token=vl_fake"), /Merci pour votre reservation/);
  assert.match(buildLocalizedGuestMessage({ preferredLanguage: "it" }, "https://example.test/checkin?token=vl_fake"), /Grazie per la tua prenotazione/);
  assert.match(buildLocalizedGuestMessage({ preferredLanguage: "pt" }, "https://example.test/checkin?token=vl_fake"), /Obrigado pela sua reserva/);
  assert.match(buildLocalizedGuestMessage({ preferredLanguage: "xx" }, "https://example.test/checkin?token=vl_fake"), /Thank you for your booking/);
});

test("check-in text supports French and English fallback", () => {
  assert.equal(getCheckinText("fr").firstName, "Prenom");
  assert.equal(getCheckinText("fr").submit, "Envoyer le check-in securise");
  assert.equal(getCheckinText("xx").invalidLink, "Invalid link");
});
