/**
 * Public site / prod host helpers — values come from env only.
 * Never hardcode the Railway production URL in source.
 *
 * - APP_ORIGIN — this deployment’s public origin (MCP trip links).
 * - PROD_BASE_URL — production host for local sync/copy scripts.
 */

/** @returns {string} Origin without trailing slash. */
export function resolveAppOrigin() {
  const fromEnv =
    process.env.APP_ORIGIN?.trim() ||
    process.env.PUBLIC_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Railway injects these on deploy — use them so MCP trip links are absolute
  // public URLs even when APP_ORIGIN was not set manually.
  const railwayServiceUrl =
    process.env.RAILWAY_SERVICE_CITIZEN_WING_COMMANDER_URL?.trim() ||
    process.env.RAILWAY_STATIC_URL?.trim();
  if (railwayServiceUrl) {
    try {
      const u = new URL(
        railwayServiceUrl.includes("://")
          ? railwayServiceUrl
          : `https://${railwayServiceUrl}`,
      );
      return u.origin;
    } catch {
      // fall through
    }
  }
  const railwayPublic = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayPublic) {
    return `https://${railwayPublic.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  // Local/dev fallback only — not production.
  return "http://localhost:3000";
}

/**
 * Production base URL for scripts that pull from live.
 * @returns {string}
 */
export function resolveProdBaseUrl() {
  const fromEnv = process.env.PROD_BASE_URL?.trim();
  if (!fromEnv) {
    throw new Error(
      "PROD_BASE_URL is required (set it in .env.local — see .env.example).",
    );
  }
  return fromEnv.replace(/\/$/, "");
}
