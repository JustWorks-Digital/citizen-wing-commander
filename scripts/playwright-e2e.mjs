#!/usr/bin/env node
/**
 * Playwright runner that accepts fail-on-console flags before forwarding
 * the rest of the argv to `playwright test`.
 *
 *   npm run test:e2e -- --headed
 *   npm run test:e2e -- --no-fail-on-console
 *   npm run test:e2e -- --fail-on-console=0 e2e/sessions/
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

function parseBool(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw).trim().toLowerCase();
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return null;
}

const forwarded = [];
let failOnConsole = null;

for (const arg of process.argv.slice(2)) {
  if (arg === "--fail-on-console") {
    failOnConsole = true;
    continue;
  }
  if (arg === "--no-fail-on-console") {
    failOnConsole = false;
    continue;
  }
  if (arg.startsWith("--fail-on-console=")) {
    failOnConsole = parseBool(arg.slice("--fail-on-console=".length)) ?? true;
    continue;
  }
  forwarded.push(arg);
}

const env = { ...process.env };
if (failOnConsole != null) {
  env.PLAYWRIGHT_FAIL_ON_CONSOLE = failOnConsole ? "1" : "0";
}

const child = spawn(
  "npx",
  ["playwright", "test", ...forwarded],
  {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
