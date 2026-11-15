import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  OPENAI_FILE_PARAMS_META_KEY,
  STORE_HAULING_SCREENSHOT_FILE_PARAM,
  openaiChatFileSchema,
  parseOpenAiChatFile,
  storeHaulingScreenshotOpenAiMeta,
} from "@/lib/mcp/openaiFileParams";

/** Minimal 1×1 PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_BUFFER = Buffer.from(PNG_BASE64, "base64");

describe("openai/fileParams schema for store_hauling_screenshot", () => {
  it("declares all four OpenAI file properties with required download_url + file_id", () => {
    const json = z.toJSONSchema(openaiChatFileSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(json.type).toBe("object");
    expect(Object.keys(json.properties ?? {}).sort()).toEqual([
      "download_url",
      "file_id",
      "file_name",
      "mime_type",
    ]);
    expect(json.required?.sort()).toEqual(["download_url", "file_id"]);
  });

  it("exposes openai/fileParams meta pointing at the file parameter", () => {
    expect(storeHaulingScreenshotOpenAiMeta).toEqual({
      [OPENAI_FILE_PARAMS_META_KEY]: [STORE_HAULING_SCREENSHOT_FILE_PARAM],
    });
    expect(STORE_HAULING_SCREENSHOT_FILE_PARAM).toBe("file");
  });

  it("registers _meta on an MCP tool descriptor the same way as route.ts", async () => {
    const { McpServer } = await import("@modelcontextprotocol/server");
    const server = new McpServer({ name: "test", version: "0.0.0" });
    server.registerTool(
      "store_hauling_screenshot",
      {
        description: "test",
        inputSchema: z.object({
          [STORE_HAULING_SCREENSHOT_FILE_PARAM]: openaiChatFileSchema.optional(),
          fileUrl: z.string().optional(),
        }),
        _meta: { ...storeHaulingScreenshotOpenAiMeta },
      },
      async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    );

    const registered = (
      server as unknown as {
        _registeredTools: Record<string, { _meta?: Record<string, unknown> }>;
      }
    )._registeredTools?.store_hauling_screenshot;

    expect(registered?._meta?.[OPENAI_FILE_PARAMS_META_KEY]).toEqual(["file"]);
  });
});

describe("parseOpenAiChatFile", () => {
  it("accepts a complete ChatGPT file object", () => {
    const parsed = parseOpenAiChatFile({
      download_url: "https://files.example/shot.png",
      file_id: "file_abc",
      mime_type: "image/png",
      file_name: "shot.png",
    });
    expect(parsed).toEqual({
      file: {
        download_url: "https://files.example/shot.png",
        file_id: "file_abc",
        mime_type: "image/png",
        file_name: "shot.png",
      },
    });
  });

  it("rejects missing download_url and bare string file ids", () => {
    expect(parseOpenAiChatFile({ file_id: "file_abc" })).toMatchObject({
      error: expect.stringContaining("download_url"),
    });
    expect(parseOpenAiChatFile("file_abc")).toMatchObject({
      error: expect.stringContaining("download_url"),
    });
  });
});

describe("resolveHaulingScreenshotBytes + store for native/legacy sources", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "cwc-store-shot-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.resetModules();
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    cwdSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  async function loadStore() {
    return import("@/lib/sessions/screenshotStore");
  }

  async function storeResolved(
    input: {
      file?: unknown;
      fileUrl?: string;
      filePath?: string;
      imageBase64?: string;
    },
    batchId: string,
    filename?: string,
  ) {
    const {
      resolveHaulingScreenshotBytes,
      storeHaulingScreenshotBuffer,
    } = await loadStore();
    const resolved = await resolveHaulingScreenshotBytes(input);
    const stored = await storeHaulingScreenshotBuffer({
      batchId,
      filename: filename ?? resolved.suggestedFilename,
      buffer: resolved.buffer,
      ext: resolved.ext,
    });
    return { resolved, stored };
  }

  it("downloads a ChatGPT file attachment and stores a logicalPath", async () => {
    fetchSpy.mockResolvedValue(
      new Response(PNG_BUFFER, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const { resolved, stored } = await storeResolved(
      {
        file: {
          download_url: "https://files.oaiusercontent.com/shot.png?sig=1",
          file_id: "file_test_1",
          mime_type: "image/png",
          file_name: "contract-everus.png",
        },
      },
      "11111111-1111-1111-1111-111111111111",
      "contract-everus.png",
    );

    expect(resolved.sourceKind).toBe("file");
    expect(resolved.ext).toBe(".png");
    expect(resolved.suggestedFilename).toBe("contract-everus.png");
    expect(stored.logicalPath).toBe(
      "11111111-1111-1111-1111-111111111111/contract-everus.png",
    );

    const { readHaulingScreenshot } = await loadStore();
    const read = await readHaulingScreenshot(stored.logicalPath);
    expect(read.bytes).toBe(PNG_BUFFER.byteLength);
    expect(read.contentType).toBe("image/png");
  });

  it("reports expired ChatGPT download URLs clearly", async () => {
    fetchSpy.mockResolvedValue(
      new Response("gone", { status: 403, statusText: "Forbidden" }),
    );

    const { resolveHaulingScreenshotBytes } = await loadStore();
    await expect(
      resolveHaulingScreenshotBytes({
        file: {
          download_url: "https://files.oaiusercontent.com/expired.png",
          file_id: "file_expired",
        },
      }),
    ).rejects.toThrow(/expired|denied/i);
  });

  it("rejects oversized ChatGPT attachments", async () => {
    const { SCREENSHOT_MAX_BYTES, resolveHaulingScreenshotBytes } =
      await loadStore();
    const big = Buffer.alloc(SCREENSHOT_MAX_BYTES + 1, 1);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    fetchSpy.mockResolvedValue(
      new Response(big, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(big.byteLength),
        },
      }),
    );

    await expect(
      resolveHaulingScreenshotBytes({
        file: {
          download_url: "https://files.oaiusercontent.com/huge.png",
          file_id: "file_huge",
          mime_type: "image/png",
        },
      }),
    ).rejects.toThrow(/12MB/i);
  });

  it("rejects invalid non-image downloads", async () => {
    fetchSpy.mockResolvedValue(
      new Response("not-an-image", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const { resolveHaulingScreenshotBytes } = await loadStore();
    await expect(
      resolveHaulingScreenshotBytes({
        file: {
          download_url: "https://files.oaiusercontent.com/notes.txt",
          file_id: "file_txt",
          mime_type: "text/plain",
        },
      }),
    ).rejects.toThrow(/MIME|image/i);
  });

  it("still supports fileUrl downloads", async () => {
    fetchSpy.mockResolvedValue(
      new Response(PNG_BUFFER, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const { resolved, stored } = await storeResolved(
      { fileUrl: "https://cdn.example.com/mission.png" },
      "batch-url",
      "mission.png",
    );
    expect(resolved.sourceKind).toBe("fileUrl");
    expect(stored.logicalPath).toBe("batch-url/mission.png");
  });

  it("still supports imageBase64", async () => {
    const { resolved, stored } = await storeResolved(
      { imageBase64: `data:image/png;base64,${PNG_BASE64}` },
      "batch-b64",
      "from-b64.png",
    );
    expect(resolved.sourceKind).toBe("imageBase64");
    expect(resolved.ext).toBe(".png");
    expect(stored.logicalPath).toBe("batch-b64/from-b64.png");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still supports readable filePath", async () => {
    const localPath = path.join(root, "local-shot.png");
    await writeFile(localPath, PNG_BUFFER);

    const { resolved, stored } = await storeResolved(
      { filePath: localPath },
      "batch-path",
      "local-shot.png",
    );
    expect(resolved.sourceKind).toBe("filePath");
    expect(resolved.suggestedFilename).toBe("local-shot.png");
    expect(stored.logicalPath).toBe("batch-path/local-shot.png");
    const onDisk = await readFile(
      path.join(root, ".data", "mcp-screenshots", "batch-path", "local-shot.png"),
    );
    expect(onDisk.equals(PNG_BUFFER)).toBe(true);
  });

  it("rejects ChatGPT /mnt/data filePath with guidance to use file", async () => {
    const { resolveHaulingScreenshotBytes } = await loadStore();
    await expect(
      resolveHaulingScreenshotBytes({
        filePath: "/mnt/data/screenshot.png",
      }),
    ).rejects.toThrow(/openai\/fileParams|fileUrl|imageBase64/i);
  });

  it("prefers native file over fileUrl when both are provided", async () => {
    fetchSpy.mockResolvedValue(
      new Response(PNG_BUFFER, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const { resolveHaulingScreenshotBytes } = await loadStore();
    await resolveHaulingScreenshotBytes({
      file: {
        download_url: "https://files.oaiusercontent.com/from-file.png",
        file_id: "file_pref",
      },
      fileUrl: "https://cdn.example.com/other.png",
    });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      "files.oaiusercontent.com/from-file.png",
    );
  });
});
