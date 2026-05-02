import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const walk = (dir) => {
  const output = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (full.includes(`${path.sep}.git${path.sep}`) || full.includes(`${path.sep}node_modules${path.sep}`)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
};

const readText = (file) => readFileSync(file, "utf8");

test("production admin bundle does not contain password form text", () => {
  const adminBundle = readText(path.join(root, "dist", "assets", "admin.js"));

  assert.equal(adminBundle.includes("Admin login"), false);
  assert.equal(/<input[^>]+password/i.test(adminBundle), false);
  assert.equal(adminBundle.toLowerCase().includes("password fallback"), false);
  assert.equal(adminBundle.includes("/api/admin/logout"), false);
  assert.equal(readText(path.join(root, "dist", "assets", "admin-client.js")).includes("https://villa-laura.it/cdn-cgi/access/logout?returnTo=https%3A%2F%2Fvilla-laura.it%2F"), true);
});

test("production admin bundle exposes final reservation workflow controls", () => {
  const adminBundle = readText(path.join(root, "dist", "assets", "admin.js"));

  assert.equal(adminBundle.includes("Email"), true);
  assert.equal(adminBundle.includes("Number of guests"), true);
  assert.equal(adminBundle.includes("Arrival time"), true);
  assert.equal(adminBundle.includes("Source"), true);
  assert.equal(adminBundle.includes("checkin_sent"), true);
  assert.equal(adminBundle.includes("Full phone number required. Copy it manually from Airbnb reservation details."), true);
  assert.equal(adminBundle.includes("Import started."), true);
  assert.equal(adminBundle.includes("Import failed:"), true);
  assert.equal(adminBundle.includes("Imported "), true);
});

test("public repository text does not contain private admin address pattern", () => {
  const files = walk(root).filter((file) => {
    const relative = path.relative(root, file);
    if (relative.startsWith("dist")) return false;
    if (relative.startsWith("docs")) return false;
    if (/\.(jpg|jpeg|png|webp|gif|zip|mov|mp4|heic)$/i.test(file)) return false;
    return true;
  });

  const privateAddressDomain = `hot${"mail.com"}`;
  const offenders = files.filter((file) => readText(file).toLowerCase().includes(privateAddressDomain));
  assert.deepEqual(offenders.map((file) => path.relative(root, file)), []);
});
