import {
  emptyScuBoxSplits,
  normalizeScuBoxSplits,
  scuBoxSplitsForScu,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import {
  expandBreakdownToBoxSizes,
  takeBoxesForScu,
} from "@/lib/missions/boxBreakdownOptions";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { resolveCommoditySlug } from "@/lib/sessions/resolveRefs";
import {
  clampToCargoBoxScu,
  decomposeScuIntoBoxes,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";

/** Options when applying one commodity’s mix style to the rest. */
export type PropagatePreferredMaxOptions = {
  /**
   * Skip cargo lines the user already corrected (default true).
   * Source commodity is always left as-is.
   */
  onlyUncorrected?: boolean;
};

/** Selected / auto crate mixes keyed by commodity slug. */
export type ScuCargoBoxSplits = Record<string, ScuBoxSplits>;

function commoditySlugForLine(commodity: string): string {
  return (
    resolveCommoditySlug(commodity) ?? commodity.trim().toLowerCase()
  );
}

function missionCargoLines(
  mission: SessionMission,
): Array<{ commoditySlug: string; scu: number; commodity: string }> {
  return mission.cargo
    .map((line) => ({
      commodity: line.commodity,
      commoditySlug: commoditySlugForLine(line.commodity),
      scu: Math.max(0, Math.floor(Number(line.scu) || 0)),
    }))
    .filter((line) => line.commoditySlug && line.scu > 0);
}

function sumScuBoxSplits(a: ScuBoxSplits, b: ScuBoxSplits): ScuBoxSplits {
  return {
    scuOne: a.scuOne + b.scuOne,
    scuTwo: a.scuTwo + b.scuTwo,
    scuFour: a.scuFour + b.scuFour,
    scuEight: a.scuEight + b.scuEight,
    scuSixteen: a.scuSixteen + b.scuSixteen,
    scuThirtyTwo: a.scuThirtyTwo + b.scuThirtyTwo,
  };
}

function mapsEqualEnough(
  a: ScuBoxSplits | null | undefined,
  b: ScuBoxSplits | null | undefined,
): boolean {
  if (!a || !b) return a == null && b == null;
  const left = normalizeScuBoxSplits(a);
  const right = normalizeScuBoxSplits(b);
  return (
    left.scuOne === right.scuOne &&
    left.scuTwo === right.scuTwo &&
    left.scuFour === right.scuFour &&
    left.scuEight === right.scuEight &&
    left.scuSixteen === right.scuSixteen &&
    left.scuThirtyTwo === right.scuThirtyTwo
  );
}

/**
 * Per-commodity crate-mix helpers (selected + auto-selected maps).
 * Mission-level `scuBoxSplits` stays as the aggregate of those maps.
 */
export const cargoBoxSplits = {
  autoSelectedForMission(mission: SessionMission): ScuCargoBoxSplits {
    const max = mission.maxContainerScu;
    const out: ScuCargoBoxSplits = {};
    for (const line of missionCargoLines(mission)) {
      out[line.commoditySlug] = scuBoxSplitsForScu(line.scu, max ?? null);
    }
    return out;
  },

  aggregate(map: ScuCargoBoxSplits | null | undefined): ScuBoxSplits {
    let total = emptyScuBoxSplits();
    if (!map) return total;
    for (const splits of Object.values(map)) {
      total = sumScuBoxSplits(total, normalizeScuBoxSplits(splits));
    }
    return total;
  },

  forCommodity(
    mission: SessionMission,
    commoditySlug: string,
  ): ScuBoxSplits | null {
    const selected = mission.scuCargoBoxSplits?.[commoditySlug];
    if (selected) return normalizeScuBoxSplits(selected);
    const auto =
      mission.scuCargoBoxSplitsAutoSelected?.[commoditySlug] ??
      cargoBoxSplits.autoSelectedForMission(mission)[commoditySlug];
    return auto ? normalizeScuBoxSplits(auto) : null;
  },

  boxSizesForLine(
    mission: SessionMission,
    commoditySlug: string,
    scu: number,
  ): CargoBoxScu[] {
    const need = Math.max(0, Math.floor(scu));
    const max =
      typeof mission.maxContainerScu === "number" && mission.maxContainerScu > 0
        ? (mission.maxContainerScu as CargoBoxScu)
        : undefined;
    if (need === 0) return [];

    const splits = cargoBoxSplits.forCommodity(mission, commoditySlug);
    if (splits) {
      const boxes = expandBreakdownToBoxSizes(splits);
      const total = boxes.reduce((sum, size) => sum + size, 0);
      // Full mission mix only when the line is the whole commodity amount.
      if (total === need && boxes.length > 0) return boxes;
      // Multi-stop split: take a subset when crates fit (e.g. 4 from 8+8+4).
      if (total > need && boxes.length > 0) {
        const pool = [...boxes];
        const taken = takeBoxesForScu(pool, need);
        if (taken) return taken;
        // e.g. 8 SCU crates cannot fill a 7 SCU outpost pickup — rebuild for the line.
        return decomposeScuIntoBoxes(need, max);
      }
    }
    return decomposeScuIntoBoxes(need, max);
  },

  withDefaults(mission: SessionMission): SessionMission {
    const lines = missionCargoLines(mission);
    if (lines.length === 0) return mission;

    const autoFromCargo = cargoBoxSplits.autoSelectedForMission(mission);
    const existingAuto = mission.scuCargoBoxSplitsAutoSelected ?? {};
    const auto: ScuCargoBoxSplits = { ...autoFromCargo };
    for (const line of lines) {
      if (existingAuto[line.commoditySlug]) {
        auto[line.commoditySlug] = normalizeScuBoxSplits(
          existingAuto[line.commoditySlug],
        );
      }
    }

    let selected: ScuCargoBoxSplits = {
      ...(mission.scuCargoBoxSplits ?? {}),
    };
    for (const [slug, splits] of Object.entries(selected)) {
      selected[slug] = normalizeScuBoxSplits(splits);
    }

    const hasAnySelected = lines.some(
      (line) => selected[line.commoditySlug] != null,
    );
    const hasAnyAutoMap = lines.some(
      (line) => mission.scuCargoBoxSplitsAutoSelected?.[line.commoditySlug],
    );

    // Legacy: only mission-level mix, single cargo → copy into that slug.
    if (
      !hasAnySelected &&
      !hasAnyAutoMap &&
      mission.scuBoxSplits &&
      lines.length === 1
    ) {
      const slug = lines[0]!.commoditySlug;
      selected[slug] = normalizeScuBoxSplits(mission.scuBoxSplits);
      if (mission.scuBoxSplitsAutoSelected) {
        auto[slug] = normalizeScuBoxSplits(mission.scuBoxSplitsAutoSelected);
      }
    }

    // Fill missing selected from auto (multi-cargo legacy mission-level is ignored).
    for (const line of lines) {
      if (!selected[line.commoditySlug]) {
        selected[line.commoditySlug] = auto[line.commoditySlug]!;
      }
      if (!auto[line.commoditySlug]) {
        auto[line.commoditySlug] = scuBoxSplitsForScu(
          line.scu,
          mission.maxContainerScu ?? null,
        );
      }
    }

    // Drop stale slugs no longer on the mission.
    const keep = new Set(lines.map((line) => line.commoditySlug));
    selected = Object.fromEntries(
      Object.entries(selected).filter(([slug]) => keep.has(slug)),
    );
    const autoKept: ScuCargoBoxSplits = Object.fromEntries(
      Object.entries(auto).filter(([slug]) => keep.has(slug)),
    );

    const aggregateSelected = cargoBoxSplits.aggregate(selected);
    const aggregateAuto = cargoBoxSplits.aggregate(autoKept);

    return {
      ...mission,
      scuCargoBoxSplitsAutoSelected: autoKept,
      scuCargoBoxSplits: selected,
      scuBoxSplitsAutoSelected: aggregateAuto,
      scuBoxSplits: aggregateSelected,
    };
  },

  setCommodity(
    mission: SessionMission,
    commoditySlug: string,
    splits: ScuBoxSplits,
  ): SessionMission {
    const withAuto = cargoBoxSplits.withDefaults(mission);
    const lines = missionCargoLines(withAuto);
    const slug =
      resolveCommoditySlug(commoditySlug) ?? commoditySlug.trim().toLowerCase();
    const line = lines.find((entry) => entry.commoditySlug === slug);
    if (!line) {
      return withAuto;
    }
    const nextSelected: ScuCargoBoxSplits = {
      ...(withAuto.scuCargoBoxSplits ?? {}),
      [slug]: normalizeScuBoxSplits(splits),
    };
    return {
      ...withAuto,
      scuCargoBoxSplits: nextSelected,
      scuBoxSplits: cargoBoxSplits.aggregate(nextSelected),
    };
  },

  /** True when selected differs from auto for any cargo line. */
  isUserCorrected(mission: SessionMission, commoditySlug?: string): boolean {
    const withAuto = cargoBoxSplits.withDefaults(mission);
    if (commoditySlug) {
      const slug =
        resolveCommoditySlug(commoditySlug) ??
        commoditySlug.trim().toLowerCase();
      return !mapsEqualEnough(
        withAuto.scuCargoBoxSplits?.[slug],
        withAuto.scuCargoBoxSplitsAutoSelected?.[slug],
      );
    }
    for (const line of missionCargoLines(withAuto)) {
      if (
        !mapsEqualEnough(
          withAuto.scuCargoBoxSplits?.[line.commoditySlug],
          withAuto.scuCargoBoxSplitsAutoSelected?.[line.commoditySlug],
        )
      ) {
        return true;
      }
    }
    return false;
  },

  /**
   * Largest crate size used in a mix (null when empty).
   * Used as the “style” cap for other commodities.
   */
  preferredMaxFromSplits(
    splits: ScuBoxSplits | null | undefined,
  ): CargoBoxScu | null {
    if (!splits) return null;
    const n = normalizeScuBoxSplits(splits);
    if (n.scuThirtyTwo > 0) return 32;
    if (n.scuSixteen > 0) return 16;
    if (n.scuEight > 0) return 8;
    if (n.scuFour > 0) return 4;
    if (n.scuTwo > 0) return 2;
    if (n.scuOne > 0) return 1;
    return null;
  },

  /**
   * Cap for greedy fills: preferred style size, never above the contract max.
   */
  effectivePreferredMax(
    mission: SessionMission,
    preferredMax: CargoBoxScu,
  ): CargoBoxScu {
    const missionMax = clampToCargoBoxScu(mission.maxContainerScu);
    if (missionMax == null) return preferredMax;
    return Math.min(missionMax, preferredMax) as CargoBoxScu;
  },

  /**
   * Re-greedy remaining cargo lines using the largest box from `sourceSlug`’s mix.
   * Leaves the source line unchanged; skips user-corrected lines by default.
   */
  propagatePreferredMax(
    mission: SessionMission,
    sourceSlug: string,
    options?: PropagatePreferredMaxOptions,
  ): SessionMission {
    const withAuto = cargoBoxSplits.withDefaults(mission);
    const slug =
      resolveCommoditySlug(sourceSlug) ?? sourceSlug.trim().toLowerCase();
    const preferred = cargoBoxSplits.preferredMaxFromSplits(
      withAuto.scuCargoBoxSplits?.[slug],
    );
    if (!preferred) return withAuto;

    const max = cargoBoxSplits.effectivePreferredMax(withAuto, preferred);
    const onlyUncorrected = options?.onlyUncorrected !== false;
    let next = withAuto;
    for (const line of missionCargoLines(next)) {
      if (line.commoditySlug === slug) continue;
      if (
        onlyUncorrected &&
        cargoBoxSplits.isUserCorrected(next, line.commoditySlug)
      ) {
        continue;
      }
      next = cargoBoxSplits.setCommodity(
        next,
        line.commoditySlug,
        scuBoxSplitsForScu(line.scu, max),
      );
    }
    return next;
  },

  /** How many other lines would still get a style fill (uncorrected, non-source). */
  remainingUncorrectedCount(
    mission: SessionMission,
    sourceSlug: string,
  ): number {
    const withAuto = cargoBoxSplits.withDefaults(mission);
    const slug =
      resolveCommoditySlug(sourceSlug) ?? sourceSlug.trim().toLowerCase();
    let count = 0;
    for (const line of missionCargoLines(withAuto)) {
      if (line.commoditySlug === slug) continue;
      if (!cargoBoxSplits.isUserCorrected(withAuto, line.commoditySlug)) {
        count += 1;
      }
    }
    return count;
  },

  commodityLines(mission: SessionMission) {
    return missionCargoLines(mission);
  },
};
