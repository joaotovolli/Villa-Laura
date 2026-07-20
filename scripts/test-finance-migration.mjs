import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tempDirectory = await mkdtemp(path.join(tmpdir(), "villa-laura-d1-test-"));
const config = path.join(tempDirectory, "wrangler.toml");
const migration = path.resolve("migrations/0001_finance.sql");
const syntheticId = "00000000-0000-0000-0000-000000000001";

try {
  await writeFile(config, `name = "villa-laura-finance-migration-test"
compatibility_date = "2026-05-02"

[[d1_databases]]
binding = "VILLA_LAURA_FINANCE"
database_name = "villa-laura-finance-local-test"
database_id = "${syntheticId}"
`, { encoding: "utf8", mode: 0o600 });

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const result = spawnSync("npx", ["--yes", "wrangler@3.114.15", "d1", "execute", "VILLA_LAURA_FINANCE", "--local", "--file", migration, "--config", config], {
      encoding: "utf8",
      maxBuffer: 20_000_000
    });
    if (result.status !== 0) throw new Error(`Finance migration iteration ${iteration + 1} failed`);
  }
  console.log("Finance migration applied twice successfully in an isolated local D1 database.");
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
