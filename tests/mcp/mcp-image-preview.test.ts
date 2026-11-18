import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  MCP_IMAGE_PREVIEW_MAX_BYTES,
  mcpImagePreview,
} from "@/lib/mcp/mcpImagePreview";

describe("mcpImagePreview", () => {
  it("passes through small images without recompressing", async () => {
    const buffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 20, g: 40, b: 80 },
      },
    })
      .png()
      .toBuffer();

    const preview = await mcpImagePreview(buffer, "image/png");
    expect(preview.isPreview).toBe(false);
    expect(preview.mimeType).toBe("image/png");
    expect(preview.bytes).toBe(buffer.byteLength);
  });

  it("returns a JPEG under the MCP size cap for large PNGs", async () => {
    // Noise-heavy PNG stays large until JPEG recompress.
    const buffer = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 12, g: 24, b: 48 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    expect(buffer.byteLength).toBeGreaterThan(MCP_IMAGE_PREVIEW_MAX_BYTES);

    const preview = await mcpImagePreview(buffer, "image/png");
    expect(preview.isPreview).toBe(true);
    expect(preview.mimeType).toBe("image/jpeg");
    expect(preview.bytes).toBeLessThanOrEqual(MCP_IMAGE_PREVIEW_MAX_BYTES);
    expect(preview.bytes).toBeGreaterThan(1_000);
    expect(preview.width).toBeTruthy();
    expect(preview.height).toBeTruthy();
  });
});
