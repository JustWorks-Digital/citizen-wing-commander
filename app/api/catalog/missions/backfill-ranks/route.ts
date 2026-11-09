import { NextResponse } from "next/server";
import { backfillCatalogRanks } from "@/lib/missions/backfillCatalogRanks";

/** POST /api/catalog/missions/backfill-ranks — extract rank from titles. */
export async function POST() {
  try {
    const result = await backfillCatalogRanks();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill catalog ranks",
      },
      { status: 500 },
    );
  }
}
