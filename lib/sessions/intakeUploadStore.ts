import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import {
  absoluteScreenshotPath,
  deleteHaulingScreenshot,
  listHaulingScreenshots,
  readHaulingScreenshot,
  SCREENSHOT_MAX_BYTES,
  storeHaulingScreenshotBuffer,
} from "@/lib/sessions/screenshotStore";

/** Reserved batch — UI/MCP inbox for contract images awaiting AI intake. */
export const INTAKE_PENDING_BATCH = "intake-pending";
/** Reserved batch — moved here after an AI agent finishes reading the shot. */
export const INTAKE_PROCESSED_BATCH = "intake-processed";

export type IntakeUploadStatus = "pending" | "processed";

export type IntakeUploadItem = {
  status: IntakeUploadStatus;
  logicalPath: string;
  filename: string;
  bytes: number;
  mtime: string;
};

function batchForStatus(status: IntakeUploadStatus): string {
  return status === "processed" ? INTAKE_PROCESSED_BATCH : INTAKE_PENDING_BATCH;
}

export async function listIntakeUploads(
  status: IntakeUploadStatus | "all" = "pending",
): Promise<IntakeUploadItem[]> {
  const statuses: IntakeUploadStatus[] =
    status === "all" ? ["pending", "processed"] : [status];
  const rows: IntakeUploadItem[] = [];
  for (const entry of statuses) {
    const listed = await listHaulingScreenshots(batchForStatus(entry));
    for (const shot of listed) {
      rows.push({
        status: entry,
        logicalPath: shot.logicalPath,
        filename: shot.filename,
        bytes: shot.bytes,
        mtime: shot.mtime,
      });
    }
  }
  return rows.sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export async function storeIntakeUpload(input: {
  filename?: string;
  buffer: Buffer;
  ext?: string;
}): Promise<{
  status: "pending";
  logicalPath: string;
  filename: string;
  bytes: number;
  batchId: string;
}> {
  const stored = await storeHaulingScreenshotBuffer({
    batchId: INTAKE_PENDING_BATCH,
    filename: input.filename,
    buffer: input.buffer,
    ext: input.ext,
  });
  return {
    status: "pending",
    logicalPath: stored.logicalPath,
    filename: stored.filename,
    bytes: stored.bytes,
    batchId: stored.batchId,
  };
}

export async function readIntakeUpload(input: {
  logicalPath?: string;
  filename?: string;
  status?: IntakeUploadStatus;
}): Promise<{
  status: IntakeUploadStatus;
  logicalPath: string;
  filename: string;
  bytes: number;
  contentType: string;
  buffer: Buffer;
  imageBase64: string;
}> {
  const explicit = input.logicalPath?.trim();
  const filename = input.filename?.trim();
  const candidates: string[] = [];
  if (explicit) {
    candidates.push(explicit);
  } else if (filename) {
    const status = input.status ?? "pending";
    candidates.push(`${batchForStatus(status)}/${filename}`);
    if (!input.status) {
      candidates.push(`${INTAKE_PROCESSED_BATCH}/${filename}`);
    }
  } else {
    throw new Error("Provide logicalPath or filename");
  }

  let lastError: unknown;
  for (const logicalPath of candidates) {
    try {
      const shot = await readHaulingScreenshot(logicalPath);
      const status: IntakeUploadStatus = logicalPath.startsWith(
        `${INTAKE_PROCESSED_BATCH}/`,
      )
        ? "processed"
        : "pending";
      return {
        status,
        logicalPath: shot.logicalPath,
        filename: shot.filename,
        bytes: shot.bytes,
        contentType: shot.contentType,
        buffer: shot.buffer,
        imageBase64: shot.imageBase64,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Intake upload not found");
}

/**
 * Move a pending intake image into the processed batch after AI has read it
 * (and ideally created/updated catalog missions from it).
 */
export async function markIntakeUploadProcessed(input: {
  logicalPath?: string;
  filename?: string;
}): Promise<{
  ok: true;
  fromLogicalPath: string;
  toLogicalPath: string;
  filename: string;
}> {
  const fromLogicalPath =
    input.logicalPath?.trim() ||
    (input.filename?.trim()
      ? `${INTAKE_PENDING_BATCH}/${input.filename.trim()}`
      : "");
  if (!fromLogicalPath.startsWith(`${INTAKE_PENDING_BATCH}/`)) {
    throw new Error(
      "Only pending intake uploads can be marked processed (intake-pending/<filename>)",
    );
  }

  const shot = await readHaulingScreenshot(fromLogicalPath);
  const toLogicalPath = `${INTAKE_PROCESSED_BATCH}/${shot.filename}`;
  const fromAbsolute = absoluteScreenshotPath(fromLogicalPath);
  const toAbsolute = absoluteScreenshotPath(toLogicalPath);

  await mkdir(path.dirname(toAbsolute), { recursive: true });
  try {
    await rename(fromAbsolute, toAbsolute);
  } catch {
    // Cross-device / collision fallback: rewrite then delete.
    await storeHaulingScreenshotBuffer({
      batchId: INTAKE_PROCESSED_BATCH,
      filename: shot.filename,
      buffer: shot.buffer,
      ext: path.extname(shot.filename) || undefined,
    });
    await deleteHaulingScreenshot(fromLogicalPath);
  }

  return {
    ok: true,
    fromLogicalPath,
    toLogicalPath,
    filename: shot.filename,
  };
}

export async function deleteIntakeUpload(input: {
  logicalPath?: string;
  filename?: string;
  status?: IntakeUploadStatus;
}): Promise<{ removed: boolean; logicalPath: string }> {
  const logicalPath =
    input.logicalPath?.trim() ||
    (input.filename?.trim()
      ? `${batchForStatus(input.status ?? "pending")}/${input.filename.trim()}`
      : "");
  if (!logicalPath) {
    throw new Error("Provide logicalPath or filename");
  }
  return deleteHaulingScreenshot(logicalPath);
}

export { SCREENSHOT_MAX_BYTES };
