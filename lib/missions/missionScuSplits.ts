import {
  scuLocationSplitsFromScuSplits,
  type CatalogMissionScuSplit,
  type ScuLocationSplits,
  type ScuSplit,
} from "@/lib/missions/catalogMission";
import { getCommodityBySlug, getLocationBySlug } from "@/lib/fixtures";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

/** Legacy session / extras shape (display names or slugs mixed). */
export type LegacyDeliverySplit = {
  from: string;
  to: string;
  commodity: string;
  scu: number;
  isUserCorrected?: boolean;
  scuAutoSelected?: number;
};

function commoditySlugOf(nameOrSlug: string): string {
  return (
    resolveCommoditySlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase()
  );
}

function locationSlugOf(nameOrSlug: string): string {
  return resolveLocationSlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase();
}

function commodityNameOf(nameOrSlug: string): string {
  const slug = commoditySlugOf(nameOrSlug);
  return getCommodityBySlug(slug)?.name ?? nameOrSlug;
}

/** Convert legacy `deliverySplits` rows into canonical `scuSplits`. */
export function scuSplitsFromLegacyDeliverySplits(
  splits: LegacyDeliverySplit[],
  options?: { kind?: CatalogMissionScuSplit["kind"] },
): ScuSplit[] {
  const kind = options?.kind ?? "deliver";
  return splits.map((split) => {
    const commoditySlug = commoditySlugOf(split.commodity);
    const line: ScuSplit = {
      kind,
      fromLocationSlug: locationSlugOf(split.from),
      toLocationSlug: locationSlugOf(split.to),
      commoditySlug,
      commodityName: commodityNameOf(split.commodity),
      scu: Math.max(0, Math.floor(Number(split.scu) || 0)),
    };
    if (split.isUserCorrected) line.isUserCorrected = true;
    if (split.scuAutoSelected != null) {
      line.scuAutoSelected = Math.max(
        0,
        Math.floor(Number(split.scuAutoSelected) || 0),
      );
    }
    return line;
  });
}

/**
 * Expand `{ from, to }` location maps into deliver-kind split lines.
 * Uses a single commodity when only one cargo line exists; otherwise skips
 * ambiguous multi-cargo location maps (caller should prefer real `scuSplits`).
 */
export function scuSplitsFromLocationSplits(
  locSplits: ScuLocationSplits,
  cargo: Array<{ commoditySlug?: string; commodityName?: string; commodity?: string; scu?: number }>,
  fromFallbackSlug?: string,
): ScuSplit[] | null {
  const commodity =
    cargo.length === 1
      ? {
          commoditySlug: commoditySlugOf(
            cargo[0]!.commoditySlug ??
              cargo[0]!.commodityName ??
              cargo[0]!.commodity ??
              "cargo",
          ),
          commodityName:
            cargo[0]!.commodityName ??
            cargo[0]!.commodity ??
            commodityNameOf(
              cargo[0]!.commoditySlug ?? cargo[0]!.commodity ?? "cargo",
            ),
        }
      : null;
  if (!commodity) return null;

  const fromSlug =
    Object.keys(locSplits.from)[0] ?? fromFallbackSlug?.trim() ?? "";
  if (!fromSlug) return null;

  const lines: ScuSplit[] = [];
  for (const [toSlug, scu] of Object.entries(locSplits.to)) {
    const amount = Math.max(0, Math.floor(scu));
    if (amount <= 0) continue;
    lines.push({
      kind: "deliver",
      fromLocationSlug: locationSlugOf(fromSlug),
      toLocationSlug: locationSlugOf(toSlug),
      commoditySlug: commodity.commoditySlug,
      commodityName: commodity.commodityName,
      scu: amount,
    });
  }
  return lines.length > 0 ? lines : null;
}

/** Resolve catalog / extras / legacy into canonical `scuSplits`. */
export function resolveScuSplits(input: {
  scuSplits?: ScuSplit[] | null;
  scuLocationSplits?: ScuLocationSplits | null;
  legacyDeliverySplits?: LegacyDeliverySplit[] | null;
  cargo?: Array<{
    commoditySlug?: string;
    commodityName?: string;
    commodity?: string;
    scu?: number;
  }>;
  fromFallbackSlug?: string;
}): ScuSplit[] | undefined {
  if (input.scuSplits && input.scuSplits.length > 0) {
    return input.scuSplits.map((split) => ({ ...split }));
  }
  if (input.legacyDeliverySplits && input.legacyDeliverySplits.length > 0) {
    return scuSplitsFromLegacyDeliverySplits(input.legacyDeliverySplits);
  }
  if (input.scuLocationSplits) {
    const fromLoc = scuSplitsFromLocationSplits(
      input.scuLocationSplits,
      input.cargo ?? [],
      input.fromFallbackSlug,
    );
    if (fromLoc) return fromLoc;
  }
  return undefined;
}

/**
 * Normalize a session mission onto `scuSplits`.
 * Migrates legacy `deliverySplits` and strips that field.
 */
export function normalizeSessionMissionScuSplits(
  mission: SessionMission,
): SessionMission {
  const raw = mission as SessionMission & {
    deliverySplits?: LegacyDeliverySplit[];
  };
  const scuSplits = resolveScuSplits({
    scuSplits: raw.scuSplits,
    legacyDeliverySplits: raw.deliverySplits,
  });
  if (raw.deliverySplits == null && scuSplits === raw.scuSplits) {
    return mission;
  }
  const { deliverySplits: _legacy, ...rest } = raw;
  return {
    ...rest,
    ...(scuSplits ? { scuSplits } : {}),
  };
}

/** Display label for a location slug / name. */
export function scuSplitLocationLabel(slugOrName: string): string {
  const slug = locationSlugOf(slugOrName);
  return getLocationBySlug(slug)?.name ?? slugOrName;
}

export const missionScuSplits = {
  fromLegacyDeliverySplits: scuSplitsFromLegacyDeliverySplits,
  fromLocationSplits: scuSplitsFromLocationSplits,
  resolve: resolveScuSplits,
  normalizeMission: normalizeSessionMissionScuSplits,
  locationLabel: scuSplitLocationLabel,
  locationSplitsFrom: scuLocationSplitsFromScuSplits,
};
