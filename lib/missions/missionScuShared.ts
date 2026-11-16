import { getLocationBySlug } from "@/lib/fixtures";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

export function commoditySlugOf(nameOrSlug: string): string {
  return (
    resolveCommoditySlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase()
  );
}

export function locationSlugOf(nameOrSlug: string): string {
  return resolveLocationSlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase();
}

export function locationLabelOf(nameOrSlug: string): string {
  const slug = locationSlugOf(nameOrSlug);
  return getLocationBySlug(slug)?.name ?? nameOrSlug;
}

export function locationMatches(a: string, b: string): boolean {
  const aSlug = locationSlugOf(a);
  const bSlug = locationSlugOf(b);
  if (aSlug && bSlug && aSlug === bSlug) return true;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function cargoSummaryFor(mission: SessionMission): string {
  return mission.cargo
    .filter((line) => (Number(line.scu) || 0) > 0)
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
}

/** Scale positive parts so they sum to `newTotal` (integer SCU). */
export function scalePositiveParts(parts: number[], newTotal: number): number[] {
  const safeTotal = Math.max(0, Math.floor(newTotal));
  const positive = parts.map((part) => Math.max(0, Math.floor(part)));
  const sum = positive.reduce((acc, part) => acc + part, 0);
  if (positive.length === 0) return parts;
  if (sum <= 0) {
    const out = positive.map(() => 0);
    out[0] = safeTotal;
    return out;
  }
  if (positive.length === 1) return [safeTotal];

  const scaled = positive.map((part) =>
    Math.floor((part / sum) * safeTotal),
  );
  let remainder = safeTotal - scaled.reduce((acc, part) => acc + part, 0);
  let index = 0;
  while (remainder > 0 && scaled.length > 0) {
    scaled[index % scaled.length]! += 1;
    remainder -= 1;
    index += 1;
  }
  return scaled;
}
