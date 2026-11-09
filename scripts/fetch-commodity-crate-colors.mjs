#!/usr/bin/env node
/**
 * Fetch Star Citizen Wiki commodity / cargo-crate images, sample display hex
 * colors from those pictures, and write a slug → color/image fixture.
 *
 * Source: https://api.star-citizen.wiki/api/commodities
 * Registry: `.cursor/third-party-sources.yaml`
 *
 * Usage: npm run fixtures:fetch-commodity-crate-colors
 *
 * Requires Python 3 + Pillow for image sampling (`pip3 install pillow`).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { scWikiApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public/icons/commodities/crates");
const manifestPath = path.join(root, "lib/fixtures/commodityCrateColors.json");
const commoditiesPath = path.join(root, "lib/fixtures/commodities.json");

const USER_AGENT = "citizen-wing-commander-fixtures";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function listWikiCommodities() {
  const items = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = new URL(scWikiApi.commodities);
    url.searchParams.set("page", String(page));
    const body = await fetchJson(url.toString());
    items.push(...(body.data ?? []));
    lastPage = body.meta?.last_page ?? page;
    console.log(
      `wiki commodities page ${page}/${lastPage} (+${body.data?.length ?? 0})`,
    );
    page += 1;
  } while (page <= lastPage);
  return items;
}

function imageBasename(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(path.basename(u.pathname))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .toLowerCase();
  } catch {
    return null;
  }
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return buf.length;
}

/**
 * Hand-tuned UI hex for known kind crate renders (cinematic lighting makes
 * automatic averages too gray). Accent ≈ trim / hazard. Product photos still
 * use automatic sampling.
 */
const CRATE_RENDER_HEX = {
  "cargo_-_metal.png": { colorHex: "#4f8f5c", colorHex2: "#e0a63a" },
  "cargo_-_minerals.png": { colorHex: "#8a93a0", colorHex2: "#e0a63a" },
  "cargo_-_scrap.png": { colorHex: "#e07a3a", colorHex2: "#4a4f56" },
  "cargo_-_waste.png": { colorHex: "#a67c52", colorHex2: "#7d8a97" },
  "cargo_-_medical_supplies.png": { colorHex: "#e25555", colorHex2: "#f3f6f9" },
  "cargo_-_non-perishable_foodstuff.png": {
    colorHex: "#f3f6f9",
    colorHex2: "#a9b3bd",
  },
  "cargo_-_agricultural_supplies.png": {
    colorHex: "#3dbf8f",
    colorHex2: "#3a3f46",
  },
  "cargo_-_gas_-_hydrogen.png": { colorHex: "#4a5562", colorHex2: "#e25555" },
  "cargo_-_gas_-_astatine.png": { colorHex: "#4a5562", colorHex2: "#54adf7" },
  "cargo_food.png": { colorHex: "#f3f6f9", colorHex2: "#a9b3bd" },
  "rmc_container.png": { colorHex: "#e07a3a", colorHex2: "#3a3f46" },
  "cargo-acryliplex.jpg": { colorHex: "#54adf7", colorHex2: "#a9b3bd" },
  "cargo-diluthermex.jpg": { colorHex: "#e07a3a", colorHex2: "#e0a63a" },
  "cargo-zeta-prolanide.jpg": { colorHex: "#3dbf8f", colorHex2: "#4a5562" },
};

