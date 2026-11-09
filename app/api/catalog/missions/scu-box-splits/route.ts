import { NextResponse } from "next/server";
import { updateCatalogMissionScuBoxSplits } from "@/db/queries/catalogMissions";
import {
  normalizeScuBoxSplits,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";

type Body = {
  missionId?: string;
  scuBoxSplits?: ScuBoxSplits;
};

/** POST /api/catalog/missions/scu-box-splits — set durable crate-mix default. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const missionId = body.missionId?.trim();
    if (!missionId) {
      return NextResponse.json(
        { error: "missionId is required" },
        { status: 400 },
      );
    }
    if (!body.scuBoxSplits) {
      return NextResponse.json(
        { error: "scuBoxSplits is required" },
        { status: 400 },
      );
    }

    const row = await updateCatalogMissionScuBoxSplits({
      missionId,
      scuBoxSplits: normalizeScuBoxSplits(body.scuBoxSplits),
    });
    return NextResponse.json({ ok: true, mission: row });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update catalog scuBoxSplits";
    const status = message.startsWith("Catalog mission not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
