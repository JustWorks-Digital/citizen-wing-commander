import { NextResponse } from "next/server";
import path from "node:path";
import { appApi } from "@/lib/api/appRoutes";
import {
  listIntakeUploads,
  SCREENSHOT_MAX_BYTES,
  storeIntakeUpload,
  type IntakeUploadStatus,
} from "@/lib/sessions/intakeUploadStore";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function withUrls(
  uploads: Awaited<ReturnType<typeof listIntakeUploads>>,
) {
  return uploads.map((shot) => ({
    ...shot,
    url: appApi.intakeUpload(shot.filename),
  }));
}

function parseStatus(raw: string | null): IntakeUploadStatus | "all" {
  if (raw === "processed" || raw === "all" || raw === "pending") return raw;
  return "pending";
}

export async function GET(request: Request) {
  try {
    const status = parseStatus(new URL(request.url).searchParams.get("status"));
    const uploads = withUrls(await listIntakeUploads(status));
    return NextResponse.json(
      {
        status,
        count: uploads.length,
        uploads,
      },
      { headers: { "Cache-Control": "no-cache" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list intake uploads",
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

export async function POST(request: Request) {
  try {
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

      const stored = await storeIntakeUpload({
        filename,
        buffer,
        ext,
      });
      uploaded.push({
        status: stored.status,
        logicalPath: stored.logicalPath,
        filename: stored.filename,
        bytes: stored.bytes,
        mtime: new Date().toISOString(),
        url: appApi.intakeUpload(stored.filename),
      });
    }

    return NextResponse.json(
      {
        ok: true as const,
        count: uploaded.length,
        uploads: uploaded,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload intake image",
      },
      { status: 500 },
    );
  }
}
