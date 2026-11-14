import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("session Source screenshot pending/processed", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "cwc-shots-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("lists new uploads as pending and marks them processed", async () => {
    const { storeHaulingScreenshotBuffer, listHaulingScreenshots, markHaulingScreenshotsProcessed } =
      await import("@/lib/sessions/screenshotStore");

    // Minimal 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const stored = await storeHaulingScreenshotBuffer({
      batchId: "session-a",
      filename: "contract-1.png",
      buffer: png,
      ext: ".png",
    });

    const pending = await listHaulingScreenshots("session-a", {
      status: "pending",
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.filename).toBe(stored.filename);
    expect(pending[0]?.status).toBe("pending");

    const marked = await markHaulingScreenshotsProcessed({
      batchId: "session-a",
      logicalPaths: [stored.logicalPath],
    });
    expect(marked.marked).toEqual([stored.filename]);
    expect(marked.pendingRemaining).toBe(0);

    const after = await listHaulingScreenshots("session-a", {
      status: "pending",
    });
    expect(after).toHaveLength(0);
    const processed = await listHaulingScreenshots("session-a", {
      status: "processed",
    });
    expect(processed).toHaveLength(1);
    expect(processed[0]?.status).toBe("processed");
  });
});
