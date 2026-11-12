import { NextResponse } from "next/server";
import {
  deleteIntakeUpload,
  readIntakeUpload,
  type IntakeUploadStatus,
} from "@/lib/sessions/intakeUploadStore";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

function parseStatus(raw: string | null): IntakeUploadStatus | undefined {
  if (raw === "processed" || raw === "pending") return raw;
  return undefined;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { filename } = await context.params;
    const status = parseStatus(new URL(request.url).searchParams.get("status"));
    const shot = await readIntakeUpload({ filename, status });
    return new NextResponse(new Uint8Array(shot.buffer), {
      headers: {
        "Content-Type": shot.contentType,
        "Content-Length": String(shot.bytes),
        "Cache-Control": "private, max-age=60",
        "X-Intake-Status": shot.status,
        "X-Intake-Logical-Path": shot.logicalPath,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read intake upload",
      },
      { status: 404 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { filename } = await context.params;
    const status =
      parseStatus(new URL(request.url).searchParams.get("status")) ?? "pending";
    const result = await deleteIntakeUpload({ filename, status });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete intake upload",
      },
      { status: 500 },
    );
  }
}
