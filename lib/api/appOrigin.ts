/**
 * Re-export for the Next.js app. Implementation lives in `appOrigin.mjs`
 * so Node scripts can import the same helpers without a TS build step.
 */
export {
  resolveAppOrigin,
  resolveAppOrigin as appOrigin,
  resolveProdBaseUrl,
} from "./appOrigin.mjs";
