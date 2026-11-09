import { NextResponse } from "next/server";
import { getCatalogMissionsByIds } from "@/db/queries/catalogMissions";
import {
  createChecklistSession,
  getChecklistSession,
  saveChecklistSession,
  setActiveChecklistSession,
} from "@/lib/sessions/checklistStore";
import { addMissionsAndRebuildRoute } from "@/lib/missions/rebuildSessionRoute";
import { sessionMissionFromCatalog } from "@/lib/missions/sessionMissionFromCatalog";

type Body = {
  catalogMissionIds?: string[];
  /** Existing session to append into. Ignored when createSession is true. */
  sessionId?: string;
  /** Create a new session (and activate it) before adding. */
  createSession?: boolean;
  sessionName?: string;
};

/** POST /api/catalog/missions/add-to-session — add catalog rows to a hauling session. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ids = [...new Set((body.catalogMissionIds ?? []).filter(Boolean))];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "catalogMissionIds is required" },
        { status: 400 },
      );
    }

    const catalogs = await getCatalogMissionsByIds(ids);
    if (catalogs.length === 0) {
      return NextResponse.json(
        { error: "No catalog missions found for those ids" },
        { status: 404 },
      );
    }

    const sessionMissions = catalogs.map(sessionMissionFromCatalog);

    let session;
    if (body.createSession) {
      session = await createChecklistSession({
        sessionName: body.sessionName?.trim() || undefined,
        activate: true,
      });
    } else if (body.sessionId?.trim()) {
      session = await getChecklistSession(body.sessionId.trim());
      await setActiveChecklistSession(session.id);
      session = await getChecklistSession(session.id);
    } else {
      session = await getChecklistSession(null);
    }

    const rebuilt = addMissionsAndRebuildRoute(session, sessionMissions);
    if (!rebuilt.ok) {
      return NextResponse.json({ error: rebuilt.error }, { status: 400 });
    }

    const saved = await saveChecklistSession(rebuilt.session);
    return NextResponse.json({
      ok: true,
      sessionId: saved.id,
      sessionName: saved.sessionName,
      added: rebuilt.added,
      skipped: rebuilt.skipped,
      missionCount: saved.missionCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add catalog missions to session",
      },
      { status: 500 },
    );
  }
}
