#!/usr/bin/env node
/**
 * Download Star Citizen Wiki location images into public/icons/locations/
 * and write a slug → filename manifest for the UI.
 *
 * Source: https://api.star-citizen.wiki/api/locations
 * Registry: `.cursor/third-party-sources.yaml`
 *
 * Usage: npm run fixtures:fetch-location-images
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scWikiApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public/icons/locations");
const manifestPath = path.join(root, "lib/fixtures/locationImages.json");

const USER_AGENT = "citizen-wing-commander-fixtures";
const PAGE_SIZE = 100;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function imageExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return ".jpg";
    if (pathname.endsWith(".gif")) return ".gif";
  } catch {
    /* ignore */
  }
  return ".jpg";
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

async function listWikiLocations() {
  const items = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = new URL(scWikiApi.locations);
    url.searchParams.set("page[size]", String(PAGE_SIZE));
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("sort", "name");
    const body = await fetchJson(url.toString());
    items.push(...(body.data ?? []));
    lastPage = body.meta?.last_page ?? page;
    console.log(
      `wiki locations page ${page}/${lastPage} (+${body.data?.length ?? 0})`,
    );
    page += 1;
  } while (page <= lastPage);
  return items;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const rows = await listWikiLocations();

  /** @type {Map<string, { slug: string, url: string, sourceUrl: string, file: string }>} */
  const bySlug = new Map();
  let withImage = 0;
  let withoutImage = 0;

  for (const row of rows) {
    const slug = String(row.slug || "")
      .trim()
      .toLowerCase();
    if (!slug) continue;
    const image = (row.images ?? [])[0];
    const url = image?.thumbnail_url || image?.original_url;
    if (!url) {
      withoutImage += 1;
      continue;
    }
    withImage += 1;
    const file = `${slug}${imageExtension(url)}`;
    bySlug.set(slug, {
      slug,
      url,
      sourceUrl: image?.original_url || url,
      file,
    });
  }

  console.log(
    `locations with images: ${withImage}; without: ${withoutImage}; unique slugs: ${bySlug.size}`,
  );

  /** @type {Record<string, string>} */
  const manifestBySlug = {};
  let saved = 0;
  let failed = 0;

  for (const entry of bySlug.values()) {
    const dest = path.join(outDir, entry.file);
    try {
      const bytes = await downloadImage(entry.url, dest);
      manifestBySlug[entry.slug] = entry.file;
      saved += 1;
      if (saved <= 8 || saved % 50 === 0) {
        console.log(`saved ${entry.file} (${bytes} bytes)`);
      }
    } catch (err) {
      failed += 1;
      console.warn(`skip ${entry.slug}: ${err.message}`);
    }
  }

  const manifest = {
    source: scWikiApi.locations,
    sourceLabel: "Star Citizen Wiki starmap locations (images)",
    fetchedAt: new Date().toISOString(),
    publicPath: "/icons/locations",
    coverage: {
      wikiRows: rows.length,
      withImage,
      withoutImage,
      downloaded: saved,
      failed,
    },
    bySlug: Object.fromEntries(
      Object.entries(manifestBySlug).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `wrote ${manifestPath} (${saved} images → ${outDir}; ${failed} failed)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
