import { NextResponse } from "next/server";
import { renameAllCatalogMissionScreenshots } from "@/lib/missions/renameCatalogScreenshot";

/** POST /api/catalog/missions/rename-screenshots — batch rename catalog source shots. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
      limit?: number;
      cleanupDuplicates?: boolean;
    };
    const result = await renameAllCatalogMissionScreenshots({
      dryRun: Boolean(body.dryRun),
      limit: body.limit ?? 500,
      cleanupDuplicates: body.cleanupDuplicates !== false,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to rename catalog screenshots",
      },
      { status: 500 },
    );
  }
}
