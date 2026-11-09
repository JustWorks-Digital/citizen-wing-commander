import { backfillCatalogOfferStarSystem } from "@/lib/missions/backfillCatalogOfferStarSystem";

/** POST /api/catalog/missions/backfill-offer-star-system — set offer star system. */
export async function POST() {
  try {
    const result = await backfillCatalogOfferStarSystem();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill offer star systems",
      },
      { status: 500 },
    );
  }
}
