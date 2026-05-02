import assert from "node:assert/strict";
import test from "node:test";
import { accessLogoutUrl, logoutTarget, usesCloudflareAccessSession } from "../src/checkin/admin-client.js";

test("production Cloudflare Access session uses Access logout URL", () => {
  const session = { authenticated: true, passwordFallbackEnabled: false };

  assert.equal(usesCloudflareAccessSession(session), true);
  assert.equal(logoutTarget(session), "https://villa-laura.it/cdn-cgi/access/logout?returnTo=https%3A%2F%2Fvilla-laura.it%2F");
  assert.equal(accessLogoutUrl, "https://villa-laura.it/cdn-cgi/access/logout?returnTo=https%3A%2F%2Fvilla-laura.it%2F");
});

test("local app session does not use Access logout URL", () => {
  const session = { authenticated: true, passwordFallbackEnabled: true };

  assert.equal(usesCloudflareAccessSession(session), false);
  assert.equal(logoutTarget(session), "");
});
