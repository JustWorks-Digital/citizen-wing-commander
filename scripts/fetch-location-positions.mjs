#!/usr/bin/env node
/**
 * Bake CitizenHQ per-POI XYZ (meters) into `lib/fixtures/locationPositions.json`,
 * keyed by our location fixture slugs.
 *
 * Usage: npm run fixtures:fetch-location-positions
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { citizenHqApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "lib/fixtures");

/** Live systems we haul in (CitizenHQ system query is lowercase). */
const SYSTEMS = ["stanton", "pyro", "nyx"];

function normalizeLabel(value) {
  if (!value) return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^["']+|["']+$/g, "");
}

async function fetchPositions(system) {
  const response = await fetch(citizenHqApi.positions(system), {
    headers: {
      Accept: "application/json",
      "User-Agent": "CitizenWingCommander/0.1 (fixture-fetch)",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${system}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected positions payload for ${system}`);
  }
  return data;
}

async function main() {
  const locationsPath = path.join(fixturesDir, "locations.json");
  const locationsDoc = JSON.parse(await readFile(locationsPath, "utf8"));
  const locations = locationsDoc.items ?? [];

  /** @type {Map<string, { slug: string, name: string, system: string | null }[]>} */
  const byName = new Map();
  for (const row of locations) {
    const key = normalizeLabel(row.name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push({
      slug: row.slug,
      name: row.name,
      system: row.system ? String(row.system).trim().toLowerCase() : null,
    });
    byName.set(key, list);
  }

  /** @type {Record<string, object>} */
  const bySlug = {};
  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = [];

  for (const system of SYSTEMS) {
    console.log(`fetching ${system}…`);
    const rows = await fetchPositions(system);
    console.log(`  ${rows.length} positions`);
    for (const row of rows) {
      const key = normalizeLabel(row.name);
      if (!key) {
        unmatched += 1;
        continue;
      }
      const candidates = byName.get(key) ?? [];
      const hit =
        candidates.find((c) => !c.system || c.system === system) ??
        candidates[0] ??
        null;
      if (!hit) {
        unmatched += 1;
        if (unmatchedNames.length < 20) unmatchedNames.push(row.name);
        continue;
      }
      if (
        typeof row.x !== "number" ||
        typeof row.y !== "number" ||
        typeof row.z !== "number" ||
        !Number.isFinite(row.x) ||
        !Number.isFinite(row.y) ||
        !Number.isFinite(row.z)
      ) {
        unmatched += 1;
        continue;
      }
      bySlug[hit.slug] = {
        slug: hit.slug,
        name: hit.name,
        system,
        uuid: row.uuid ?? null,
        type: row.type ?? null,
        parentUuid: row.parentUuid ?? null,
        x: row.x,
        y: row.y,
        z: row.z,
        qtValid: Boolean(row.qtValid),
      };
      matched += 1;
    }
  }

  await mkdir(fixturesDir, { recursive: true });
  const outPath = path.join(fixturesDir, "locationPositions.json");
  const payload = {
    source: citizenHqApi.base,
    sourceLabel: "CitizenHQ positions (system-frame meters)",
    fetchedAt: new Date().toISOString(),
    systems: SYSTEMS,
    matched,
    unmatched,
    unmatchedSample: unmatchedNames,
    items: Object.values(bySlug).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `wrote ${path.relative(root, outPath)} (${payload.items.length} slugs, matched=${matched}, unmatched=${unmatched})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
