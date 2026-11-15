import type { CatalogMission } from "@/db/schema";
import {
  getContractorBySlug,
  getLocationBySlug,
  getLocationShortName,
} from "@/lib/fixtures";
import {
  auecFromRewards,
  formatAuecAmount,
  formatAuecAmountCompact,
  type CatalogMissionReward,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";

export type CatalogLocationBadgeItem = {
  slug: string;
  /** Full location name (hover / title). */
  name: string;
  /** Badge label — fixture shortName, or full name when no short label exists. */
  label: string;
};

export function catalogPayload(
  mission: CatalogMission,
): HaulingCatalogMissionPayload | null {
  const payload = mission.payload as HaulingCatalogMissionPayload | null;
  if (!payload || payload.kind !== "hauling") return null;
  return payload;
}

export function locationDisplayName(slugOrName: string | null | undefined): string {
  if (!slugOrName?.trim()) return "—";
  return getLocationBySlug(slugOrName)?.name ?? slugOrName;
}

export function contractorDisplayName(
  slugOrName: string | null | undefined,
): string {
  if (!slugOrName?.trim()) return "—";
  return getContractorBySlug(slugOrName)?.name ?? slugOrName;
}

type CatalogRewardLabelOptions = {
  includeAuecUnit?: boolean;
  /** Abbreviate aUEC (42k / 1.3M) for dense table cells. */
  compact?: boolean;
};

function formatRewardLine(
  reward: CatalogMissionReward,
  options?: CatalogRewardLabelOptions,
): string {
  if (reward.kind === "auec") {
    if (reward.amount <= 0) return "";
    const format = options?.compact
      ? formatAuecAmountCompact
      : formatAuecAmount;
    return format(reward.amount, {
      includeUnit: options?.includeAuecUnit,
    });
  }
  return reward.name;
}

/** Compact table/detail label for catalog rewards (aUEC + other kinds). */
export function catalogRewardLabel(
  mission: CatalogMission,
  options?: CatalogRewardLabelOptions,
): string {
  const rewards =
    mission.rewards?.length
      ? mission.rewards
      : catalogPayload(mission)?.rewards ?? [];
  const parts = rewards
    .map((reward) => formatRewardLine(reward, options))
    .filter(Boolean);
  if (parts.length === 0) {
    const auec = auecFromRewards(rewards);
    return auec > 0
      ? formatRewardLine({ kind: "auec", amount: auec }, options)
      : "—";
  }
  return parts.join(" · ");
}

export function catalogRouteSummary(mission: CatalogMission): {
  from: string[];
  to: string[];
} {
  const payload = catalogPayload(mission);
  return {
    from: (payload?.fromLocationSlugs ?? []).map(locationDisplayName),
    to: (payload?.toLocationSlugs ?? []).map(locationDisplayName),
  };
}

/** Fixture shortName for catalog table From/To badges (full name if none); hover uses full name. */
export function catalogLocationBadgeLabel(
  slug: string,
): CatalogLocationBadgeItem {
  const name = locationDisplayName(slug);
  return {
    slug,
    name,
    label: getLocationShortName(slug),
  };
}

/** From / To badge rows for the catalog table. */
export function catalogRouteBadgeItems(mission: CatalogMission): {
  from: CatalogLocationBadgeItem[];
  to: CatalogLocationBadgeItem[];
} {
  const payload = catalogPayload(mission);
  return {
    from: (payload?.fromLocationSlugs ?? []).map((slug) =>
      catalogLocationBadgeLabel(slug),
    ),
    to: (payload?.toLocationSlugs ?? []).map((slug) =>
      catalogLocationBadgeLabel(slug),
    ),
  };
}

/** Per-line cargo labels for table lists (commodity names). */
export function catalogCargoLines(mission: CatalogMission): string[] {
  const payload = catalogPayload(mission);
  const cargo = payload?.cargo ?? [];
  if (cargo.length === 0) {
    return mission.scuTotal > 0 ? [`${mission.scuTotal} SCU`] : [];
  }
  return cargo.map((line) => line.commodityName);
}

/** Cargo lines for colored table badges (slug + name + SCU). */
export function catalogCargoBadgeItems(mission: CatalogMission): Array<{
  commoditySlug: string;
  commodityName: string;
  scu: number;
}> {
  const payload = catalogPayload(mission);
  const cargo = payload?.cargo ?? [];
  if (cargo.length > 0) {
    return cargo.map((line) => ({
      commoditySlug: line.commoditySlug,
      commodityName: line.commodityName,
      scu: line.scu,
    }));
  }
  if (mission.scuTotal > 0) {
    return [
      {
        commoditySlug: "",
        commodityName: `${mission.scuTotal} SCU`,
        scu: mission.scuTotal,
      },
    ];
  }
  return [];
}

/**
 * Cargo identity for selection chips: `24 SCU - Medical Supplies`.
 * Total SCU first, then commodity names (unique-ish vs title alone).
 */
export function catalogCargoIdentitySummary(mission: CatalogMission): string {
  const names = catalogCargoLines(mission).filter(
    (line) => !/^\d+\s*SCU$/i.test(line),
  );
  const scu = mission.scuTotal > 0 ? `${mission.scuTotal} SCU` : null;
  if (scu && names.length > 0) return `${scu} - ${names.join(", ")}`;
  if (scu) return scu;
  if (names.length > 0) return names.join(", ");
  return "—";
}

export function catalogCargoSummary(mission: CatalogMission): string {
  const lines = catalogCargoLines(mission);
  return lines.length > 0 ? lines.join(" · ") : "—";
}

/** Compact per-stop SCU lines for screenshot lightbox verification. */
export function catalogScuSplitsCaption(mission: CatalogMission): string {
  const payload = catalogPayload(mission);
  const splits = payload?.scuSplits;
  if (splits && splits.length > 0) {
    return splits
      .map((split) => {
        const from = locationDisplayName(split.fromLocationSlug);
        const to = locationDisplayName(split.toLocationSlug);
        const cargo = `${split.scu} SCU ${split.commodityName}`;
        if (split.kind === "collect") return `${cargo} · ${from}`;
        if (from === to) return `${cargo} · ${to}`;
        return `${cargo} · ${from} → ${to}`;
      })
      .join("\n");
  }
  const cargo = payload?.cargo ?? [];
  if (cargo.length > 0) {
    return cargo
      .map((line) => `${line.scu} SCU ${line.commodityName}`)
      .join(" · ");
  }
  return mission.scuTotal > 0 ? `${mission.scuTotal} SCU` : "";
}

/** Mission title + SCU splits for source screenshot captions. */
export function catalogSourceScreenshotCaption(mission: CatalogMission): string {
  const splits = catalogScuSplitsCaption(mission);
  return splits ? `${mission.title}\n${splits}` : mission.title;
}
