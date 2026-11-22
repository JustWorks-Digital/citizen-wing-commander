import type { NextConfig } from "next";
import {
  resolveAppGitSha,
  resolveAppPackageVersion,
} from "./lib/appVersion.mjs";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
