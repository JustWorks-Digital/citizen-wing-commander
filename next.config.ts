import type { NextConfig } from "next";
import {
  resolveAppGitSha,
  resolveAppPackageVersion,
} from "./lib/appVersion.mjs";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  /**
   * Dev-only: allow phone / other-machine access via LAN IP.
   * Without this, Next blocks `_next` / HMR from `http://192.168.x.x:3000`
   * and the app sits on “Opening trip…” while localhost works.
   * Hostname only (no scheme/port). Wildcards cover DHCP churn.
   */
  allowedDevOrigins: [
    "127.0.0.1",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "192.168.*.*",
  ],
  env: {
    // Baked at `next build` / `next dev` start — compare local vs Railway.
    NEXT_PUBLIC_APP_GIT_SHA: resolveAppGitSha() ?? "unknown",
    NEXT_PUBLIC_APP_VERSION: resolveAppPackageVersion() ?? "0.0.0",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
