import {
  formatAuecAmount,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import type {
  HaulingIntakeCargoLine,
  HaulingIntakeContract,
} from "@/lib/missions/haulingIntake";
import type { MobiglasContractPanel } from "@/lib/missions/mobiglasTranscript";

/** Mission card stored on the active checklist session for UI / MCP. */
export type SessionMission = {
  id: string;
  /**
   * Optional link to `catalog_missions.id` for durable mission details.
   * When set, the missions modal prefers catalog payload fields.
   */
  catalogMissionId?: string | null;
  title: string;
  contractor: string;
  rewardAuec: number;
  rewardDisplay?: string;
  from: string[];
  to: string[];
  cargo: HaulingIntakeCargoLine[];
  pickupSplits?: Record<string, HaulingIntakeCargoLine[]>;
  /**
   * Per-leg collect→deliver splits (from catalog / OCR extras).
   * When present, drives Collect / Deliver objective lines in the modal.
   */
  deliverySplits?: Array<{
    from: string;
    to: string;
    commodity: string;
    scu: number;
  }>;
  maxContainerScu?: number;
  /**
   * Selected physical crate mix for this mission’s total SCU.
   * Drives 2D/3D bay packing when stamped onto route cargo lines.
   */
  scuBoxSplits?: ScuBoxSplits;
  /** Short cargo summary for tiles (e.g. "96 SCU Stims"). */
  cargoSummary: string;
  isCompleted: boolean;
  /** When true, mission stays in the list but is excluded from the route table. */
  isHidden?: boolean;
  screenshots: string[];
  transcript?: string;
  mobiglas: MobiglasContractPanel;
};

function cargoSummary(contract: HaulingIntakeContract): string {
  return contract.cargo
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
}

function synthesizeMobiglas(
  contract: HaulingIntakeContract,
): MobiglasContractPanel {
  const from = contract.from.join(", ");
  const to = contract.to.join(", ");
  const cargo = cargoSummary(contract);
  return {
    tab: "Accepted",
    category: "Hauling - Planetary",
    title: contract.title,
    contractor: contract.contractor ?? "Unknown contractor",
    rewardAuec: contract.rewardAuec ?? 0,
    rewardDisplay:
      contract.rewardAuec != null
        ? formatAuecAmount(contract.rewardAuec)
        : undefined,
    timeRemaining: null,
    deadline: null,
    details: `Haul ${cargo} from ${from} to ${to}.${
      contract.maxContainerScu
        ? ` Containers at most ${contract.maxContainerScu} SCU.`
        : ""
    }`,
    objectives: [
      {
        label: `Deliver ${cargo} to ${to}`,
        progressCurrent: 0,
        progressTotal: contract.cargo.reduce((sum, line) => sum + line.scu, 0),
        children: contract.from.map((site) => `Collect from ${site}`),
      },
    ],
  };
}

export function sessionMissionFromIntakeContract(
  contract: HaulingIntakeContract,
  index: number,
  mobiglas?: MobiglasContractPanel,
): SessionMission {
  const id = contract.id?.trim() || `contract-${index + 1}`;
  return {
    id,
    title: contract.title,
    contractor: contract.contractor ?? "Unknown contractor",
    rewardAuec: contract.rewardAuec ?? 0,
    rewardDisplay:
      contract.rewardAuec != null
        ? formatAuecAmount(contract.rewardAuec)
        : undefined,
    from: [...contract.from],
    to: [...contract.to],
    cargo: contract.cargo.map((line) => ({ ...line })),
    pickupSplits: contract.pickupSplits
      ? Object.fromEntries(
          Object.entries(contract.pickupSplits).map(([key, lines]) => [
            key,
            lines.map((line) => ({ ...line })),
          ]),
        )
      : undefined,
    maxContainerScu: contract.maxContainerScu,
    cargoSummary: cargoSummary(contract),
    isCompleted: false,
    isHidden: false,
    screenshots: contract.screenshots ? [...contract.screenshots] : [],
    transcript: contract.transcript,
    mobiglas: mobiglas ?? synthesizeMobiglas(contract),
  };
}

export function intakeContractFromSessionMission(
  mission: SessionMission,
): HaulingIntakeContract {
  return {
    id: mission.id,
    title: mission.title,
    contractor: mission.contractor,
    rewardAuec: mission.rewardAuec,
    from: [...mission.from],
    to: [...mission.to],
    cargo: mission.cargo.map((line) => ({ ...line })),
    pickupSplits: mission.pickupSplits
      ? Object.fromEntries(
          Object.entries(mission.pickupSplits).map(([key, lines]) => [
            key,
            lines.map((line) => ({ ...line })),
          ]),
        )
      : undefined,
    maxContainerScu: mission.maxContainerScu,
    screenshots: [...mission.screenshots],
    transcript: mission.transcript,
  };
}
