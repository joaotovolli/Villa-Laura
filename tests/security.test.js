import assert from "node:assert/strict";
import test from "node:test";
import { allowedDocumentType, randomToken, sanitizeFilename } from "../src/checkin/security.js";
import { publicSubmission, validateSubmission } from "../src/checkin/validation.js";

test("check-in tokens are opaque and do not contain personal data", () => {
  const token = randomToken("vl");
  assert.match(token, /^vl_[A-Za-z0-9_-]{40,}$/);
  assert.equal(token.includes("Guest"), false);
  assert.equal(token.includes("2026"), false);
});

test("document upload validation accepts only expected MIME and extension pairs", () => {
  assert.equal(allowedDocumentType({ name: "scan.pdf", type: "application/pdf" }), true);
  assert.equal(allowedDocumentType({ name: "scan.jpg", type: "image/jpeg" }), true);
  assert.equal(allowedDocumentType({ name: "scan.exe", type: "application/pdf" }), false);
  assert.equal(allowedDocumentType({ name: "scan.pdf", type: "application/octet-stream" }), false);
  assert.equal(sanitizeFilename("../../passport scan.pdf"), "passport-scan.pdf");
});

test("submission validation requires reservation and guest fields", () => {
  const submission = publicSubmission({
    arrivalDate: "2026-07-01",
    departureDate: "2026-07-05",
    numberOfGuests: "1",
    mainGuestEmail: "guest@example.test",
    mainGuestPhone: "+390000000000",
    privacyAccepted: "on",
    guests: [
      {
        firstName: "Test",
        lastName: "Guest",
        dateOfBirth: "1990-01-01",
        placeOfBirth: "Test City",
        citizenship: "Testland",
        gender: "Other",
        documentType: "Passport",
        documentNumber: "TEST123",
        documentIssuingCountry: "Testland"
      }
    ]
  });

  assert.equal(validateSubmission(submission).ok, true);
  assert.equal(validateSubmission({ ...submission, mainGuestEmail: "bad" }).ok, false);
});
