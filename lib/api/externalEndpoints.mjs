/**
 * Named third-party API endpoints (single source of truth for scripts + app).
 * Keep `.cursor/third-party-sources.yaml` in sync when adding/changing sources.
 */

/** Star Citizen Wiki JSON API (starmap, etc.). */
export const scWikiApi = {
  locations: "https://api.star-citizen.wiki/api/locations",
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
};
