import { NextResponse } from "next/server";
import {
  getCatalogMission,
  getCatalogMissionByScreenshotFilename,
  getCatalogMissionsByIds,
  listCatalogMissions,
} from "@/db/queries/catalogMissions";

/** GET /api/catalog/missions?ids=uuid,uuid — or list recent when ids omitted. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const screenshot = searchParams.get("screenshot")?.trim();
    if (screenshot) {
      const one = await getCatalogMissionByScreenshotFilename(screenshot);
      return NextResponse.json({
        count: one ? 1 : 0,
        missions: one ? [one] : [],
      });
    }

    const idsParam = searchParams.get("ids")?.trim();
    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ count: 0, missions: [] });
      }
      if (ids.length === 1) {
        const one = await getCatalogMission(ids[0]!);
        return NextResponse.json({
          count: one ? 1 : 0,
          missions: one ? [one] : [],
        });
      }
      const rows = await getCatalogMissionsByIds(ids);
      return NextResponse.json({ count: rows.length, missions: rows });
    }

    const limit = Number(searchParams.get("limit") ?? 50);
    const offerLocation = searchParams.get("offerLocation");
    const rows = await listCatalogMissions({
      offerLocationSlug: offerLocation,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json({ count: rows.length, missions: rows });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load catalog missions",
      },
      { status: 500 },
    );
  }
}
