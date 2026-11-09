import type { CargoPlacementRuleId } from "@/lib/ships/cargoGridPlacementRules";
import type { CargoGridStorageLocation } from "@/lib/ships/cargoGrids";

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
      "prefer-smaller-on-larger",
      "prefer-back-when-full-height",
    ],
    commodityZoneHints: {},
    guidelines: [],
  };
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
      ? input.preferredRuleIds.filter(isRuleId)
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
    next.preferredRuleIds = patch.preferredRuleIds.filter(isRuleId);
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

function isRuleId(value: unknown): value is CargoPlacementRuleId {
  return (
    value === "prefer-flat-layers" ||
    value === "prefer-smaller-on-larger" ||
    value === "prefer-back-when-full-height"
  );
}
