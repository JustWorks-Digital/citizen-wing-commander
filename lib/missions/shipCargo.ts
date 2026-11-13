/**
 * Shared ship-cargo manifest: what is aboard (commodity + optional mission).
 * Derive from a trip walk; do not clamp away shortfalls — callers validate.
 */

export type ShipCargoLine = {
  commoditySlug: string;
  scu: number;
  /** Session / catalog mission id when known. */
  missionId: string | null;
};

export type ShipCargo = {
  lines: ShipCargoLine[];
  scuTotal: number;
};

export type ShipCargoShortfall = {
  missing: ShipCargoLine;
  shortfallScu: number;
};

function lineKey(line: Pick<ShipCargoLine, "commoditySlug" | "missionId">): string {
  return `${line.commoditySlug}::${line.missionId ?? ""}`;
}

function refreshTotal(lines: ShipCargoLine[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, line.scu), 0);
}

function cloneShip(ship: ShipCargo): ShipCargo {
  return {
    lines: ship.lines.map((line) => ({ ...line })),
    scuTotal: ship.scuTotal,
  };
}

/**
 * Ship cargo helpers (manifest add / remove / totals).
 *
 * Prefer `shipCargo.empty()` / `shipCargo.add` over ad-hoc maps.
 */
export const shipCargo = {
  empty(): ShipCargo {
    return { lines: [], scuTotal: 0 };
  },

  /** Copy with refreshed total. */
  fromLines(lines: ShipCargoLine[]): ShipCargo {
    const normalized = lines
      .filter((line) => line.scu > 0 && line.commoditySlug.trim())
      .map((line) => ({
        commoditySlug: line.commoditySlug.trim(),
        scu: Math.max(0, Math.floor(line.scu)),
        missionId: line.missionId ?? null,
      }));
    return { lines: normalized, scuTotal: refreshTotal(normalized) };
  },

  amountAboard(
    ship: ShipCargo,
    commoditySlug: string,
    missionId?: string | null,
  ): number {
    const slug = commoditySlug.trim();
    return ship.lines
      .filter((line) => {
        if (line.commoditySlug !== slug) return false;
        if (missionId === undefined) return true;
        return line.missionId === (missionId ?? null);
      })
      .reduce((sum, line) => sum + line.scu, 0);
  },

  /** Load cargo onto the ship (merge matching commodity + missionId). */
  add(ship: ShipCargo, lines: readonly ShipCargoLine[]): ShipCargo {
    const next = cloneShip(ship);
    for (const incoming of lines) {
      const scu = Math.max(0, Math.floor(incoming.scu));
      if (scu <= 0 || !incoming.commoditySlug.trim()) continue;
      const normalized: ShipCargoLine = {
        commoditySlug: incoming.commoditySlug.trim(),
        scu,
        missionId: incoming.missionId ?? null,
      };
      const key = lineKey(normalized);
      const existing = next.lines.find((line) => lineKey(line) === key);
      if (existing) existing.scu += normalized.scu;
      else next.lines.push(normalized);
    }
    next.scuTotal = refreshTotal(next.lines);
    return next;
  },

  /**
   * Unload cargo. Reports shortfalls instead of silently clamping the plan
   * to look valid — ship line amounts still never go below 0.
   */
  remove(
    ship: ShipCargo,
    lines: readonly ShipCargoLine[],
  ): { ship: ShipCargo; shortfalls: ShipCargoShortfall[] } {
    const next = cloneShip(ship);
    const shortfalls: ShipCargoShortfall[] = [];

    for (const need of lines) {
      const scu = Math.max(0, Math.floor(need.scu));
      if (scu <= 0 || !need.commoditySlug.trim()) continue;
      const missing: ShipCargoLine = {
        commoditySlug: need.commoditySlug.trim(),
        scu,
        missionId: need.missionId ?? null,
      };

      let remaining = scu;
      // Prefer exact mission match, then any same commodity.
      const preferred = next.lines.filter(
        (line) =>
          line.commoditySlug === missing.commoditySlug &&
          line.missionId === missing.missionId,
      );
      const fallback =
        preferred.length > 0
          ? preferred
          : next.lines.filter(
              (line) => line.commoditySlug === missing.commoditySlug,
            );

      for (const line of fallback) {
        if (remaining <= 0) break;
        const take = Math.min(line.scu, remaining);
        line.scu -= take;
        remaining -= take;
      }

      next.lines = next.lines.filter((line) => line.scu > 0);

      if (remaining > 0) {
        shortfalls.push({
          missing,
          shortfallScu: remaining,
        });
      }
    }

    next.scuTotal = refreshTotal(next.lines);
    return { ship: next, shortfalls };
  },
};
