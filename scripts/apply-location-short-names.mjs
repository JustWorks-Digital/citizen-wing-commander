#!/usr/bin/env node
/**
 * Stamp unique one-word `shortName` onto every row in locations.json.
 *
 * Usage: node scripts/apply-location-short-names.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withLocationShortNames } from "../lib/fixtures/locationShortNames.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const locationsPath = path.join(root, "lib/fixtures/locations.json");

async function main() {
  const raw = JSON.parse(await readFile(locationsPath, "utf8"));
  const items = withLocationShortNames(raw.items ?? []);
  const shortNames = new Set(items.map((item) => item.shortName.toLowerCase()));
  await writeFile(
    locationsPath,
    `${JSON.stringify({ ...raw, items }, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `wrote shortName on ${items.length} locations (${shortNames.size} unique)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
