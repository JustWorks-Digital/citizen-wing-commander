import { NextResponse } from "next/server";
import {
  checklistEtag,
  getChecklistSession,
  saveChecklistSession,
} from "@/lib/sessions/checklistStore";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";

function withSyncHeaders(
  session: SessionChecklistModel,
  init?: ResponseInit,
): NextResponse {
  const etag = checklistEtag(session);
  const response = NextResponse.json(session, init);
  response.headers.set("ETag", etag);
  response.headers.set("Cache-Control", "no-cache");
  response.headers.set("Last-Modified", new Date(session.updatedAt).toUTCString());
  return response;
}

export async function GET(request: Request) {
  try {
    const session = await getChecklistSession();
    const etag = checklistEtag(session);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-cache",
          "Last-Modified": new Date(session.updatedAt).toUTCString(),
        },
      });
    }
    return withSyncHeaders(session);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load checklist",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as SessionChecklistModel;
    if (!body?.sessionName || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { error: "Expected { sessionName, rows }" },
        { status: 400 },
      );
    }
    const session = await saveChecklistSession(body);
    return withSyncHeaders(session);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save checklist",
      },
      { status: 500 },
    );
  }
}
