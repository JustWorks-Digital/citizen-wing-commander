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
  response.headers.set("X-Session-Id", session.id);
  return response;
}

function sessionIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sessionId");
  return fromQuery?.trim() || null;
}

export async function GET(request: Request) {
  try {
    const sessionId = sessionIdFromRequest(request);
    const session = await getChecklistSession(sessionId);
    const etag = checklistEtag(session);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-cache",
          "Last-Modified": new Date(session.updatedAt).toUTCString(),
          "X-Session-Id": session.id,
        },
      });
    }
    return withSyncHeaders(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load checklist";
    const status = message.startsWith("Unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
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
    const queryId = sessionIdFromRequest(request);
    const session = await saveChecklistSession({
      ...body,
      id: body.id?.trim() || queryId || body.id,
    });
    return withSyncHeaders(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save checklist";
    const status = message.startsWith("Unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
