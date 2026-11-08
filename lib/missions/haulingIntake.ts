/**
 * Accepted intermediate JSON for screenshot / contract intake.
 * LLMs and MCP clients should emit this; the app resolves fixtures and
 * builds a `SessionChecklistModel` route for the checklist table.
 */

export type HaulingIntakeCargoLine = {
  /** Fixture name, code, or slug (e.g. "Iron (Ore)", "STIM", "waste"). */
  commodity: string;
  scu: number;
};

export type HaulingIntakeContract = {
  /** Stable id; matches `mobiglas_contract_transcript.id` when present. */
  id?: string;
  title: string;
  contractor?: string;
  rewardAuec?: number;
  /** Pickup locations (multi-stop contracts list every site). */
  from: string[];
  /** Delivery locations. */
  to: string[];
  cargo: HaulingIntakeCargoLine[];
  /** Max container size from contract text, when known. */
  maxContainerScu?: number;
  /**
   * Optional per-site cargo split when totals are shared across pickups
   * (e.g. Lathan + Bezdek). Keys are location names/slugs.
   */
  pickupSplits?: Record<string, HaulingIntakeCargoLine[]>;
  /**
   * Logical MCP screenshot paths (`<batchId>/<filename>` under
   * `.data/mcp-screenshots`, via `store_hauling_screenshot`).
   */
  screenshots?: string[];
  /** Path to normalized MobiGlas transcript JSON relative to the batch folder. */
  transcript?: string;
};

export type HaulingContractsIntake = {
  kind: "hauling_contracts_intake";
  version: 1;
  sessionName: string;
  /** Optional ship names/slugs for the crew. */
  ships?: string[];
  /**
   * Where the crew begins the run (location name or slug).
   * Cleared when null/omitted on apply unless explicitly set via set_session_start_location.
   */
  startLocation?: string | null;
  contracts: HaulingIntakeContract[];
  notes?: string;
  /**
   * Optional pre-optimized route legs (MCP `replace_hauling_checklist` shape).
   * When present, the server uses these instead of auto-merging contracts.
   */
  legs?: unknown[];
  /** When true (default on MCP apply), restart the session timer. */
  resetTimer?: boolean;
};

export function isHaulingContractsIntake(
  value: unknown,
): value is HaulingContractsIntake {
  if (!value || typeof value !== "object") return false;
  const v = value as HaulingContractsIntake;
  return (
    v.kind === "hauling_contracts_intake" &&
    v.version === 1 &&
    typeof v.sessionName === "string" &&
    Array.isArray(v.contracts)
  );
}
