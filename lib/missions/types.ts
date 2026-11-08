/** Shared location stub used inside mission JSON payloads. */
export type MissionLocation = {
  system?: string;
  planet?: string;
  locationName: string;
  padOrBay?: string;
};

export type HaulingCargoLeg = {
  commodity: string;
  scu: number;
  from: MissionLocation;
  to: MissionLocation;
  notes?: string;
};

export type ChecklistTemplateItem = {
  key: string;
  label: string;
  required?: boolean;
  /** Optional grouping, e.g. "pickup" | "transit" | "delivery" */
  group?: string;
};

/**
 * Hauling-specific mission body stored in `missions.payload` (JSONB).
 * Keep this the source of truth for large structured contract details.
 */
export type HaulingMissionPayload = {
  kind: "hauling";
  contractId?: string;
  contractName?: string;
  cargo: HaulingCargoLeg[];
  checklistTemplate: ChecklistTemplateItem[];
  /** Free-form extras (UEEC payout, ship requirements, raw contract dump, …) */
  extras?: Record<string, unknown>;
};

/** Discriminated union — extend when adding mission types. */
export type MissionPayload = HaulingMissionPayload | { kind: string; [key: string]: unknown };

export type ChecklistItemProgressMeta = {
  completedByHandle?: string;
  scuMoved?: number;
  evidence?: string;
  [key: string]: unknown;
};

export function isHaulingPayload(
  payload: MissionPayload,
): payload is HaulingMissionPayload {
  return payload?.kind === "hauling";
}

export function emptyHaulingPayload(
  partial?: Partial<HaulingMissionPayload>,
): HaulingMissionPayload {
  return {
    kind: "hauling",
    cargo: [],
    checklistTemplate: [
      { key: "accept_contract", label: "Accept contract", group: "prep", required: true },
      { key: "load_cargo", label: "Load cargo", group: "pickup", required: true },
      { key: "depart_origin", label: "Depart origin", group: "transit" },
      { key: "arrive_destination", label: "Arrive destination", group: "delivery", required: true },
      { key: "unload_cargo", label: "Unload cargo", group: "delivery", required: true },
      { key: "turn_in", label: "Turn in contract", group: "delivery", required: true },
    ],
    ...partial,
  };
}
