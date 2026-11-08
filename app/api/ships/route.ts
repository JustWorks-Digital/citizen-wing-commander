import { NextResponse } from "next/server";
import { listSelectableShips } from "@/db/queries/ships";

/** Selectable ships for the session dropdown (DB-backed UEX stats). */
export async function GET() {
  try {
    const rows = await listSelectableShips();
    return NextResponse.json({
      ships: rows.map((ship) => ({
        id: ship.id,
        slug: ship.slug,
        name: ship.name,
        nameFull: ship.nameFull,
        manufacturer: ship.manufacturer,
        cargoScu: ship.cargoScu,
        isCargo: ship.isCargo,
        containerSizes: ship.containerSizes,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list ships";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
