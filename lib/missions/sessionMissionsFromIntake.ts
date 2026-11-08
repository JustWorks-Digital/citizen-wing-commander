import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HaulingIntakeContract } from "@/lib/missions/haulingIntake";
import {
  isMobiglasContractTranscript,
  type MobiglasContractTranscript,
} from "@/lib/missions/mobiglasTranscript";
import {
  sessionMissionFromIntakeContract,
  type SessionMission,
} from "@/lib/missions/sessionMissions";

async function tryReadFixtureTranscript(
  contract: HaulingIntakeContract,
): Promise<MobiglasContractTranscript | null> {
  if (!contract.transcript?.trim()) return null;
  const batchId = contract.screenshots?.[0]?.split("/")[0];
  const rel = contract.transcript.replace(/^\.?\//, "");
  const candidates = [
    batchId
      ? path.join(process.cwd(), "lib/fixtures/hauling-intake", batchId, rel)
      : null,
    path.join(
      process.cwd(),
      "lib/fixtures/hauling-intake/hurston-covalex-2026-11-08",
      rel,
    ),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      if (isMobiglasContractTranscript(raw)) return raw;
    } catch {
      // try next
    }
  }
  return null;
}

/** Build session missions from intake contracts (prefer fixture transcripts). */
export async function buildSessionMissionsFromIntake(
  contracts: HaulingIntakeContract[],
): Promise<SessionMission[]> {
  const missions: SessionMission[] = [];
  for (const [index, contract] of contracts.entries()) {
    const transcript = await tryReadFixtureTranscript(contract);
    missions.push(
      sessionMissionFromIntakeContract(contract, index, transcript?.mobiglas),
    );
  }
  return missions;
}
