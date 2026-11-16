/**
 * Whether Playwright should fail on browser `console.error` / `pageerror`.
 *
 * Precedence:
 * 1. Env `PLAYWRIGHT_FAIL_ON_CONSOLE` (shell, `.env` / `.env.local`, or set by
 *    `npm run test:e2e -- --fail-on-console` / `--no-fail-on-console`)
 * 2. Default: on (`true`)
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

function parseBool(raw: string | undefined): boolean | null {
  if (raw == null || raw.trim() === "") return null;
  const value = raw.trim().toLowerCase();
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return null;
}

export function resolveFailOnConsole(
  envValue: string | undefined = process.env.PLAYWRIGHT_FAIL_ON_CONSOLE,
): boolean {
  return parseBool(envValue) ?? true;
}
