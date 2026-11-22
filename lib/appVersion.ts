/**
 * Client/server build label — values are baked via `next.config.ts` `env`.
 */

export type AppVersionInfo = {
  /** Short git SHA (7 chars) when known. */
  gitSha: string | null;
  /** `package.json` version. */
  packageVersion: string | null;
  /** Compact label for title/tooltip. */
  label: string;
};

export function getAppVersionInfo(): AppVersionInfo {
  const gitSha = process.env.NEXT_PUBLIC_APP_GIT_SHA?.trim() || null;
  const packageVersion =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() || null;
  const parts = [
    packageVersion ? `v${packageVersion}` : null,
    gitSha,
  ].filter(Boolean);
  return {
    gitSha,
    packageVersion,
    label: parts.length > 0 ? parts.join(" · ") : "unknown",
  };
}
