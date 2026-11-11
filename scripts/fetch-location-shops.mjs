#!/usr/bin/env node
/**
 * Build per-location shop fixtures from UEX terminals.
 *
 * Usage: npm run fixtures:fetch-location-shops
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uexApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "lib/fixtures");

function normalizePlaceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "shop"
  );
}

function shopLabelFromTerminal(row) {
  const name = String(row.name || "");
  const company = String(row.company_name || "").trim();
  if (/cargo center/i.test(name)) return "Cargo Center";
  if (company) return company;
  const prefix = name.split(" - ")[0]?.trim();
  if (prefix) return prefix;
  if (row.is_cargo_center === 1) return "Cargo Center";
  if (row.is_refinery === 1) return "Refinery";
  if (row.is_medical === 1) return "Medical";
  if (row.is_food === 1) return "Food";
  if (row.is_shop_vehicle === 1) return "Ship Shop";
  if (row.is_shop_fps === 1) return "FPS Shop";
  if (row.is_refuel === 1 || row.is_repair === 1) return "Refuel / Repair";
  return row.type || "Shop";
}

function placeNames(row) {
  return [row.space_station_name, row.outpost_name, row.city_name, row.displayname]
    .filter(Boolean)
    .map(String);
}

async function main() {
  await mkdir(fixturesDir, { recursive: true });
  const locFile = JSON.parse(
    await readFile(path.join(fixturesDir, "locations.json"), "utf8"),
  );
  const byName = new Map();
  for (const loc of locFile.items ?? []) {
    const key = normalizePlaceKey(loc.name);
    const list = byName.get(key) ?? [];
    list.push(loc);
    byName.set(key, list);
  }

  const res = await fetch(uexApi.terminals, {
    headers: { "User-Agent": "CitizenWingCommander/0.1" },
  });
  if (!res.ok) {
    throw new Error(`UEX terminals HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.status !== "ok" && body.http_code !== 200) {
    throw new Error(`UEX terminals status: ${JSON.stringify(body.status)}`);
  }

  /** @type {Map<string, Map<string, { slug: string, name: string, types: Set<string>, terminalCount: number }>>} */
  const shopsByLocation = new Map();

  function addShop(locationSlug, label, type) {
    const shopSlug = slugify(label);
    if (!shopsByLocation.has(locationSlug)) {
      shopsByLocation.set(locationSlug, new Map());
    }
    const map = shopsByLocation.get(locationSlug);
    const existing = map.get(shopSlug);
    if (existing) {
      existing.terminalCount += 1;
      if (type) existing.types.add(type);
      return;
    }
    map.set(shopSlug, {
      slug: shopSlug,
      name: label,
      types: new Set(type ? [type] : []),
      terminalCount: 1,
    });
  }

  let matchedTerminals = 0;
  for (const row of body.data ?? []) {
    if (row.is_visible === 0) continue;
    const locationSlugs = new Set();
    for (const place of placeNames(row)) {
      const key = normalizePlaceKey(place);
      const withoutParen = normalizePlaceKey(
        String(place).replace(/\([^)]*\)/g, " "),
      );
      for (const k of [key, withoutParen]) {
        for (const loc of byName.get(k) ?? []) locationSlugs.add(loc.slug);
      }
    }
    if (locationSlugs.size === 0) continue;
    matchedTerminals += 1;
    const labels = new Set([shopLabelFromTerminal(row)]);
    if (
      row.is_cargo_center === 1 ||
      /cargo center/i.test(String(row.name || ""))
    ) {
      labels.add("Cargo Center");
    }
    for (const locationSlug of locationSlugs) {
      for (const label of labels) {
        addShop(locationSlug, label, row.type || null);
      }
    }
  }

  const items = [...shopsByLocation.entries()]
    .map(([locationSlug, map]) => ({
      locationSlug,
      shops: [...map.values()]
        .map((shop) => ({
          slug: shop.slug,
          name: shop.name,
          types: [...shop.types].sort(),
          terminalCount: shop.terminalCount,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((row) => row.shops.length > 0)
    .sort((a, b) => a.locationSlug.localeCompare(b.locationSlug));

  const payload = {
    source: uexApi.terminals,
    sourceLabel: "UEX Corp terminals (location shops)",
    fetchedAt: new Date().toISOString(),
    matchedTerminals,
    locationCount: items.length,
    items,
  };

  const outPath = path.join(fixturesDir, "locationShops.json");
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `wrote ${path.relative(root, outPath)} (${items.length} locations, ${matchedTerminals} matched terminals)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
