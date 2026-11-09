import { NextResponse } from "next/server";
import { backfillCatalogRouteFlags } from "@/lib/missions/backfillCatalogRouteFlags";

/** POST /api/catalog/missions/backfill-route-flags — derive route flags from splits. */
export async function POST() {
  try {
    const result = await backfillCatalogRouteFlags();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill catalog route flags",
      },
      { status: 500 },
    );
  }
}
