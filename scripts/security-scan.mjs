import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const tracked = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
if (tracked.status !== 0) {
  console.error("Unable to list tracked files.");
  process.exit(1);
}

const forbiddenNames = [
  "Doc_Keys_Villa_Laura.txt",
  ".env",
  ".dev.vars",
  ".local-data/",
  "local-data/",
  "checkins/",
  "uploads/",
  "secrets/"
];

const files = tracked.stdout.split("\n").filter(Boolean);
const nameFindings = files.filter((file) => forbiddenNames.some((name) => file === name || file.startsWith(name)));

const patterns = [
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "Airbnb iCal URL", re: /https?:\/\/[^\s"'<>]*airbnb[^\s"'<>]*\.ics[^\s"'<>]*/i },
  { name: "Cloudflare token-like value", re: /\bCF[a-zA-Z0-9_-]{35,}\b/ },
  { name: "generic secret assignment", re: /\b(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/i }
];

const contentFindings = [];
for (const file of files) {
  if (/\.(jpg|jpeg|png|webp|gif|svg|zip|heic|mov|mp4|lock)$/i.test(file)) continue;
  const text = await readFile(file, "utf8").catch(() => "");
  for (const pattern of patterns) {
    if (pattern.re.test(text)) contentFindings.push({ file, type: pattern.name });
  }
}

const gitleaks = spawnSync("gitleaks", ["detect", "--redact", "--no-banner"], { encoding: "utf8" });
const hasGitleaks = gitleaks.error?.code !== "ENOENT";

if (nameFindings.length || contentFindings.length || (hasGitleaks && gitleaks.status !== 0)) {
  console.error("Security scan failed. Redacted findings:");
  for (const file of nameFindings) console.error(`- tracked private path: ${file}`);
  for (const finding of contentFindings) console.error(`- ${finding.type}: ${finding.file}`);
  if (hasGitleaks && gitleaks.status !== 0) console.error("- gitleaks reported redacted findings");
  process.exit(1);
}

console.log(hasGitleaks ? "Security scan passed with gitleaks and local checks." : "Security scan passed with local checks. gitleaks not installed.");
