#!/usr/bin/env node
/**
 * Download Star Citizen Wiki commodity icons into public/icons/commodities/
 * and write a slug → filename manifest for the UI.
 *
 * Source: https://starcitizen.tools/Category:Commodity_icons
 * Registry: `.cursor/third-party-sources.yaml`
 *
 * Usage: npm run fixtures:fetch-commodity-icons
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scToolsWikiApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public/icons/commodities");
const manifestPath = path.join(root, "lib/fixtures/commodityIcons.json");
const commoditiesPath = path.join(root, "lib/fixtures/commodities.json");

const USER_AGENT = "citizen-wing-commander-fixtures";

/** Kind / group icons used when a commodity has no dedicated file. */
const KIND_ICON_FILES = {
  food: "Food.svg",
  agricultural: "Inv Icon AgriculturalSupplies.svg",
  medical: "Medical.svg",
  medicine: "Medical.svg",
  metal: "Metal 256.svg",
  alloy: "Metal 256.svg",
  mineral: "Mineral 256.svg",
  gas: "Inv Icon Gas.svg",
  halogen: "Inv Icon Gas.svg",
  scrap: "Scrap.svg",
  waste: "Waste icon.svg",
  vice: "Vice.svg",
  drug: "Vice.svg",
  "man-made": "Consumer.svg",
  electronics: "Consumer.svg",
  consumer: "Consumer.svg",
};

