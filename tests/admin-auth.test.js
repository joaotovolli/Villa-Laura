import assert from "node:assert/strict";
import test from "node:test";
import {
  getCloudflareAccessIdentity,
  isEmailAllowed,
  parseAllowedAdminEmails,
  passwordFallbackEnabled
} from "../src/checkin/admin-auth.js";

const requestWithHeaders = (headers) => new Request("https://villa-laura.it/api/admin/session", { headers });

const fakeJwt = (payload) => {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", kid: "test-key" })}.${encode(payload)}.fake-signature`;
};

test("production Cloudflare Access email header allows configured admin", async () => {
  const identity = await getCloudflareAccessIdentity(
    requestWithHeaders({ "cf-access-authenticated-user-email": "admin@example.com" }),
    { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" }
  );

  assert.equal(identity.email, "admin@example.com");
  assert.equal(identity.method, "cloudflare_access_header");
});

test("production request without Cloudflare Access identity is not admin", async () => {
  const identity = await getCloudflareAccessIdentity(requestWithHeaders({}), {
    APP_ENV: "production",
    ALLOWED_ADMIN_EMAILS: "admin@example.com"
  });

  assert.equal(identity, null);
  assert.equal(passwordFallbackEnabled({ APP_ENV: "production" }), false);
});

test("production mocked Access JWT payload allows configured admin when strict JWT env is absent", async () => {
  const identity = await getCloudflareAccessIdentity(
    requestWithHeaders({ "cf-access-jwt-assertion": fakeJwt({ email: "admin@example.com", exp: 4102444800, nbf: 0 }) }),
    { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" }
  );

  assert.equal(identity.email, "admin@example.com");
  assert.equal(identity.method, "cloudflare_access_edge");
});

test("local development can keep app fallback enabled", () => {
  assert.equal(passwordFallbackEnabled({ APP_ENV: "local" }), true);
  assert.equal(passwordFallbackEnabled({}), true);
});

test("allowed admin email comes from environment and rejects other users", () => {
  assert.deepEqual(parseAllowedAdminEmails({}), []);
  assert.equal(isEmailAllowed("admin@example.com", { ALLOWED_ADMIN_EMAILS: "admin@example.com" }), true);
  assert.equal(isEmailAllowed("unauthorized@example.com", { ALLOWED_ADMIN_EMAILS: "admin@example.com" }), false);
});

test("non-allowed Cloudflare Access email is rejected", async () => {
  const identity = await getCloudflareAccessIdentity(
    requestWithHeaders({ "cf-access-authenticated-user-email": "unauthorized@example.com" }),
    { APP_ENV: "production", ALLOWED_ADMIN_EMAILS: "admin@example.com" }
  );

  assert.equal(identity, null);
});
