import { appApi } from "@/lib/api/appRoutes";

/**
 * Resolve a stored logical path (`<batchId>/<filename>`) to the HTTP screenshot URL.
 * Catalog missions store paths from any session batch under `.data/mcp-screenshots`.
 */
export function screenshotUrlFromLogicalPath(
  logicalPath: string | null | undefined,
): string | null {
  const trimmed = logicalPath?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const batchId = parts[0]!;
  const filename = parts.slice(1).join("/");
  if (!batchId || !filename) return null;
  return appApi.checklistSessionScreenshot(batchId, filename);
}