const MANUAL_SLUG_ALIASES = {
  aluminum: "aluminium",
  "aluminum-ore": "aluminium",
  "altruciatoxin-unprocessed": "altruciatoxinunprocessed",
  "e-tam": "etam",
  "widow": "widow",
  "processed-food": "processedfood",
  "medical-supplies": "medicalsupplies",
  "distilled-spirits": "distilledspirits",
  "inert-materials": "inertmaterials",
  "plasma": "plasmafuel",
  "plasma-fuel": "plasmafuel",
  "quantum-fuel": "quantumfuel",
  "heart-of-the-woods": "heartofthewoods",
  "ranta-dung": "rantadung",
  "revenant-pod": "revenantpod",
  "golden-medmons": "goldenmedmons",
  "sunset-berry": "sunsetberry",
  "amioshi-plague": "amioshiplague",
};

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^inv icon\s+/i, "")
    .replace(/\s+icon$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function fileStemToSlug(title) {
  // "File:Inv Icon Aluminium.svg" → slug-ish filename
  const bare = title.replace(/^File:/i, "").replace(/\.[^.]+$/, "");
  const withoutInv = bare.replace(/^Inv Icon\s+/i, "").replace(/\s+icon$/i, "");
  return withoutInv
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function listCategoryFiles() {
  const files = [];
  let cmcontinue;
  do {
    const url = new URL(scToolsWikiApi.mediaWiki);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", "Category:Commodity_icons");
    url.searchParams.set("cmtype", "file");
    url.searchParams.set("cmlimit", "max");
    url.searchParams.set("format", "json");
    if (cmcontinue) url.searchParams.set("cmcontinue", cmcontinue);
    const data = await fetchJson(url);
    files.push(...(data.query?.categorymembers ?? []));
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);
  return files;
}

async function resolveImageUrls(titles) {
  const byTitle = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const url = new URL(scToolsWikiApi.mediaWiki);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", chunk.join("|"));
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("format", "json");
    const data = await fetchJson(url);
    for (const page of Object.values(data.query?.pages ?? {})) {
      const imageUrl = page.imageinfo?.[0]?.url;
      if (page.title && imageUrl) byTitle.set(page.title, imageUrl);
    }
  }
  return byTitle;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Download ${url} → ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

function pickPreferredFiles(files) {
  /** @type {Map<string, { title: string; localName: string; priority: number }>} */
  const byKey = new Map();

  for (const file of files) {
    const title = file.title;
    if (!/\.(svg|png)$/i.test(title)) continue;
    const key = normalizeKey(title.replace(/^File:/i, "").replace(/\.[^.]+$/, ""));
    const isInv = /^File:Inv Icon /i.test(title);
    const isKind =
      /^(File:Food\.svg|File:Medical\.svg|File:Metal 256\.svg|File:Mineral 256\.svg|File:Scrap\.svg|File:Consumer\.svg|File:Vice\.svg|File:Inv Icon Gas\.svg|File:Inv Icon Default\.svg|File:Inv Icon AgriculturalSupplies\.svg|File:Waste icon\.svg)$/i.test(
        title,
      );
    const priority = isInv ? 3 : isKind ? 2 : 1;
    const localName = `${fileStemToSlug(title)}${path.extname(title).toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || priority > existing.priority) {
      byKey.set(key, { title, localName, priority });
    }
  }

  return byKey;
}

function resolveIconForCommodity(commodity, iconsByKey, localByWikiTitle) {
  const slug = commodity.slug || "";
  const candidates = [
    MANUAL_SLUG_ALIASES[slug],
    normalizeKey(slug),
    normalizeKey(commodity.name),
    normalizeKey(slug.replace(/-(ore|raw|pure|unprocessed)$/i, "")),
    normalizeKey((commodity.name || "").replace(/\s*\((ore|raw|pure|unprocessed)\)\s*$/i, "")),
  ].filter(Boolean);

  for (const key of candidates) {
    const hit = iconsByKey.get(key);
    if (hit) return localByWikiTitle.get(hit.title) ?? hit.localName;
  }

  const kindKey = String(commodity.kind || "").toLowerCase();
  const kindFile = KIND_ICON_FILES[kindKey];
  if (kindFile) {
    const kindLocal = localByWikiTitle.get(`File:${kindFile}`);
    if (kindLocal) return kindLocal;
  }

  return localByWikiTitle.get("File:Inv Icon Default.svg") ?? "default.svg";
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const files = await listCategoryFiles();
  const iconsByKey = pickPreferredFiles(files);
  const titles = [...new Set([...iconsByKey.values()].map((v) => v.title))];
  // Always include kind / default titles even if key-collapsed away.
  for (const title of [
    "File:Inv Icon Default.svg",
    "File:Food.svg",
    "File:Medical.svg",
    "File:Metal 256.svg",
    "File:Mineral 256.svg",
    "File:Scrap.svg",
    "File:Consumer.svg",
    "File:Vice.svg",
    "File:Inv Icon Gas.svg",
    "File:Inv Icon AgriculturalSupplies.svg",
    "File:Waste icon.svg",
  ]) {
    if (!titles.includes(title)) titles.push(title);
  }

  const urlByTitle = await resolveImageUrls(titles);
  /** @type {Map<string, string>} wiki title → local filename */
  const localByWikiTitle = new Map();

  let downloaded = 0;
  for (const title of titles) {
    const imageUrl = urlByTitle.get(title);
    if (!imageUrl) {
      console.warn(`No URL for ${title}`);
      continue;
    }
    const localName = `${fileStemToSlug(title)}${path.extname(title).toLowerCase()}`;
    const dest = path.join(outDir, localName);
    await downloadFile(imageUrl, dest);
    localByWikiTitle.set(title, localName);
    downloaded += 1;
  }

  const commodities = JSON.parse(await readFile(commoditiesPath, "utf8"));
  /** @type {Record<string, string>} */
  const bySlug = {};
  for (const commodity of commodities.items ?? []) {
    if (!commodity.slug) continue;
    bySlug[commodity.slug] = resolveIconForCommodity(
      commodity,
      iconsByKey,
      localByWikiTitle,
    );
  }

  const manifest = {
    source: scToolsWikiApi.commodityIconsCategory,
    sourceLabel: "Star Citizen Wiki commodity icons",
    fetchedAt: new Date().toISOString(),
    publicPath: "/icons/commodities",
    defaultIcon: localByWikiTitle.get("File:Inv Icon Default.svg") ?? "default.svg",
    bySlug,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const dedicated = Object.values(bySlug).filter(
    (f) => f && !["default.svg", "food.svg", "medical.svg", "metal-256.svg", "mineral-256.svg", "scrap.svg", "consumer.svg", "vice.svg", "gas.svg", "agricultural-supplies.svg", "waste.svg"].includes(f),
  ).length;

  console.log(
    `Downloaded ${downloaded} icons → ${path.relative(root, outDir)}`,
  );
  console.log(
    `Manifest ${Object.keys(bySlug).length} slugs (${dedicated} dedicated) → ${path.relative(root, manifestPath)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
