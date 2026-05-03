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
  assert.equal(allowedDocumentType({ name: "scan.jpeg", type: "image/jpeg" }), true);
  assert.equal(allowedDocumentType({ name: "scan.JPG", type: "image/jpeg" }), true);
  assert.equal(allowedDocumentType({ name: "scan.JPEG", type: "image/pjpeg" }), true);
  assert.equal(allowedDocumentType({ name: "scan with spaces.png", type: "image/png" }), true);
  assert.equal(allowedDocumentType({ name: "scan-accentue.webp", type: "image/webp" }), true);
  assert.equal(allowedDocumentType({ name: "scan.exe", type: "application/pdf" }), false);
  assert.equal(allowedDocumentType({ name: "scan.pdf", type: "application/octet-stream" }), false);
  assert.equal(allowedDocumentType({ name: "scan.heic", type: "image/heic" }), false);
  assert.equal(sanitizeFilename("../../passport scan.pdf"), "passport-scan.pdf");
});

test("submission validation requires reservation and guest fields", () => {
  const submission = publicSubmission({
    arrivalDate: "2026-07-01",
    departureDate: "2026-07-05",
    numberOfGuests: "1",
    adults: "1",
    minors: "0",
    infants: "0",
    mainGuestEmail: "guest@example.test",
    mainGuestPhone: "+390000000000",
    privacyAccepted: "on",
    guests: [
      {
        firstName: "Test",
        lastName: "Guest",
        ageCategory: "adult",
        guestType: "single_guest",
        relationshipRole: "main_guest",
        documentAvailable: true,
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

test("minor guests can omit document when linked to responsible adult", () => {
  const submission = publicSubmission({
    arrivalDate: "2026-07-01",
    departureDate: "2026-07-05",
    numberOfGuests: "2",
    adults: "1",
    minors: "1",
    infants: "0",
    mainGuestEmail: "guest@example.test",
    mainGuestPhone: "+390000000000",
    privacyAccepted: "on",
    guests: [
      {
        firstName: "Adult",
        lastName: "Guest",
        ageCategory: "adult",
        guestType: "head_of_family",
        relationshipRole: "main_guest",
        documentAvailable: true,
        dateOfBirth: "1990-01-01",
        placeOfBirth: "Test City",
        citizenship: "Testland",
        gender: "Other",
        documentType: "Passport",
        documentNumber: "TEST123",
        documentIssuingCountry: "Testland"
      },
      {
        firstName: "Minor",
        lastName: "Guest",
        ageCategory: "minor",
        guestType: "family_member",
        relationshipRole: "child",
        responsibleGuestId: "guest-1",
        documentAvailable: false,
        dateOfBirth: "2020-01-01",
        placeOfBirth: "Test City",
        citizenship: "Testland",
        gender: "Other"
      }
    ]
  });

  assert.equal(validateSubmission(submission).ok, true);
  assert.equal(validateSubmission({ ...submission, guests: [{ ...submission.guests[0] }, { ...submission.guests[1], responsibleGuestId: "" }] }).ok, false);
});
