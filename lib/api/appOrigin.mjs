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
