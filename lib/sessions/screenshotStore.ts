import {
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { isIP } from "node:net";

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

const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Detect image type from magic bytes; null when not a known image. */
export function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return ".png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return ".jpg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF87a" ||
      buffer.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return ".gif";
  }
  return null;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  const ipVersion = isIP(host);
  if (!ipVersion) return false;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  if (ipVersion === 4) {
    const parts = host.split(".").map((part) => Number(part));
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b != null && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function filenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const base = path.basename(pathname);
    if (!base || base === "/" || !base.includes(".")) return undefined;
    return base;
  } catch {
    return undefined;
  }
}

/**
 * Download an image the MCP server can reach (http/https).
 * ChatGPT `/mnt/data/...` paths are NOT public — pass a reachable URL instead.
 */
export async function downloadHaulingScreenshotUrl(fileUrl: string): Promise<{
  buffer: Buffer;
  ext: string;
  suggestedFilename?: string;
  source: string;
}> {
  const trimmed = fileUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid fileUrl: ${trimmed}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("fileUrl must be http:// or https://");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(
      `fileUrl host is not allowed (${parsed.hostname}). Use a publicly reachable image URL.`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(parsed, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to download fileUrl";
    throw new Error(`Could not download screenshot URL: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `Screenshot URL returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > SCREENSHOT_MAX_BYTES) {
    throw new Error("Screenshot exceeds 12MB limit");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength === 0) {
    throw new Error("Screenshot URL returned empty body");
  }
  if (buffer.byteLength > SCREENSHOT_MAX_BYTES) {
    throw new Error("Screenshot exceeds 12MB limit");
  }

  const ext = detectImageExtension(buffer);
  if (!ext) {
    throw new Error(
      "Downloaded file is not a recognized image (png/jpeg/webp/gif)",
    );
  }

  return {
    buffer,
    ext,
    suggestedFilename: filenameFromUrl(trimmed),
    source: trimmed,
  };
}

/**
 * Resolve screenshot bytes from base64, a downloadable URL, or a local path
 * the MCP host can read. Prefer fileUrl for remote MCP (Railway).
 */
export async function resolveHaulingScreenshotBytes(input: {
  imageBase64?: string;
  fileUrl?: string;
  filePath?: string;
}): Promise<{
  buffer: Buffer;
  ext: string;
  suggestedFilename?: string;
  sourceKind: "imageBase64" | "fileUrl" | "filePath";
  source: string;
}> {
  const fileUrl = input.fileUrl?.trim() || "";
  const filePath = input.filePath?.trim() || "";
  const imageBase64 = input.imageBase64?.trim() || "";

  if (fileUrl) {
    const downloaded = await downloadHaulingScreenshotUrl(fileUrl);
    return {
      buffer: downloaded.buffer,
      ext: downloaded.ext,
      suggestedFilename: downloaded.suggestedFilename,
      sourceKind: "fileUrl",
      source: downloaded.source,
    };
  }

  if (filePath) {
    if (/^https?:\/\//i.test(filePath)) {
      const downloaded = await downloadHaulingScreenshotUrl(filePath);
      return {
        buffer: downloaded.buffer,
        ext: downloaded.ext,
        suggestedFilename: downloaded.suggestedFilename,
        sourceKind: "fileUrl",
        source: downloaded.source,
      };
    }
    if (
      filePath.startsWith("/mnt/data") ||
      filePath.startsWith("sandbox:") ||
      filePath.includes("\\mnt\\data")
    ) {
      throw new Error(
        "filePath looks like a ChatGPT sandbox path (/mnt/data). That path is not reachable by the MCP server. Upload via a publicly reachable fileUrl, or pass imageBase64.",
      );
    }
    const absolutePath = path.resolve(filePath);
    const buffer = await readFile(absolutePath);
    if (buffer.byteLength === 0) {
      throw new Error("filePath is empty");
    }
    if (buffer.byteLength > SCREENSHOT_MAX_BYTES) {
      throw new Error("Screenshot exceeds 12MB limit");
    }
    const ext =
      detectImageExtension(buffer) ||
      (ALLOWED_EXT.has(path.extname(absolutePath).toLowerCase())
        ? path.extname(absolutePath).toLowerCase()
        : null);
    if (!ext) {
      throw new Error(
        "filePath is not a recognized image (png/jpeg/webp/gif)",
      );
    }
    return {
      buffer,
      ext,
      suggestedFilename: path.basename(absolutePath),
      sourceKind: "filePath",
      source: absolutePath,
    };
  }

  if (imageBase64) {
    const { buffer, ext } = stripDataUrl(imageBase64);
    if (buffer.byteLength === 0) {
      throw new Error("imageBase64 is empty");
    }
    const magicExt = detectImageExtension(buffer);
    return {
      buffer,
      ext: magicExt ?? ext,
      sourceKind: "imageBase64",
      source: "imageBase64",
    };
  }

  throw new Error(
    "Provide fileUrl, filePath, or imageBase64 (prefer fileUrl for ChatGPT attachments the server can download)",
  );
}

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
