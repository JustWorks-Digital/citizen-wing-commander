/**
 * Named third-party API endpoints (single source of truth for scripts + app).
 * Keep `.cursor/third-party-sources.yaml` in sync when adding/changing sources.
 */

/** Star Citizen Wiki JSON API (starmap, commodities, etc.). */
export const scWikiApi = {
  locations: "https://api.star-citizen.wiki/api/locations",
  commodities: "https://api.star-citizen.wiki/api/commodities",
};

/**
 * RSI ARK Starmap API (orbital distance / lat / lon).
 * Wiki Module:Starmap/starmap.json mirrors identity fields but strips orbits —
 * we bake RSI orbits into `lib/fixtures/starmap.json` for local distance math.
 */
export const rsiStarmapApi = {
  base: "https://robertsspaceindustries.com/api/starmap",
  starSystem: (code) =>
    `https://robertsspaceindustries.com/api/starmap/star-systems/${encodeURIComponent(code)}`,
  celestialObject: (code) =>
    `https://robertsspaceindustries.com/api/starmap/celestial-objects/${encodeURIComponent(code)}`,
};

/** MediaWiki host used for commodity icon downloads. */
export const scToolsWikiApi = {
  mediaWiki: "https://starcitizen.tools/api.php",
  commodityIconsCategory:
    "https://starcitizen.tools/Category:Commodity_icons",
};

/** UEX Corp public API v2. */
export const uexApi = {
  base: "https://api.uexcorp.uk/2.0",
  commodities: "https://api.uexcorp.uk/2.0/commodities",
  items: "https://api.uexcorp.uk/2.0/items",
  vehicles: "https://api.uexcorp.uk/2.0/vehicles",
  terminals: "https://api.uexcorp.uk/2.0/terminals",
  starSystems: "https://api.uexcorp.uk/2.0/star_systems",
};

/**
 * CitizenHQ public API — per-POI system-frame XYZ (meters) for QT distances.
 * Origin = system star; compare positions only within the same system.
 */
export const citizenHqApi = {
  base: "https://citizenhq.space/api/v1",
  positions: (system) =>
    `https://citizenhq.space/api/v1/positions?system=${encodeURIComponent(system)}`,
  locationsSystems: "https://citizenhq.space/api/v1/locations/systems",
};
