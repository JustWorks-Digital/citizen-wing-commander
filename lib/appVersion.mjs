/**
 * Resolve the deploy/build identity for UI + env baking.
 * Prefer Railway/CI commit vars; fall back to local `git rev-parse`.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function shortSha(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
}

export function resolveAppGitSha() {
  const fromEnv = shortSha(
    process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT_SHA ||
      process.env.COMMIT_SHA ||
      process.env.SOURCE_VERSION ||
      process.env.NEXT_PUBLIC_APP_GIT_SHA,
  );
  if (fromEnv) return fromEnv;
  try {
    return shortSha(
      execSync("git rev-parse --short HEAD", {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

export function resolveAppPackageVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}
