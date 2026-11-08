#!/usr/bin/env node
/**
 * Fetch Star Citizen reference data into committed fixtures.
 *
 * Canonical source list: `.cursor/third-party-sources.yaml`
 * (agents update that registry when adding/changing sources).
 *
 * Usage: npm run fixtures:fetch
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scWikiApi, uexApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "lib/fixtures");

/** UEX item categories that cover trade commodities / harvestables. */
const UEX_COMMODITY_ITEM_CATEGORY_IDS = [36, 87];
const PAGE_SIZE = 100;

/** UEX place names → wiki location slug when names do not match 1:1. */
const OUTDOOR_FE_SLUG_ALIASES = {
  "checkmate station": ["checkmate"],
  "nyx gateway (stanton)": ["nyx-gateway", "nyx-gateway-2"],
  "pyro gateway (stanton)": ["pyro-gateway", "pyro-gateway-2"],
  "stanton gateway (pyro)": ["stanton-gateway", "stanton-gateway-2"],
  "terra gateway (stanton)": ["terra-gateway"],
};

/**
 * Classic SC cargo-crate color pairs by commodity kind (named colors, UEX-style).
 * Used when UEX item `color`/`color2` are empty for a commodity.
 */
const KIND_CRATE_COLORS = {
  metal: { color: "green", color2: "yellow" },
  alloy: { color: "green", color2: "yellow" },
  "non-metal": { color: "green", color2: "yellow" },
  mineral: { color: "gray", color2: "yellow" },
  minteral: { color: "gray", color2: "yellow" },
  gas: { color: "black", color2: "blue" },
  halogen: { color: "black", color2: "blue" },
  liquid: { color: "black", color2: "blue" },
  fuel: { color: "black", color2: "red" },
  food: { color: "white", color2: "gray" },
  agricultural: { color: "green", color2: "black" },
  seed: { color: "green", color2: "black" },
  medical: { color: "red", color2: "white" },
  medicine: { color: "red", color2: "white" },
  vice: { color: "white", color2: "gray" },
  drug: { color: "green", color2: "black" },
  scrap: { color: "black", color2: "orange" },
  waste: { color: "black", color2: "yellow" },
  explosive: { color: "red", color2: "black" },
  ammunition: { color: "brown", color2: "black" },
  electronics: { color: "blue", color2: "white" },
  chemical: { color: "purple", color2: "white" },
  organics: { color: "green", color2: "brown" },
  organic: { color: "green", color2: "brown" },
  animal: { color: "brown", color2: "white" },
  "raw materials": { color: "gray", color2: "yellow" },
  "man-made": { color: "blue", color2: "gray" },
  natural: { color: "green", color2: "gray" },
};

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "citizen-wing-commander-fixtures" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllLocations() {
  const items = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = new URL(scWikiApi.locations);
    // JSON:API-style pagination (page_size alone is ignored by this API).
    url.searchParams.set("page[size]", String(PAGE_SIZE));
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("sort", "name");

    const body = await fetchJson(url.toString());
    lastPage = body.meta?.last_page ?? page;

    for (const row of body.data ?? []) {
      items.push({
        id: row.uuid,
        slug: row.slug,
        name: row.name,
        type: row.type?.name ?? null,
        classification: row.type?.classification ?? null,
        system: row.system ?? row.star?.name ?? null,
        parentName: row.parent?.name ?? null,
        parentType: row.parent?.type_name ?? null,
      });
    }

    console.log(`locations page ${page}/${lastPage} (+${body.data?.length ?? 0})`);
    page += 1;
  } while (page <= lastPage);

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function normalizeNamedColor(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function kindFallbackColors(kind) {
  if (!kind) return { color: null, color2: null };
  const key = String(kind).trim().toLowerCase();
  return KIND_CRATE_COLORS[key] ?? { color: "gray", color2: "white" };
}

async function fetchCommodityItemColorsById() {
  const byId = new Map();
  for (const categoryId of UEX_COMMODITY_ITEM_CATEGORY_IDS) {
    const url = new URL(uexApi.items);
    url.searchParams.set("id_category", String(categoryId));
    const body = await fetchJson(url.toString());
    if (body.status !== "ok" && body.http_code !== 200) {
      throw new Error(
        `UEX items category ${categoryId} status: ${JSON.stringify(body.status)}`,
      );
    }
    for (const row of body.data ?? []) {
      byId.set(row.id, {
        color: normalizeNamedColor(row.color),
        color2: normalizeNamedColor(row.color2),
      });
    }
  }
  return byId;
}

async function fetchCommodities() {
  const [body, itemColors] = await Promise.all([
    fetchJson(uexApi.commodities),
    fetchCommodityItemColorsById(),
  ]);
  if (body.status !== "ok" && body.http_code !== 200) {
    throw new Error(`UEX commodities status: ${JSON.stringify(body.status)}`);
  }

  const items = (body.data ?? [])
    .filter((row) => row.is_visible === 1)
    .map((row) => {
      const fromItem = row.id_item ? itemColors.get(row.id_item) : null;
      const uexColor = fromItem?.color ?? null;
      const uexColor2 = fromItem?.color2 ?? null;
      const fallback = kindFallbackColors(row.kind);
      const color = uexColor ?? fallback.color;
      const color2 = uexColor2 ?? fallback.color2;

      return {
        id: row.id,
        code: row.code,
        slug: row.slug,
        name: row.name,
        kind: row.kind,
        color,
        color2,
        colorSource: uexColor || uexColor2 ? "uex-item" : "kind-fallback",
        isAvailableLive: row.is_available_live === 1,
        isIllegal: row.is_illegal === 1,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return items;
}

async function fetchShips() {
  const body = await fetchJson(uexApi.vehicles);
  if (body.status !== "ok" && body.http_code !== 200) {
    throw new Error(`UEX vehicles status: ${JSON.stringify(body.status)}`);
  }

  // Prefer spaceships; keep cargo SCU for storage planning.
  const items = (body.data ?? [])
    .filter((row) => row.is_spaceship === 1)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameFull: row.name_full,
      manufacturer: row.company_name ?? null,
      cargoScu: typeof row.scu === "number" ? row.scu : 0,
      isCargo: row.is_cargo === 1,
      containerSizes: row.container_sizes
        ? String(row.container_sizes)
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((n) => Number.isFinite(n))
        : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return items;
}

function normalizePlaceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * UEX `has_loading_dock` marks outdoor / external freight elevators
 * (vs hangar-only `has_freight_elevator`).
 */
async function fetchOutdoorFreightElevatorPlaceKeys() {
  const body = await fetchJson(uexApi.terminals);
  if (body.status !== "ok" && body.http_code !== 200) {
    throw new Error(`UEX terminals status: ${JSON.stringify(body.status)}`);
  }

  const keys = new Set();
  for (const row of body.data ?? []) {
    if (row.has_loading_dock !== 1) continue;
    for (const field of ["space_station_name", "outpost_name", "city_name"]) {
      const name = row[field];
      if (!name) continue;
      keys.add(normalizePlaceKey(name));
      const withoutParen = normalizePlaceKey(
        String(name).replace(/\([^)]*\)/g, " "),
      );
      if (withoutParen) keys.add(withoutParen);
    }
  }
  return keys;
}

function withOutdoorFreightElevators(locations, outdoorKeys) {
  const byNameKey = new Map();
  for (const location of locations) {
    const key = normalizePlaceKey(location.name);
    const list = byNameKey.get(key) ?? [];
    list.push(location);
    byNameKey.set(key, list);
  }

  const outdoorSlugs = new Set();
  for (const key of outdoorKeys) {
    for (const location of byNameKey.get(key) ?? []) {
      outdoorSlugs.add(location.slug);
    }
    for (const slug of OUTDOOR_FE_SLUG_ALIASES[key] ?? []) {
      outdoorSlugs.add(slug);
    }
  }

  return locations.map((location) => {
    const next = { ...location };
    if (outdoorSlugs.has(location.slug)) {
      next.hasOutdoorFreightElevator = true;
    } else {
      delete next.hasOutdoorFreightElevator;
    }
    return next;
  });
}

async function writeFixture(filename, payload) {
  const outPath = path.join(fixturesDir, filename);
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(root, outPath)} (${payload.items.length} items)`);
}

async function main() {
  await mkdir(fixturesDir, { recursive: true });
  const fetchedAt = new Date().toISOString();

  const [locationsRaw, commodities, ships, outdoorKeys] = await Promise.all([
    fetchAllLocations(),
    fetchCommodities(),
    fetchShips(),
    fetchOutdoorFreightElevatorPlaceKeys(),
  ]);
  const locations = withOutdoorFreightElevators(locationsRaw, outdoorKeys);
  const outdoorCount = locations.filter(
    (location) => location.hasOutdoorFreightElevator,
  ).length;
  console.log(
    `outdoor freight elevators: ${outdoorCount} location(s) from UEX has_loading_dock`,
  );

  await writeFixture("locations.json", {
    source: scWikiApi.locations,
    sourceLabel: "Star Citizen Wiki starmap",
    secondarySource: uexApi.terminals,
    secondarySourceLabel: "UEX Corp terminals (outdoor freight elevators)",
    fetchedAt,
    items: locations,
  });

  await writeFixture("commodities.json", {
    source: uexApi.commodities,
    sourceLabel: "UEX Corp commodities",
    fetchedAt,
    items: commodities,
  });

  await writeFixture("ships.json", {
    source: uexApi.vehicles,
    sourceLabel: "UEX Corp vehicles (spaceships)",
    fetchedAt,
    items: ships,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
