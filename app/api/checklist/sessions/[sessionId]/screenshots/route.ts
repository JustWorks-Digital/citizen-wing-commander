import { NextResponse } from "next/server";
import path from "node:path";
import { appApi } from "@/lib/api/appRoutes";
import {
  listHaulingScreenshots,
  SCREENSHOT_MAX_BYTES,
  storeHaulingScreenshotBuffer,
} from "@/lib/sessions/screenshotStore";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function withUrls(sessionId: string, batchId: string) {
  return listHaulingScreenshots(batchId).then((screenshots) =>
    screenshots.map((shot) => ({
      ...shot,
      url: appApi.checklistSessionScreenshot(sessionId, shot.filename),
    })),
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const batchId = sessionId.trim();
    if (!batchId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const screenshots = await withUrls(sessionId, batchId);
    return NextResponse.json(
      {
        sessionId,
        batchId,
        count: screenshots.length,
        screenshots,
      },
      { headers: { "Cache-Control": "no-cache" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list screenshots",
      },
      { status: 500 },
    );
  }
}

function collectUploadFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const key of ["file", "files"]) {
    for (const entry of form.getAll(key)) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
  }
  return files;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const batchId = sessionId.trim();
    if (!batchId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const form = await request.formData();
    const incoming = collectUploadFiles(form);
    if (!incoming.length) {
      return NextResponse.json(
        { error: "Expected multipart field `file` or `files`" },
        { status: 400 },
      );
    }

    const uploaded = [];
    for (let index = 0; index < incoming.length; index += 1) {
      const file = incoming[index]!;
      if (file.size > SCREENSHOT_MAX_BYTES) {
        return NextResponse.json(
          { error: `Screenshot exceeds 12MB limit: ${file.name || "file"}` },
          { status: 413 },
        );
      }

      const mime = (file.type || "").toLowerCase();
      const fromMime = EXT_BY_MIME[mime];
      const fromName = path.extname(file.name || "").toLowerCase();
      const ext = fromMime || (fromName || ".png");
      if (
        !fromMime &&
        ![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
      ) {
        return NextResponse.json(
          { error: `Unsupported image type: ${file.name || mime || "unknown"}` },
          { status: 415 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      let filename = file.name || undefined;
      if (filename && incoming.length > 1) {
        const base = path.basename(filename, path.extname(filename));
        const fileExt = path.extname(filename) || ext;
        filename = `${base}-${index + 1}${fileExt}`;
      }

      const stored = await storeHaulingScreenshotBuffer({
        batchId,
        filename,
        buffer,
        ext,
      });
      uploaded.push({
        logicalPath: stored.logicalPath,
        filename: stored.filename,
        bytes: stored.bytes,
        url: appApi.checklistSessionScreenshot(sessionId, stored.filename),
      });
    }

    return NextResponse.json(
      {
        ok: true as const,
        sessionId,
        batchId,
        count: uploaded.length,
        screenshots: uploaded,
        // Back-compat for single-file callers
        ...(uploaded.length === 1
          ? {
              logicalPath: uploaded[0]!.logicalPath,
              filename: uploaded[0]!.filename,
              bytes: uploaded[0]!.bytes,
              url: uploaded[0]!.url,
            }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload screenshot",
      },
      { status: 500 },
    );
  }
}
