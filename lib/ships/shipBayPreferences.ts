import shipBayPreferencesFixture from "@/lib/fixtures/shipBayPreferences.json";
import type { CargoPlacementRuleId } from "@/lib/ships/cargoGridPlacementRules";
import type { CargoGridStorageLocation } from "@/lib/ships/cargoGrids";

/**
 * How mission-priority packing places early vs late deliveries in the bay.
 * Used for Cargo type + Prioritized, and automatically for Mission based.
 */
export type MissionPriorityPackBias = "edges-first" | "center-first";

export type MissionPriorityPackingConfig = {
  /** Prefer early-delivery cargo toward edges or toward the bay center. */
  bias: MissionPriorityPackBias;
};

/** Structured per-ship bay organization preferences (DB + committed file). */
export type ShipBayPreferencePayload = {
  /** Freeform packing guidance (how this bay is typically organized). */
  notes: string;
  /** Preferred zone scan / assignment order. */
  preferredZoneOrder?: CargoGridStorageLocation[];
  /** Placement rule ids to emphasize for this hull. */
  preferredRuleIds?: CargoPlacementRuleId[];
  /** Commodity slug → preferred bay zone. */
  commodityZoneHints?: Partial<
    Record<string, CargoGridStorageLocation>
  >;
  /**
   * Ship-specific early-vs-late delivery layout bias.
   * Cargo type + Prioritized, and Mission based (always when set).
   * Mk V: early deliveries on bay edges; later deliveries toward center.
   */
  missionPriorityPacking?: MissionPriorityPackingConfig | null;
  /** Short durable guidelines (bullets). */
  guidelines?: string[];
};

export type ShipBayPreferenceRecord = {
  shipSlug: string;
  payload: ShipBayPreferencePayload;
  /** Where this resolved value came from. */
  source: "database" | "file";
  updatedAt?: string | null;
};

export function emptyShipBayPreferencePayload(): ShipBayPreferencePayload {
  return {
    notes: "",
    preferredZoneOrder: ["rear", "middle", "front"],
    preferredRuleIds: [
      "prefer-flat-layers",
      "prefer-flat-stable-support",
      "prefer-back-when-full-height",
    ],
    commodityZoneHints: {},
    missionPriorityPacking: null,
    guidelines: [],
  };
}

function normalizeMissionPriorityPacking(
  input: Partial<MissionPriorityPackingConfig> | null | undefined,
): MissionPriorityPackingConfig | null {
  if (!input || typeof input !== "object") return null;
  if (input.bias !== "edges-first" && input.bias !== "center-first") {
    return null;
  }
  return { bias: input.bias };
}

export function normalizeShipBayPreferencePayload(
  input: Partial<ShipBayPreferencePayload> | null | undefined,
): ShipBayPreferencePayload {
  const base = emptyShipBayPreferencePayload();
  if (!input) return base;
  return {
    notes: typeof input.notes === "string" ? input.notes : base.notes,
    preferredZoneOrder: Array.isArray(input.preferredZoneOrder)
      ? input.preferredZoneOrder.filter(isZone)
      : base.preferredZoneOrder,
    preferredRuleIds: Array.isArray(input.preferredRuleIds)
      ? input.preferredRuleIds
          .map((id) => (typeof id === "string" ? normalizeRuleId(id) : null))
          .filter((id): id is CargoPlacementRuleId => id != null)
      : base.preferredRuleIds,
    commodityZoneHints:
      input.commodityZoneHints && typeof input.commodityZoneHints === "object"
        ? Object.fromEntries(
            Object.entries(input.commodityZoneHints).filter(
              (entry): entry is [string, CargoGridStorageLocation] =>
                Boolean(entry[0]) && isZone(entry[1]),
            ),
          )
        : base.commodityZoneHints,
    missionPriorityPacking: normalizeMissionPriorityPacking(
      input.missionPriorityPacking,
    ),
    guidelines: Array.isArray(input.guidelines)
      ? input.guidelines
          .filter((line): line is string => typeof line === "string")
          .map((line) => line.trim())
          .filter(Boolean)
      : base.guidelines,
  };
}

export function mergeShipBayPreferencePayload(
  current: ShipBayPreferencePayload,
  patch: Partial<ShipBayPreferencePayload> & {
    /** When set, append these guidelines instead of replacing. */
    appendGuidelines?: string[];
    /** Replace notes entirely when provided (including empty string). */
    replaceNotes?: boolean;
  },
): ShipBayPreferencePayload {
  const next = normalizeShipBayPreferencePayload(current);
  if (typeof patch.notes === "string") {
    next.notes =
      patch.replaceNotes === false && next.notes.trim()
        ? `${next.notes.trim()}\n\n${patch.notes.trim()}`.trim()
        : patch.notes;
  }
  if (patch.preferredZoneOrder) {
    next.preferredZoneOrder = patch.preferredZoneOrder.filter(isZone);
  }
  if (patch.preferredRuleIds) {
    next.preferredRuleIds = patch.preferredRuleIds
      .map((id) => normalizeRuleId(id))
      .filter((id): id is CargoPlacementRuleId => id != null);
  }
  if (patch.commodityZoneHints) {
    next.commodityZoneHints = {
      ...next.commodityZoneHints,
      ...Object.fromEntries(
        Object.entries(patch.commodityZoneHints).filter(
          (entry): entry is [string, CargoGridStorageLocation] =>
            Boolean(entry[0]) && isZone(entry[1]),
        ),
      ),
    };
  }
  if (patch.missionPriorityPacking !== undefined) {
    next.missionPriorityPacking = normalizeMissionPriorityPacking(
      patch.missionPriorityPacking,
    );
  }
  if (patch.guidelines) {
    next.guidelines = patch.guidelines
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (patch.appendGuidelines?.length) {
    const extras = patch.appendGuidelines
      .map((line) => line.trim())
      .filter(Boolean);
    next.guidelines = [...(next.guidelines ?? []), ...extras];
  }
  return next;
}

function isZone(value: unknown): value is CargoGridStorageLocation {
  return value === "front" || value === "middle" || value === "rear";
}

function normalizeRuleId(value: string): CargoPlacementRuleId | null {
  if (value === "prefer-smaller-on-larger") return "prefer-flat-stable-support";
  if (
    value === "prefer-flat-layers" ||
    value === "prefer-flat-stable-support" ||
    value === "prefer-back-when-full-height"
  ) {
    return value;
  }
  return null;
}

type FixtureFile = {
  items: Array<{
    shipSlug: string;
    payload: Partial<ShipBayPreferencePayload>;
  }>;
};

const fixtureFile = shipBayPreferencesFixture as FixtureFile;

const fixturePayloadBySlug = new Map(
  fixtureFile.items.map(
    (row) =>
      [
        row.shipSlug.trim().toLowerCase(),
        normalizeShipBayPreferencePayload(row.payload),
      ] as const,
  ),
);

/** Committed file prefs only (safe for client / packer; DB may override on server). */
export function getShipBayPreferenceFixture(
  shipSlug: string | null | undefined,
): ShipBayPreferencePayload {
  if (!shipSlug) return emptyShipBayPreferencePayload();
  return (
    fixturePayloadBySlug.get(shipSlug.trim().toLowerCase()) ??
    emptyShipBayPreferencePayload()
  );
}
