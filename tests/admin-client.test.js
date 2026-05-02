import assert from "node:assert/strict";
import test from "node:test";
import { accessLogoutUrl, logoutTarget, usesCloudflareAccessSession } from "../src/checkin/admin-client.js";

test("production Cloudflare Access session uses Access logout URL", () => {
  const session = { authenticated: true, passwordFallbackEnabled: false };

  assert.equal(usesCloudflareAccessSession(session), true);
  assert.equal(logoutTarget(session), "/cdn-cgi/access/logout");
  assert.equal(accessLogoutUrl, "/cdn-cgi/access/logout");
});

test("local password fallback session does not use Access logout URL", () => {
  const session = { authenticated: true, passwordFallbackEnabled: true };

  assert.equal(usesCloudflareAccessSession(session), false);
  assert.equal(logoutTarget(session), "");
});
