#!/usr/bin/env node
/**
 * Fetch RSI starmap orbital data into `lib/fixtures/starmap.json`.
 *
 * Wiki Module:Starmap/starmap.json has object identity but no orbits.
 * RSI exposes distance / latitude / longitude — we store a slim local copy
 * so checklist distances stay offline-editable.
 *
 * Usage: npm run fixtures:fetch-starmap
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rsiStarmapApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "lib/fixtures");

/** Live systems we care about for hauling routes. */
const SYSTEM_CODES = ["STANTON", "PYRO"];

async function postJson(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function slimObject(node, parentCode) {
  return {
    id: node.id,
    code: node.code,
    name: node.name ?? null,
    designation: node.designation ?? null,
    type: node.type,
    distanceAu: node.distance == null ? null : Number(node.distance),
    latitudeDeg: node.latitude == null ? null : Number(node.latitude),
    longitudeDeg: node.longitude == null ? null : Number(node.longitude),
    parentCode: parentCode ?? null,
    parentId: node.parent_id ?? null,
  };
}

async function fetchSystem(code) {
  const body = await postJson(rsiStarmapApi.starSystem(code));
  const system = body?.data?.resultset?.[0];
  if (!system) {
    throw new Error(`No starmap system result for ${code}`);
  }

  const byCode = new Map();
  const queue = [];

  for (const node of system.celestial_objects ?? []) {
    const slim = slimObject(node, null);
    byCode.set(slim.code, slim);
    queue.push(node);
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (!["PLANET", "SATELLITE", "MANMADE", "STAR"].includes(node.type)) {
      continue;
    }
    const detail = await postJson(rsiStarmapApi.celestialObject(node.code));
    const row = detail?.data?.resultset?.[0];
    for (const child of row?.children ?? []) {
      if (byCode.has(child.code)) continue;
      const slim = slimObject(child, node.code);
      byCode.set(slim.code, slim);
      queue.push(child);
    }
  }

  // Resolve parentCode from parentId when missing.
  for (const obj of byCode.values()) {
    if (obj.parentCode || obj.parentId == null) continue;
    for (const candidate of byCode.values()) {
      if (candidate.id === obj.parentId) {
        obj.parentCode = candidate.code;
        break;
      }
    }
  }

  return {
    id: system.id,
    code: system.code,
    name: system.name,
    positionX: system.position_x ?? null,
    positionY: system.position_y ?? null,
    positionZ: system.position_z ?? null,
    objects: [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
}

async function main() {
  const systems = [];
  for (const code of SYSTEM_CODES) {
    console.log(`fetching ${code}…`);
    const system = await fetchSystem(code);
    console.log(`  ${system.objects.length} objects`);
    systems.push(system);
  }

  await mkdir(fixturesDir, { recursive: true });
  const outPath = path.join(fixturesDir, "starmap.json");
  const payload = {
    source: rsiStarmapApi.base,
    sourceLabel: "RSI ARK Starmap (local orbital bake)",
    wikiMirrorNote:
      "Identity overlaps Module:Starmap/starmap.json; orbits come from RSI because the wiki dump strips them.",
    fetchedAt: new Date().toISOString(),
    systems,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(root, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
