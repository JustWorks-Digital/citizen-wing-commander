import { appApi } from "@/lib/api/appRoutes";

export type ScreenshotSourceStatus = "pending" | "processed";

export type ScreenshotListItem = {
  logicalPath: string;
  filename: string;
  bytes: number;
  mtime: string;
  status: ScreenshotSourceStatus;
  /** HTTP URL to fetch/display the image for this session. */
  url: string;
};

export type ScreenshotListResponse = {
  sessionId: string;
  batchId: string;
  count: number;
  pendingCount: number;
  processedCount: number;
  screenshots: ScreenshotListItem[];
};

export type ScreenshotUploadItem = {
  logicalPath: string;
  filename: string;
  bytes: number;
  url: string;
};

export type ScreenshotUploadResponse = {
  ok: true;
  sessionId: string;
  batchId: string;
  count: number;
  screenshots: ScreenshotUploadItem[];
};

/** List screenshots stored for a hauling session (batch = sessionId). */
export async function fetchSessionScreenshots(
  sessionId: string,
  options?: { status?: ScreenshotSourceStatus | "all" },
): Promise<ScreenshotListResponse> {
  const status = options?.status ?? "all";
  const url = new URL(
    appApi.checklistSessionScreenshots(sessionId),
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost",
  );
  if (status !== "all") url.searchParams.set("status", status);
  const res = await fetch(
    `${url.pathname}${url.search}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Screenshot list failed (${res.status})`);
  }
  return (await res.json()) as ScreenshotListResponse;
}

/** Upload one or more image files for a session (single multipart request). */
export async function uploadSessionScreenshots(
  sessionId: string,
  files: File[],
): Promise<ScreenshotUploadResponse> {
  if (!files.length) {
    throw new Error("No files to upload");
  }
  const body = new FormData();
  for (const file of files) {
    body.append("file", file, file.name || "paste.png");
  }
  const res = await fetch(appApi.checklistSessionScreenshots(sessionId), {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error || `Screenshot upload failed (${res.status})`,
    );
  }
  return (await res.json()) as ScreenshotUploadResponse;
}

/** Delete one screenshot from a session batch. */
export async function deleteSessionScreenshot(
  sessionId: string,
  filename: string,
): Promise<void> {
  const res = await fetch(
    appApi.checklistSessionScreenshot(sessionId, filename),
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Screenshot delete failed (${res.status})`);
  }
}
