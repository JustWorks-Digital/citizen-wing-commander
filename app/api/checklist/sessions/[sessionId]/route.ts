import { NextResponse } from "next/server";
import { deleteChecklistSession } from "@/lib/sessions/checklistStore";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/** Soft-delete (close) a hauling session tab. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const result = await deleteChecklistSession(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete checklist session";
    const status = message.startsWith("Unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
