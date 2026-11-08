import { NextResponse } from "next/server";
import {
  addHaulingMission,
  createSessionWithOwner,
  listSessions,
} from "@/db/queries";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set" },
      { status: 503 },
    );
  }

  try {
    const rows = await listSessions();
    return NextResponse.json({ sessions: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 },
    );
  }
}

/** Minimal create endpoint to prove the hauling session model. */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      sessionName?: string;
      ownerDisplayName?: string;
      ownerHandle?: string;
      seedHaulingMission?: boolean;
    };

    const sessionName = body.sessionName?.trim() || "Hauling ops";
    const ownerDisplayName = body.ownerDisplayName?.trim() || "Pilot";

    const { session, owner } = await createSessionWithOwner({
      sessionName,
      ownerDisplayName,
      ownerHandle: body.ownerHandle?.trim(),
    });

    let mission = null;
    if (body.seedHaulingMission !== false) {
      mission = await addHaulingMission({
        sessionId: session.id,
        title: "Hauling contract",
      });
    }

    return NextResponse.json(
      { session, owner, mission },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 500 },
    );
  }
}
