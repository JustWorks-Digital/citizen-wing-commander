import { mkdir, readdir, unlink, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const STORE_ROOT = path.join(process.cwd(), ".data", "mcp-screenshots");

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveBatchDir(batchId?: string): string {
  const batch = sanitizeSegment(batchId || "default") || "default";
  return path.join(STORE_ROOT, batch);
}

/** Logical path stored on transcripts: `<batchId>/<filename>`. */
export function screenshotLogicalPath(batchId: string, filename: string): string {
  const batch = sanitizeSegment(batchId) || "default";
  const file = sanitizeSegment(filename) || "shot.png";
  return `${batch}/${file}`;
}

export function absoluteScreenshotPath(logicalPath: string): string {
  const parts = logicalPath.split("/").filter(Boolean).map(sanitizeSegment);
  if (parts.length < 2) {
    throw new Error(`Invalid screenshot path: ${logicalPath}`);
  }
  return path.join(STORE_ROOT, ...parts);
}

function stripDataUrl(input: string): { buffer: Buffer; ext: string } {
  const trimmed = input.trim();
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
  if (match) {
    const mime = match[1]!.toLowerCase();
    const ext =
      mime === "image/jpeg"
        ? ".jpg"
        : mime === "image/png"
          ? ".png"
          : mime === "image/webp"
            ? ".webp"
            : mime === "image/gif"
              ? ".gif"
              : ".png";
    return { buffer: Buffer.from(match[2]!, "base64"), ext };
  }
  return { buffer: Buffer.from(trimmed, "base64"), ext: ".png" };
}

export async function storeHaulingScreenshot(input: {
  batchId?: string;
  filename?: string;
  /** Raw base64 or `data:image/...;base64,...` */
  imageBase64: string;
  contractId?: string;
}): Promise<{
  logicalPath: string;
  absolutePath: string;
  bytes: number;
  batchId: string;
  contractId?: string;
}> {
  const batchId = sanitizeSegment(input.batchId || "default") || "default";
  const { buffer, ext: detectedExt } = stripDataUrl(input.imageBase64);
  if (buffer.byteLength === 0) {
    throw new Error("imageBase64 is empty");
  }
  if (buffer.byteLength > 12 * 1024 * 1024) {
    throw new Error("Screenshot exceeds 12MB limit");
  }

  let filename = input.filename?.trim() || "";
  if (!filename) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = input.contractId
      ? sanitizeSegment(input.contractId)
      : "shot";
    filename = `${prefix}-${stamp}${detectedExt}`;
  } else {
    filename = sanitizeSegment(filename);
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      filename = `${filename}${detectedExt}`;
    }
  }

  const dir = resolveBatchDir(batchId);
  await mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);
  const logicalPath = screenshotLogicalPath(batchId, filename);

  return {
    logicalPath,
    absolutePath,
    bytes: buffer.byteLength,
    batchId,
    contractId: input.contractId,
  };
}

export async function listHaulingScreenshots(batchId?: string): Promise<
  {
    logicalPath: string;
    filename: string;
    bytes: number;
    mtime: string;
  }[]
> {
  const dir = resolveBatchDir(batchId);
  try {
    const names = await readdir(dir);
    const rows = [];
    for (const name of names) {
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) continue;
      const absolutePath = path.join(dir, name);
      const info = await stat(absolutePath);
      if (!info.isFile()) continue;
      const batch = sanitizeSegment(batchId || "default") || "default";
      rows.push({
        logicalPath: `${batch}/${name}`,
        filename: name,
        bytes: info.size,
        mtime: info.mtime.toISOString(),
      });
    }
    return rows.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch {
    return [];
  }
}

export async function clearHaulingScreenshots(batchId?: string): Promise<{
  removed: number;
  batchId: string;
}> {
  const batch = sanitizeSegment(batchId || "default") || "default";
  const dir = resolveBatchDir(batch);
  let removed = 0;
  try {
    const names = await readdir(dir);
    for (const name of names) {
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) continue;
      await unlink(path.join(dir, name));
      removed += 1;
    }
  } catch {
    // empty / missing
  }
  return { removed, batchId: batch };
}
