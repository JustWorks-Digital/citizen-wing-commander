import { appApi } from "@/lib/api/appRoutes";

export type ScreenshotListItem = {
  logicalPath: string;
  filename: string;
  bytes: number;
  mtime: string;
  /** HTTP URL to fetch/display the image for this session. */
  url: string;
};

export type ScreenshotListResponse = {
  sessionId: string;
  batchId: string;
  count: number;
  screenshots: ScreenshotListItem[];
};

export type ScreenshotUploadResponse = {
  ok: true;
  sessionId: string;
  batchId: string;
  logicalPath: string;
  filename: string;
  bytes: number;
  url: string;
};

/** List screenshots stored for a hauling session (batch = sessionId). */
export async function fetchSessionScreenshots(
  sessionId: string,
): Promise<ScreenshotListResponse> {
  const res = await fetch(appApi.checklistSessionScreenshots(sessionId), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Screenshot list failed (${res.status})`);
  }
  return (await res.json()) as ScreenshotListResponse;
}

/** Upload one or more image files for a session. */
export async function uploadSessionScreenshots(
  sessionId: string,
  files: File[],
): Promise<ScreenshotUploadResponse[]> {
  const results: ScreenshotUploadResponse[] = [];
  for (const file of files) {
    const body = new FormData();
    body.append("file", file, file.name);
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
    results.push((await res.json()) as ScreenshotUploadResponse);
  }
  return results;
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
