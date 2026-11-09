import {
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
  stat,
} from "node:fs/promises";
import path from "node:path";

const STORE_ROOT = path.join(process.cwd(), ".data", "mcp-screenshots");

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const SCREENSHOT_MAX_BYTES = 12 * 1024 * 1024;

export function screenshotContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function sanitizeSegment(value: string, maxLen = 80): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

/** Filenames may carry contract identity tokens; allow longer than batch ids. */
function sanitizeFilename(value: string): string {
  return sanitizeSegment(value, 180) || "shot.png";
}

function resolveBatchDir(batchId?: string): string {
  const batch = sanitizeSegment(batchId || "default") || "default";
  return path.join(STORE_ROOT, batch);
}

/** Logical path stored on transcripts: `<batchId>/<filename>`. */
export function screenshotLogicalPath(batchId: string, filename: string): string {
  const batch = sanitizeSegment(batchId) || "default";
  const file = sanitizeFilename(filename);
  return `${batch}/${file}`;
}

export function absoluteScreenshotPath(logicalPath: string): string {
  const parts = logicalPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid screenshot path: ${logicalPath}`);
  }
  const batch = sanitizeSegment(parts[0]!);
  const filename = sanitizeFilename(parts.slice(1).join("/"));
  return path.join(STORE_ROOT, batch, filename);
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
  return storeHaulingScreenshotBuffer({
    batchId,
    filename: input.filename,
    buffer,
    ext: detectedExt,
    contractId: input.contractId,
  });
}

/** Persist raw image bytes (multipart UI uploads). */
export async function storeHaulingScreenshotBuffer(input: {
  batchId?: string;
  filename?: string;
  buffer: Buffer;
  /** Fallback extension when filename has none (e.g. ".png"). */
  ext?: string;
  contractId?: string;
}): Promise<{
  logicalPath: string;
  absolutePath: string;
  bytes: number;
  batchId: string;
  filename: string;
  contractId?: string;
}> {
  const batchId = sanitizeSegment(input.batchId || "default") || "default";
  const buffer = input.buffer;
  if (buffer.byteLength === 0) {
    throw new Error("Screenshot is empty");
  }
  if (buffer.byteLength > SCREENSHOT_MAX_BYTES) {
    throw new Error("Screenshot exceeds 12MB limit");
  }

  const detectedExt =
    input.ext && ALLOWED_EXT.has(input.ext.toLowerCase())
      ? input.ext.toLowerCase()
      : ".png";

  let filename = input.filename?.trim() || "";
  if (!filename) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = input.contractId
      ? sanitizeSegment(input.contractId)
      : "shot";
    filename = `${prefix}-${stamp}${detectedExt}`;
  } else {
    filename = sanitizeFilename(filename);
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
    filename,
    contractId: input.contractId,
  };
}

/** Read a stored screenshot for MCP / HTTP serving. */
export async function readHaulingScreenshot(logicalPath: string): Promise<{
  logicalPath: string;
  filename: string;
  bytes: number;
  contentType: string;
  buffer: Buffer;
  imageBase64: string;
}> {
  const absolutePath = absoluteScreenshotPath(logicalPath);
  const filename = path.basename(absolutePath);
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported screenshot type: ${filename}`);
  }
  const buffer = await readFile(absolutePath);
  return {
    logicalPath,
    filename,
    bytes: buffer.byteLength,
    contentType: screenshotContentType(filename),
    buffer,
    imageBase64: buffer.toString("base64"),
  };
}

export async function deleteHaulingScreenshot(logicalPath: string): Promise<{
  removed: boolean;
  logicalPath: string;
}> {
  const absolutePath = absoluteScreenshotPath(logicalPath);
  try {
    await unlink(absolutePath);
    return { removed: true, logicalPath };
  } catch {
    return { removed: false, logicalPath };
  }
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
