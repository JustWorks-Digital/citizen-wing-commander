import sharp from "sharp";

/** Raw JPEG/PNG size target so base64 (~4/3×) stays host-friendly for ChatGPT MCP. */
export const MCP_IMAGE_PREVIEW_MAX_BYTES = 900_000;

export type McpImagePreview = {
  imageBase64: string;
  mimeType: string;
  /** Preview (or original if already small) byte length. */
  bytes: number;
  width: number | null;
  height: number | null;
  /** True when we recompressed / resized away from the stored original. */
  isPreview: boolean;
};

/**
 * Build an MCP-safe image payload from a stored screenshot buffer.
 * Original file on disk is never modified — large PNGs become a JPEG preview
 * under {@link MCP_IMAGE_PREVIEW_MAX_BYTES}.
 */
export async function mcpImagePreview(
  buffer: Buffer,
  contentType: string,
): Promise<McpImagePreview> {
  if (buffer.byteLength <= MCP_IMAGE_PREVIEW_MAX_BYTES) {
    const meta = await sharp(buffer).metadata().catch(() => null);
    return {
      imageBase64: buffer.toString("base64"),
      mimeType: contentType || "image/png",
      bytes: buffer.byteLength,
      width: meta?.width ?? null,
      height: meta?.height ?? null,
      isPreview: false,
    };
  }

  let width = 1600;
  let quality = 78;
  let out = await encodeJpegPreview(buffer, width, quality);

  while (out.buffer.byteLength > MCP_IMAGE_PREVIEW_MAX_BYTES && quality > 42) {
    quality -= 12;
    out = await encodeJpegPreview(buffer, width, quality);
  }
  while (out.buffer.byteLength > MCP_IMAGE_PREVIEW_MAX_BYTES && width > 720) {
    width = Math.floor(width * 0.75);
    out = await encodeJpegPreview(buffer, width, quality);
  }

  return {
    imageBase64: out.buffer.toString("base64"),
    mimeType: "image/jpeg",
    bytes: out.buffer.byteLength,
    width: out.width,
    height: out.height,
    isPreview: true,
  };
}

async function encodeJpegPreview(
  buffer: Buffer,
  width: number,
  quality: number,
): Promise<{ buffer: Buffer; width: number | null; height: number | null }> {
  const pipeline = sharp(buffer)
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality, mozjpeg: true });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: info.width ?? null,
    height: info.height ?? null,
  };
}
