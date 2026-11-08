import { NextResponse } from "next/server";
import {
  createChecklistSession,
  listChecklistSessions,
} from "@/lib/sessions/checklistStore";

export async function GET() {
  try {
    const list = await listChecklistSessions();
    return NextResponse.json(list, {
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list checklist sessions",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionName?: string;
      activate?: boolean;
    };
    const session = await createChecklistSession({
      sessionName: body.sessionName,
      activate: body.activate !== false,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checklist session",
      },
      { status: 500 },
    );
  }
}
