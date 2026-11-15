import { NextResponse } from "next/server";
import { duplicateChecklistSession } from "@/lib/sessions/checklistStore";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/** POST — copy this trip into a new session (template / re-run). */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await duplicateChecklistSession(sessionId, {
      activate: true,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to copy checklist session";
    const status = message.startsWith("Unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