function sampleColorsWithPython(imagePaths) {
  const helper = `
import json, sys, colorsys
from PIL import Image

paths = json.loads(sys.argv[1])
out = {}

def clamp(n, lo, hi):
    return max(lo, min(hi, n))

def to_hex(r, g, b):
    return "#%02x%02x%02x" % (int(clamp(r,0,255)), int(clamp(g,0,255)), int(clamp(b,0,255)))

def boost_for_ui(r, g, b):
    """Keep hue from crate art; lift lightness so it reads on dark RSI UI."""
    h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
    s = clamp(s * 1.15 if s > 0.08 else 0.45, 0.35, 0.78)
    v = clamp(max(v, 0.55), 0.48, 0.72)
    rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
    return to_hex(rr*255, gg*255, bb*255)

for path in paths:
    try:
        im = Image.open(path).convert("RGBA")
    except Exception as e:
        out[path] = {"error": str(e)}
        continue
    w, h = im.size
    x0, x1 = int(w * 0.18), int(w * 0.82)
    y0, y1 = int(h * 0.08), int(h * 0.72)
    body = []
    accent = []
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            r, g, b, a = im.getpixel((x, y))
            if a < 200:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = 0 if mx == 0 else (mx - mn) / mx
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum < 16 or lum > 245:
                continue
            if sat > 0.28 and 28 < lum < 220:
                accent.append((r, g, b, sat))
            elif 22 < lum < 190:
                body.append((r, g, b, sat))
    def avg(px):
        if not px:
            return None
        n = len(px)
        return (
            sum(p[0] for p in px) / n,
            sum(p[1] for p in px) / n,
            sum(p[2] for p in px) / n,
        )
    # Prefer body paint for Cargo_* crate renders (hazard stripes are accents).
    # Prefer vivid accents for product photos (rocks, drugs, fruit).
    accent_sorted = sorted(accent, key=lambda t: t[3], reverse=True)
    accent_top = accent_sorted[: max(40, len(accent_sorted) // 4)] if accent_sorted else []
    body_avg = avg(body)
    accent_avg = avg(accent_top)
    base = path.rsplit("/", 1)[-1].lower()
    is_crate_render = base.startswith("cargo") or base.startswith("rmc_container")

    def sat_of(rgb):
        r, g, b = rgb
        mx, mn = max(r, g, b), min(r, g, b)
        return 0 if mx == 0 else (mx - mn) / mx

    def lum_of(rgb):
        r, g, b = rgb
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    if is_crate_render and body_avg and accent_avg:
        # Charcoal bodies (scrap) → vivid accent. Tinted bodies (metal olive)
        # stay primary even when raw saturation is low before UI boost.
        body_is_charcoal = lum_of(body_avg) < 48 and sat_of(body_avg) < 0.14
        accent_is_vivid = sat_of(accent_avg) >= 0.22
        if body_is_charcoal and accent_is_vivid:
            primary_rgb, secondary_rgb = accent_avg, body_avg
        else:
            primary_rgb, secondary_rgb = body_avg, accent_avg
    elif is_crate_render:
        primary_rgb = body_avg or accent_avg
        secondary_rgb = accent_avg if body_avg and accent_avg else None
    else:
        primary_rgb = accent_avg or body_avg
        secondary_rgb = body_avg if accent_avg and body_avg else None
    if primary_rgb is None:
        out[path] = {"error": "no_pixels"}
        continue
    out[path] = {
        "colorHex": boost_for_ui(*primary_rgb),
        "colorHex2": boost_for_ui(*secondary_rgb) if secondary_rgb else None,
        "samplePrimary": to_hex(*primary_rgb),
        "sampleSecondary": to_hex(*secondary_rgb) if secondary_rgb else None,
        "accentPixels": len(accent_top),
        "bodyPixels": len(body),
        "mode": "crate" if is_crate_render else "product",
    }
print(json.dumps(out))
`;
  const result = spawnSync(
    "python3",
    ["-c", helper, JSON.stringify(imagePaths)],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(
      `python color sample failed: ${result.stderr || result.stdout}`,
    );
  }
  return JSON.parse(result.stdout);
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const wikiItems = await listWikiCommodities();
  const uex = JSON.parse(await readFile(commoditiesPath, "utf8"));
  const uexSlugs = new Set((uex.items ?? []).map((row) => row.slug));

  /** @type {Map<string, { url: string, file: string, slugs: Set<string> }>} */
  const byUrl = new Map();

  for (const row of wikiItems) {
    const slug = normalizeSlug(row.slug || row.name);
    if (!slug) continue;
    const image = (row.images ?? [])[0];
    const url = image?.original_url || image?.thumbnail_url;
    if (!url) continue;
    const file = imageBasename(url);
    if (!file) continue;
    const existing = byUrl.get(url);
    if (existing) {
      existing.slugs.add(slug);
      continue;
    }
    byUrl.set(url, { url, file, slugs: new Set([slug]) });
  }

  console.log(`unique crate/commodity images: ${byUrl.size}`);

  const downloaded = [];
  for (const entry of byUrl.values()) {
    const dest = path.join(outDir, entry.file);
    try {
      const bytes = await downloadImage(entry.url, dest);
      console.log(`saved ${entry.file} (${bytes} bytes) ← ${[...entry.slugs].slice(0, 3).join(", ")}`);
      downloaded.push({ ...entry, dest });
    } catch (err) {
      console.warn(`skip ${entry.file}: ${err.message}`);
    }
  }

  const samples = sampleColorsWithPython(downloaded.map((d) => d.dest));
  /** @type {Record<string, object>} */
  const bySlug = {};

  for (const entry of downloaded) {
    const sample = samples[entry.dest];
    const tuned = CRATE_RENDER_HEX[entry.file];
    const colorHex = tuned?.colorHex ?? sample?.colorHex;
    const colorHex2 = tuned?.colorHex2 ?? sample?.colorHex2 ?? null;
    if (!colorHex) {
      console.warn(`no color for ${entry.file}: ${sample?.error ?? "empty"}`);
      continue;
    }
    for (const slug of entry.slugs) {
      bySlug[slug] = {
        slug,
        colorHex,
        colorHex2,
        image: `crates/${entry.file}`,
        sourceUrl: entry.url,
        sharedWith: [...entry.slugs].filter((s) => s !== slug).sort(),
        colorSource: tuned ? "wiki-crate-tuned" : "wiki-image",
      };
    }
  }

  // Ensure every UEX fixture slug that has a wiki image is keyed; alias common mismatches.
  const aliases = {
    aluminium: "aluminum",
    "aluminium-ore": "aluminum-ore",
    "sunset-berry": "sunset-berries",
    "e-tam": "etam",
    widow: "widow",
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (!bySlug[from] && bySlug[to]) bySlug[from] = { ...bySlug[to], slug: from };
    if (!bySlug[to] && bySlug[from]) bySlug[to] = { ...bySlug[from], slug: to };
  }

  /** Kind → representative sampled crate image (for UEX rows with no wiki photo). */
  const kindImageFile = {
    metal: "cargo_-_metal.png",
    alloy: "cargo_-_metal.png",
    "non-metal": "cargo_-_metal.png",
    mineral: "cargo_-_minerals.png",
    minteral: "cargo_-_minerals.png",
    gas: "cargo_-_gas_-_hydrogen.png",
    halogen: "cargo_-_gas_-_astatine.png",
    liquid: "cargo_-_gas_-_hydrogen.png",
    fuel: "cargo_-_gas_-_hydrogen.png",
    food: "cargo_-_non-perishable_foodstuff.png",
    agricultural: "cargo_-_agricultural_supplies.png",
    seed: "cargo_-_agricultural_supplies.png",
    medical: "cargo_-_medical_supplies.png",
    medicine: "cargo_-_medical_supplies.png",
    scrap: "cargo_-_scrap.png",
    waste: "cargo_-_waste.png",
    drug: "slamdrug.png",
    vice: "neondrug.png",
    "man-made": "cargo-acryliplex.jpg",
    "raw materials": "cargo_-_minerals.png",
    natural: "cargo_-_agricultural_supplies.png",
    organics: "cargo_-_agricultural_supplies.png",
    organic: "cargo_-_agricultural_supplies.png",
    chemical: "cargo-diluthermex.jpg",
    temporary: "cargo_-_non-perishable_foodstuff.png",
    explosive: "cargo-zeta-prolanide.jpg",
    crafting: "cargo-acryliplex.jpg",
    commodity: "cargo_-_non-perishable_foodstuff.png",
    other: "cargo_-_waste.png",
    animal: "cargo_-_agricultural_supplies.png",
    electronics: "cargo-acryliplex.jpg",
    ammunition: "cargo_-_scrap.png",
  };

  /** @type {Map<string, { colorHex: string, colorHex2: string | null, image: string, sourceUrl: string }>} */
  const colorByFile = new Map();
  for (const entry of downloaded) {
    const sample = samples[entry.dest];
    const tuned = CRATE_RENDER_HEX[entry.file];
    const colorHex = tuned?.colorHex ?? sample?.colorHex;
    if (!colorHex) continue;
    colorByFile.set(entry.file, {
      colorHex,
      colorHex2: tuned?.colorHex2 ?? sample?.colorHex2 ?? null,
      image: `crates/${entry.file}`,
      sourceUrl: entry.url,
    });
  }

  let kindFilled = 0;
  for (const row of uex.items ?? []) {
    if (bySlug[row.slug]) continue;
    const kindKey = String(row.kind || "")
      .trim()
      .toLowerCase();
    const file = kindImageFile[kindKey];
    const tint = file ? colorByFile.get(file) : null;
    if (!tint) continue;
    bySlug[row.slug] = {
      slug: row.slug,
      colorHex: tint.colorHex,
      colorHex2: tint.colorHex2,
      image: tint.image,
      sourceUrl: tint.sourceUrl,
      sharedWith: [],
      colorSource: "kind-crate-image",
    };
    kindFilled += 1;
  }

  const matched = [...uexSlugs].filter((s) => bySlug[s]).length;
  const payload = {
    source: scWikiApi.commodities,
    sourceLabel: "Star Citizen Wiki commodities (cargo crate / product images)",
    fetchedAt: new Date().toISOString(),
    matchedUexSlugs: matched,
    kindFilledUexSlugs: kindFilled,
    totalUexSlugs: uexSlugs.size,
    items: Object.values(bySlug).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `wrote ${manifestPath} (${payload.items.length} slug colors, ${matched}/${uexSlugs.size} UEX matched)`,
  );

  // Keep cargo-box / drug-crate renders in public/; drop large product photos
  // after sampling (hex stays in the JSON fixture).
  const { readdir, unlink, stat } = await import("node:fs/promises");
  const keptFiles = new Set();
  let removed = 0;
  for (const name of await readdir(outDir)) {
    const keep =
      name.startsWith("cargo") ||
      name.startsWith("rmc_container") ||
      name.startsWith("slamdrug") ||
      name.startsWith("mazedrug") ||
      name.startsWith("neondrug") ||
      name.startsWith("widowdrug");
    const full = path.join(outDir, name);
    const size = (await stat(full)).size;
    if (keep || size <= 350_000) {
      keptFiles.add(`crates/${name}`);
      continue;
    }
    await unlink(full);
    removed += 1;
  }
  for (const row of payload.items) {
    if (row.image && !keptFiles.has(row.image)) {
      row.image = null;
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
  if (removed) console.log(`pruned ${removed} large non-crate product photos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
