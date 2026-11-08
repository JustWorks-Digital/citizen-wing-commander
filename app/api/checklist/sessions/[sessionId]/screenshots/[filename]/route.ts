import { NextResponse } from "next/server";
import {
  deleteHaulingScreenshot,
  readHaulingScreenshot,
  screenshotLogicalPath,
} from "@/lib/sessions/screenshotStore";

type RouteContext = {
  params: Promise<{ sessionId: string; filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId, filename } = await context.params;
    const logicalPath = screenshotLogicalPath(sessionId, filename);
    const shot = await readHaulingScreenshot(logicalPath);
    return new NextResponse(new Uint8Array(shot.buffer), {
      status: 200,
      headers: {
        "Content-Type": shot.contentType,
        "Content-Length": String(shot.bytes),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read screenshot";
    const status =
      message.includes("ENOENT") || message.startsWith("Invalid")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sessionId, filename } = await context.params;
    const logicalPath = screenshotLogicalPath(sessionId, filename);
    const result = await deleteHaulingScreenshot(logicalPath);
    if (!result.removed) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, logicalPath: result.logicalPath });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete screenshot",
      },
      { status: 500 },
    );
  }
}
