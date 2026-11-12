import { NextResponse } from "next/server";
import { appApi } from "@/lib/api/appRoutes";
import { markIntakeUploadProcessed } from "@/lib/sessions/intakeUploadStore";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { filename } = await context.params;
    const result = await markIntakeUploadProcessed({ filename });
    return NextResponse.json({
      ...result,
      url: `${appApi.intakeUpload(result.filename)}?status=processed`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark intake upload processed",
      },
      { status: 400 },
    );
  }
}
