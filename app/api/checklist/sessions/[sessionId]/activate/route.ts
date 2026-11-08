import { NextResponse } from "next/server";
import { setActiveChecklistSession } from "@/lib/sessions/checklistStore";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await setActiveChecklistSession(sessionId);
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to activate checklist session";
    const status = message.startsWith("Unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
